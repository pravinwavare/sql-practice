import type { SqlWorkerRequest, SqlWorkerResponse } from './sqlProtocol';
import type { DatabaseId } from '../data/databases';

type SqlWorkerPayload =
  | { type: 'INITIALIZE' }
  | { type: 'EXECUTE'; sql: string }
  | { type: 'VALIDATE'; sql: string; solution: string; ordered: boolean }
  | { type: 'RESET' }
  | { type: 'SWITCH_DATABASE'; databaseId: DatabaseId }
  | { type: 'LOAD_DATABASE'; databaseId: DatabaseId; buffer: ArrayBuffer; resetSnapshot?: ArrayBuffer; databaseName?: string }
  | { type: 'IMPORT_DATABASE'; name: string; format: 'sqlite' | 'sql'; buffer: ArrayBuffer };

type ResponseFor<Type extends SqlWorkerResponse['type']> = Extract<SqlWorkerResponse, { type: Type }>;

interface PendingRequest {
  type: SqlWorkerRequest['type'];
  preserveOriginalSnapshot: boolean;
  resolve: (response: SqlWorkerResponse) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

export class SqlWorkerClient {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pending = new Map<number, PendingRequest>();
  private databaseSnapshots = new Map<DatabaseId, ArrayBuffer>();
  private originalDatabaseSnapshots = new Map<DatabaseId, ArrayBuffer>();
  private activeDatabaseId: DatabaseId = 'hospital';
  private lastReady: ResponseFor<'READY'> | null = null;
  private recoveryPromise: Promise<void> | null = null;
  private recovering = false;
  private ready = false;
  private disposed = false;

  constructor(private readonly onRecoveryStatus?: (message: string, isError?: boolean) => void) {}

  async initialize(): Promise<ResponseFor<'READY'>> {
    return this.ensureReady();
  }

  async execute(sql: string): Promise<ResponseFor<'RESULT'>> {
    await this.ensureReady();
    return this.send({ type: 'EXECUTE', sql }, 10_000) as Promise<ResponseFor<'RESULT'>>;
  }

  async validate(sql: string, solution: string, ordered = false): Promise<ResponseFor<'VALIDATION'>> {
    await this.ensureReady();
    return this.send({ type:'VALIDATE', sql, solution, ordered }, 10_000) as Promise<ResponseFor<'VALIDATION'>>;
  }

  async resetDatabase(): Promise<ResponseFor<'READY'>> {
    await this.ensureReady();
    return this.send({ type: 'RESET' }, 10_000) as Promise<ResponseFor<'READY'>>;
  }

  async switchDatabase(databaseId: DatabaseId): Promise<ResponseFor<'READY'>> {
    await this.ensureReady();
    return this.send({ type: 'SWITCH_DATABASE', databaseId }, 10_000) as Promise<ResponseFor<'READY'>>;
  }

  async loadDatabase(database: Uint8Array, databaseId: DatabaseId = this.activeDatabaseId): Promise<ResponseFor<'READY'>> {
    await this.ensureReady();
    const copy = database.slice();
    const buffer = copy.buffer as ArrayBuffer;
    const resetSnapshot = copy.slice().buffer as ArrayBuffer;
    return this.send({ type: 'LOAD_DATABASE', databaseId, buffer, resetSnapshot }, 15_000, [buffer, resetSnapshot]) as Promise<ResponseFor<'READY'>>;
  }

  async importDatabase(name: string, format: 'sqlite' | 'sql', data: Uint8Array): Promise<ResponseFor<'READY'>> {
    await this.ensureReady();
    const buffer = data.slice().buffer as ArrayBuffer;
    return this.send({ type: 'IMPORT_DATABASE', name, format, buffer }, 20_000, [buffer]) as Promise<ResponseFor<'READY'>>;
  }

  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    for (const [requestId, request] of this.pending) {
      window.clearTimeout(request.timeoutId);
      request.reject(new Error('The SQL worker was closed.'));
      this.pending.delete(requestId);
    }
  }

  private async ensureReady(): Promise<ResponseFor<'READY'>> {
    if (this.ready && this.lastReady) return this.lastReady;
    if (this.recoveryPromise) await this.recoveryPromise;
    if (this.ready && this.lastReady) return this.lastReady;
    if (this.disposed) throw new Error('The SQL worker is closed.');
    if (!this.worker) this.createWorker();
    const response = await this.send({ type: 'INITIALIZE' }, 15_000);
    if (response.type !== 'READY') throw new Error('The SQL worker did not become ready.');
    this.ready = true;
    this.lastReady = response;
    return response;
  }

