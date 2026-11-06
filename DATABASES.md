# Sample databases

All seed definitions live in `src/data/databases.ts`. The same definitions generate the SQL schema, insert sample rows, the playground schema explorer, and the public schema pages. Every database is a distinct SQLite database in the worker, and each has a seed snapshot for reset and recovery.

| Database | Tables | Records | Main relationships |
| --- | --- | ---: | --- |
| Hospital (default) | `patients`, `doctors`, `admissions` | 72 | Admissions reference one patient and one doctor. |
| Company | `departments`, `employees`, `salaries` | 56 | Employees belong to departments and may report to another employee; salary history references employees. |
| E-commerce | `customers`, `products`, `orders`, `order_items` | 82 | Orders reference customers; order lines reference orders and products. |

Row counts include each table’s records. The sample set is intentionally small enough for quick local practice. Hospital records include nullable phone, discharge, and billing fields. Company includes a nullable top-level manager. E-commerce order totals are checked against line item subtotals.

## Schema updates

Update the matching `DatabaseDefinition` in `src/data/databases.ts`: declare column type/description and key/reference metadata, then provide each row using the column names. Seeding enables SQLite foreign keys and runs `PRAGMA foreign_key_check` before the worker becomes ready. Keep `relationships` descriptions in step with actual foreign-key metadata. Exercise schema or sample-data changes with `npm run test:sql`.

SQLite column affinity is used. `DATE` is stored as ISO `YYYY-MM-DD` text; SQL.js does not add a calendar/date type. Money values are sample `REAL` values, so compare monetary calculations with suitable numeric tolerance.