  private createWorker() {
    if (this.disposed) throw new Error('The SQL worker is closed.');
    const worker = new Worker(new URL('../workers/sql.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.addEventListener('message', (event: MessageEvent<SqlWorkerResponse>) => {
      this.receive(event.data);
    });
    worker.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault();
      this.failWorker(new Error(event.message || 'The SQL worker stopped unexpectedly.'), worker);
    });
    worker.addEventListener('messageerror', () => {
      this.failWorker(new Error('A message from the SQL worker could not be read.'), worker);
    });
  }

  private send(
    payload: SqlWorkerPayload,
    timeoutMs: number,
    transfer: Transferable[] = [],
    preserveOriginalSnapshot = false,
  ): Promise<SqlWorkerResponse> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('The SQL worker is not available.'));
    const requestId = this.nextRequestId++;
    const request = { ...payload, requestId } as SqlWorkerRequest;

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const error = new Error(
          payload.type === 'EXECUTE' || payload.type === 'VALIDATE'
            ? 'This query exceeded the 10 second execution limit. The database worker is restarting.'
            : 'The SQL worker did not respond in time and is restarting.',
        );
        this.pending.delete(requestId);
        reject(error);
        this.failWorker(error, worker);
      }, timeoutMs);

      this.pending.set(requestId, { type: payload.type, preserveOriginalSnapshot, resolve, reject, timeoutId });
      try {
        worker.postMessage(request, transfer);
      } catch (error) {
        window.clearTimeout(timeoutId);
        this.pending.delete(requestId);
        reject(error instanceof Error ? error : new Error('Could not send a request to the SQL worker.'));
      }
    });
  }

  private receive(response: SqlWorkerResponse) {
    if (!response || typeof response.requestId !== 'number') return;
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    this.pending.delete(response.requestId);

    if (response.type === 'ERROR') {
      this.activeDatabaseId = response.databaseId;
      if (response.databaseSnapshot) this.databaseSnapshots.set(response.databaseId, response.databaseSnapshot.slice(0));
      if (pending.type === 'INITIALIZE') this.ready = false;
      pending.reject(new Error(response.message));
      return;
    }

    if (response.type === 'READY' || response.type === 'RESULT') {
      this.activeDatabaseId = response.databaseId;
      this.databaseSnapshots.set(response.databaseId, response.databaseSnapshot.slice(0));
    }
    if (response.type === 'READY') {
      this.originalDatabaseSnapshots.set(response.databaseId, response.originalSnapshot.slice(0));
    }
    if (response.type === 'READY') { this.ready = true; this.lastReady = response; }
    pending.resolve(response);
  }

  private failWorker(error: Error, failedWorker: Worker) {
    if (this.worker !== failedWorker) return;
    failedWorker.terminate();
    this.worker = null;
    this.ready = false;

    for (const [requestId, request] of this.pending) {
      window.clearTimeout(request.timeoutId);
      request.reject(error);
      this.pending.delete(requestId);
    }

    if (!this.disposed && !this.recovering) {
      this.onRecoveryStatus?.('The SQL worker stopped. Restoring the last saved database state…');
      this.recoveryPromise = this.recoverWorker();
    }
  }

  private async recoverWorker() {
    this.recovering = true;
    const snapshots = new Map([...this.databaseSnapshots].map(([id, snapshot]) => [id, snapshot.slice(0)]));
    const originals = new Map([...this.originalDatabaseSnapshots].map(([id, snapshot]) => [id, snapshot.slice(0)]));
    const targetDatabaseId = this.activeDatabaseId;
    try {
      this.createWorker();
      const initialized = await this.send({ type: 'INITIALIZE' }, 15_000);
      if (initialized.type !== 'READY') throw new Error('The SQL worker could not be reinitialized.');
      for (const [databaseId, snapshot] of snapshots) {
        const buffer = snapshot.slice(0);
        const resetSnapshot = originals.get(databaseId)?.slice(0);
        const transfer: Transferable[] = [buffer];
        if (resetSnapshot) transfer.push(resetSnapshot);
        const loaded = await this.send(
          { type: 'LOAD_DATABASE', databaseId, buffer, resetSnapshot: resetSnapshot ?? undefined, databaseName: databaseId === 'custom' ? 'Your database' : undefined },
          15_000,
          transfer,
          true,
        );
        if (loaded.type !== 'READY') throw new Error('The database state could not be restored.');
      }
      if (this.activeDatabaseId !== targetDatabaseId) {
        const selected = await this.send({ type:'SWITCH_DATABASE', databaseId:targetDatabaseId }, 10_000);
        if (selected.type !== 'READY') throw new Error('The active database could not be restored.');
      }
      this.ready = true;
      this.onRecoveryStatus?.('The SQL worker is ready again.');
    } catch (error) {
      this.worker?.terminate();
      this.worker = null;
      this.ready = false;
      this.onRecoveryStatus?.(error instanceof Error ? error.message : 'The SQL worker could not restart.', true);
    } finally {
      this.recovering = false;
      this.recoveryPromise = null;
    }
  }
}
