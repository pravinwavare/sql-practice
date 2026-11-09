export type DatabaseId = 'hospital' | 'company' | 'ecommerce' | 'custom';
export type SeedValue = string | number | null;

export interface ColumnDefinition {
  name: string;
  type: 'INTEGER' | 'REAL' | 'TEXT' | 'DATE';
  description: string;
  nullable?: boolean;
  primaryKey?: boolean;
  references?: { table: string; column: string };
}

export interface TableDefinition {
  name: string;
  description: string;
  columns: ColumnDefinition[];
  rows: Record<string, SeedValue>[];
}

export interface DatabaseDefinition {
  id: DatabaseId;
  name: string;
  summary: string;
  purpose: string;
  tables: TableDefinition[];
  relationships: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; description: string }[];
}

export const databases: DatabaseDefinition[] = [
  {
    id: 'hospital',
    name: 'Hospital Database',
    summary: 'Patients, doctors, and hospital admissions.',
    purpose: 'Practice filtering, aggregation, and joins using a compact hospital dataset.',
    tables: [
      {
        name: 'patients', description: 'People registered with the hospital.',
        columns: [
          { name: 'patient_id', type: 'INTEGER', description: 'Unique patient identifier.', primaryKey: true },
          { name: 'first_name', type: 'TEXT', description: 'Patient given name.' },
          { name: 'last_name', type: 'TEXT', description: 'Patient family name.' },
          { name: 'gender', type: 'TEXT', description: 'Recorded gender: F or M.' },
          { name: 'birth_date', type: 'DATE', description: 'Patient date of birth.' },
          { name: 'city', type: 'TEXT', description: 'Patient home city.' },
          { name: 'contact_number', type: 'TEXT', description: 'Contact phone number; may be NULL.', nullable: true },
          { name: 'registration_date', type: 'DATE', description: 'Date the patient registered.' },
          { name: 'height', type: 'INTEGER', description: 'Patient height in centimetres.' },
          { name: 'weight', type: 'INTEGER', description: 'Patient weight in kilograms.' },
        ],
        rows: [
          [1,'Liam','Anderson','M','1985-01-15','Toronto','416-555-0101','2021-02-10'],
          [2,'Emma','Brown','F','1990-06-21','Ottawa','613-555-0102','2021-03-18'],
          [3,'Noah','Chen','M','1978-11-03','Vancouver','604-555-0103','2021-05-04'],
          [4,'Olivia','Davis','F','2001-04-12','Toronto',null,'2021-07-22'],
          [5,'Ethan','Patel','M','1995-09-27','Calgary','403-555-0105','2021-09-09'],
          [6,'Ava','Wilson','F','1988-02-09','Vancouver','604-555-0106','2021-11-16'],
          [7,'Lucas','Martin','M','1969-12-19','Montreal','514-555-0107','2022-01-11'],
          [8,'Mia','Taylor','F','2004-07-30','Ottawa','613-555-0108','2022-02-27'],
          [9,'Mason','Thomas','M','1982-03-08','Edmonton','780-555-0109','2022-04-14'],
          [10,'Sophia','Moore','F','1975-08-17','Toronto','416-555-0110','2022-05-30'],
          [11,'James','Jackson','M','1999-10-05','Calgary',null,'2022-07-08'],
          [12,'Isabella','White','F','1992-01-28','Montreal','514-555-0112','2022-09-19'],
          [13,'Benjamin','Harris','M','1963-05-14','Vancouver','604-555-0113','2022-10-25'],
          [14,'Amelia','Clark','F','1986-12-02','Edmonton','780-555-0114','2023-01-06'],
          [15,'Elijah','Lewis','M','2003-06-11','Ottawa','613-555-0115','2023-02-20'],
          [16,'Charlotte','Robinson','F','1979-04-23','Toronto','416-555-0116','2023-04-03'],
          [17,'William','Walker','M','1991-11-09','Calgary','403-555-0117','2023-05-17'],
          [18,'Harper','Young','F','1968-07-06','Vancouver',null,'2023-07-01'],
          [19,'Henry','Allen','M','1980-02-26','Montreal','514-555-0119','2023-08-12'],
          [20,'Evelyn','King','F','1997-09-15','Edmonton','780-555-0120','2023-10-04'],
          [21,'Alexander','Wright','M','1972-06-30','Toronto','416-555-0121','2024-01-10'],
          [22,'Abigail','Scott','F','2000-03-19','Ottawa','613-555-0122','2024-02-08'],
          [23,'Daniel','Green','M','1987-10-22','Vancouver','604-555-0123','2024-03-14'],
          [24,'Ella','Baker','F','1994-05-03','Calgary','403-555-0124','2024-04-25'],
        ].map(([patient_id, first_name, last_name, gender, birth_date, city, contact_number, registration_date]) => ({ patient_id, first_name, last_name, gender, birth_date, city, contact_number, registration_date, height: 150 + (Number(patient_id) % 42), weight: 50 + (Number(patient_id) % 45) })),
      },
      {
        name: 'doctors', description: 'Hospital doctors and their departments.',
        columns: [
          { name: 'doctor_id', type: 'INTEGER', description: 'Unique doctor identifier.', primaryKey: true },
          { name: 'first_name', type: 'TEXT', description: 'Doctor given name.' },
          { name: 'last_name', type: 'TEXT', description: 'Doctor family name.' },
          { name: 'specialization', type: 'TEXT', description: 'Medical specialty.' },
          { name: 'salary', type: 'REAL', description: 'Annual salary in CAD.' },
          { name: 'hire_date', type: 'DATE', description: 'Date the doctor joined.' },
          { name: 'department', type: 'TEXT', description: 'Hospital department.' },
        ],
        rows: [
          [1,'James','Wilson','Cardiology',185000,'2010-06-01','Heart Centre'],
          [2,'Sophia','Garcia','Family Medicine',142000,'2014-03-15','Primary Care'],
          [3,'Benjamin','Lee','Pediatrics',155000,'2012-09-10','Child Health'],
          [4,'Maya','Thompson','Neurology',192000,'2008-01-22','Neuroscience'],
          [5,'Oliver','Martinez','Orthopedics',188000,'2016-05-02','Surgery'],
          [6,'Amara','Singh','Oncology',205000,'2007-11-19','Cancer Care'],
          [7,'Daniel','Roberts','Dermatology',163000,'2018-07-09','Specialty Care'],
          [8,'Grace','Kim','Cardiology',198000,'2011-02-14','Heart Centre'],
        ].map(([doctor_id, first_name, last_name, specialization, salary, hire_date, department]) => ({ doctor_id, first_name, last_name, specialization, salary, hire_date, department })),
      },
      {
        name: 'admissions', description: 'Patient visits and treatment records.',
        columns: [
          { name: 'admission_id', type: 'INTEGER', description: 'Unique admission identifier.', primaryKey: true },
          { name: 'patient_id', type: 'INTEGER', description: 'Patient for this admission.', references: { table: 'patients', column: 'patient_id' } },
          { name: 'doctor_id', type: 'INTEGER', description: 'Attending doctor.', references: { table: 'doctors', column: 'doctor_id' } },
          { name: 'admission_date', type: 'DATE', description: 'Date admitted.' },
          { name: 'discharge_date', type: 'DATE', description: 'Date discharged; NULL while still admitted.', nullable: true },
          { name: 'diagnosis', type: 'TEXT', description: 'Primary diagnosis.' },
          { name: 'room_number', type: 'INTEGER', description: 'Assigned room.' },
          { name: 'billing_amount', type: 'REAL', description: 'Final bill in CAD; NULL until discharge.', nullable: true },
        ],
        rows: [
          [1,1,1,'2022-01-12','2022-01-15','Arrhythmia',210,4200],
          [2,2,2,'2022-02-03','2022-02-03','Annual checkup',105,350],
          [3,3,5,'2022-02-20','2022-02-27','Fracture',318,7800],
          [4,4,2,'2022-04-01','2022-04-02','Allergic reaction',108,950],
          [5,5,4,'2022-05-14','2022-05-18','Migraine',224,3100],
          [6,6,1,'2022-06-09','2022-06-13','Chest pain',212,5600],
          [7,7,5,'2022-07-22','2022-07-29','Hip replacement',320,18500],
          [8,8,3,'2022-09-04','2022-09-06','Asthma',116,2400],
          [9,9,2,'2022-10-11','2022-10-11','Annual checkup',104,325],
          [10,10,6,'2022-11-19','2022-11-25','Lymphoma',410,26400],
          [11,11,7,'2023-01-05','2023-01-06','Eczema',132,700],
          [12,12,4,'2023-02-14','2023-02-18','Seizure',228,6200],
          [13,13,6,'2023-03-08','2023-03-19','Lung cancer',414,41800],
          [14,14,5,'2023-04-22','2023-04-28','Knee surgery',322,14200],
          [15,15,3,'2023-05-30','2023-06-01','Pneumonia',118,2900],
          [16,16,1,'2023-07-12','2023-07-15','Hypertension',216,3800],
          [17,17,2,'2023-08-03','2023-08-03','Annual checkup',106,375],
          [18,18,7,'2023-09-17','2023-09-18','Skin lesion',134,1100],
          [19,19,4,'2023-10-26','2023-10-30','Parkinsons disease',232,8400],
          [20,20,3,'2023-11-11','2023-11-13','Appendicitis',120,5100],
          [21,21,8,'2024-01-09','2024-01-14','Coronary artery disease',218,9700],
          [22,22,2,'2024-02-15','2024-02-15','Annual checkup',107,400],
          [23,23,6,'2024-03-03','2024-03-10','Prostate cancer',416,23500],
          [24,24,5,'2024-04-06','2024-04-12','Shoulder repair',324,11900],
          [25,1,2,'2024-05-02','2024-05-02','Follow-up visit',102,275],
          [26,2,3,'2024-05-18','2024-05-21','Bronchitis',122,1800],
          [27,3,1,'2024-06-04',null,'Heart failure',220,null],
          [28,4,7,'2024-06-12','2024-06-13','Dermatitis',136,850],
          [29,5,6,'2024-07-20','2024-07-28','Melanoma',418,30700],
          [30,6,4,'2024-08-01','2024-08-04','Epilepsy',234,4900],
          [31,7,2,'2024-08-17','2024-08-17','Follow-up visit',109,290],
          [32,8,3,'2024-09-09','2024-09-12','Asthma',124,2100],
          [33,9,5,'2024-10-03','2024-10-09','Fracture',326,8300],
          [34,10,8,'2024-10-21','2024-10-25','Angina',222,6500],
          [35,11,7,'2024-11-02','2024-11-03','Acne',138,600],
          [36,12,4,'2024-11-19','2024-11-22','Migraine',236,3300],
          [37,13,6,'2024-12-01',null,'Chemotherapy',420,null],
          [38,14,2,'2024-12-06','2024-12-06','Follow-up visit',110,310],
          [39,15,3,'2024-12-12','2024-12-15','Influenza',126,1750],
          [40,16,1,'2024-12-19','2024-12-22','Arrhythmia',224,5900],
        ].map(([admission_id, patient_id, doctor_id, admission_date, discharge_date, diagnosis, room_number, billing_amount]) => ({ admission_id, patient_id, doctor_id, admission_date, discharge_date, diagnosis, room_number, billing_amount })),
      },
    ],
    relationships: [
      { fromTable: 'admissions', fromColumn: 'patient_id', toTable: 'patients', toColumn: 'patient_id', description: 'Each admission belongs to one patient; a patient can have many admissions.' },
      { fromTable: 'admissions', fromColumn: 'doctor_id', toTable: 'doctors', toColumn: 'doctor_id', description: 'Each admission is attended by one doctor; a doctor can attend many admissions.' },
    ],
  },
  {
    id: 'company', name: 'Company Database', summary: 'Departments, employees, managers, and salary history.',
    purpose: 'Practice self joins, department joins, salary changes, grouping, and subqueries.',
    tables: [
      { name: 'departments', description: 'Company teams and office locations.', columns: [
        { name: 'department_id', type: 'INTEGER', description: 'Unique department identifier.', primaryKey: true },
        { name: 'department_name', type: 'TEXT', description: 'Department name.' },
        { name: 'location', type: 'TEXT', description: 'Primary office location.' },
      ], rows: [
        [1,'Engineering','Toronto'],[2,'Sales','Vancouver'],[3,'People','Ottawa'],[4,'Finance','Montreal'],[5,'Operations','Calgary'],
      ].map(([department_id, department_name, location]) => ({ department_id, department_name, location })) },
      { name: 'employees', description: 'Employees and reporting relationships.', columns: [
        { name: 'employee_id', type: 'INTEGER', description: 'Unique employee identifier.', primaryKey: true },
        { name: 'first_name', type: 'TEXT', description: 'Employee given name.' },
        { name: 'last_name', type: 'TEXT', description: 'Employee family name.' },
        { name: 'department_id', type: 'INTEGER', description: 'Employee department.', references: { table: 'departments', column: 'department_id' } },
        { name: 'manager_id', type: 'INTEGER', description: 'Employee manager; NULL for top-level leaders.', nullable: true, references: { table: 'employees', column: 'employee_id' } },
        { name: 'hire_date', type: 'DATE', description: 'Employee start date.' },
        { name: 'job_title', type: 'TEXT', description: 'Current role.' },
        { name: 'city', type: 'TEXT', description: 'Employee work city.' },
      ], rows: [
        [1,'Priya','Shah',1,null,'2012-04-02','Engineering Director','Toronto'],
        [2,'Marcus','Reed',2,null,'2014-08-11','Sales Director','Vancouver'],
        [3,'Nina','Foster',3,null,'2016-01-18','People Director','Ottawa'],
        [4,'Victor','Chen',4,null,'2011-10-03','Finance Director','Montreal'],
        [5,'Sofia','Lopez',5,null,'2015-06-22','Operations Director','Calgary'],
        [6,'Ethan','Brooks',1,1,'2017-02-13','Senior Engineer','Toronto'],
        [7,'Maya','Patel',1,1,'2019-09-09','Software Engineer','Ottawa'],
        [8,'Leo','Nguyen',1,6,'2021-03-15','Data Analyst','Vancouver'],
        [9,'Grace','Kim',1,6,'2022-07-05','Software Engineer','Toronto'],
        [10,'Owen','Price',2,2,'2018-05-21','Account Manager','Vancouver'],
        [11,'Aisha','Khan',2,2,'2020-11-02','Sales Representative','Calgary'],
        [12,'Jack','Miller',2,10,'2023-01-16','Sales Representative','Toronto'],
        [13,'Ella','Green',3,3,'2019-04-08','Recruiter','Ottawa'],
        [14,'Noah','Ward',3,3,'2021-12-06','People Analyst','Montreal'],
        [15,'Amir','Hassan',4,4,'2017-08-28','Financial Analyst','Montreal'],
        [16,'Zoe','Turner',4,4,'2020-02-10','Accountant','Calgary'],
        [17,'Ivy','Campbell',5,5,'2018-10-15','Operations Manager','Calgary'],
        [18,'Theo','Bennett',5,17,'2022-05-30','Logistics Coordinator','Vancouver'],
        [19,'Aria','Morgan',1,6,'2024-02-12','Junior Engineer','Ottawa'],
        [20,'Caleb','Ross',5,17,'2024-06-03','Operations Associate','Toronto'],
      ].map(([employee_id, first_name, last_name, department_id, manager_id, hire_date, job_title, city]) => ({ employee_id, first_name, last_name, department_id, manager_id, hire_date, job_title, city })) },
      { name: 'salaries', description: 'Salary history; a NULL to_date means the salary is current.', columns: [
        { name: 'salary_id', type: 'INTEGER', description: 'Unique salary record identifier.', primaryKey: true },
        { name: 'employee_id', type: 'INTEGER', description: 'Employee receiving the salary.', references: { table: 'employees', column: 'employee_id' } },
        { name: 'salary', type: 'REAL', description: 'Annual salary in CAD.' },
        { name: 'from_date', type: 'DATE', description: 'First day this salary applied.' },
        { name: 'to_date', type: 'DATE', description: 'Last day this salary applied; NULL if current.', nullable: true },
      ], rows: [
        [1,1,148000,'2012-04-02','2018-12-31'],[2,1,176000,'2019-01-01',null],
        [3,2,132000,'2014-08-11','2020-12-31'],[4,2,161000,'2021-01-01',null],
        [5,3,118000,'2016-01-18','2021-12-31'],[6,3,139000,'2022-01-01',null],
        [7,4,142000,'2011-10-03','2019-06-30'],[8,4,170000,'2019-07-01',null],
        [9,5,125000,'2015-06-22','2022-03-31'],[10,5,151000,'2022-04-01',null],
        [11,6,112000,'2017-02-13','2020-12-31'],[12,6,132000,'2021-01-01',null],
        [13,7,84000,'2019-09-09','2022-12-31'],[14,7,101000,'2023-01-01',null],
        [15,8,76000,'2021-03-15',null],[16,9,88000,'2022-07-05',null],
        [17,10,96000,'2018-05-21','2021-12-31'],[18,10,112000,'2022-01-01',null],
        [19,11,67000,'2020-11-02',null],[20,12,64000,'2023-01-16',null],
        [21,13,72000,'2019-04-08','2022-06-30'],[22,13,81000,'2022-07-01',null],
        [23,14,76000,'2021-12-06',null],[24,15,92000,'2017-08-28','2021-12-31'],
        [25,15,106000,'2022-01-01',null],[26,16,79000,'2020-02-10',null],
        [27,17,103000,'2018-10-15','2022-12-31'],[28,17,121000,'2023-01-01',null],
        [29,18,61000,'2022-05-30',null],[30,19,73000,'2024-02-12',null],[31,20,59000,'2024-06-03',null],
      ].map(([salary_id, employee_id, salary, from_date, to_date]) => ({ salary_id, employee_id, salary, from_date, to_date })) },
    ],
    relationships: [
      { fromTable: 'employees', fromColumn: 'department_id', toTable: 'departments', toColumn: 'department_id', description: 'Each employee belongs to one department.' },
      { fromTable: 'employees', fromColumn: 'manager_id', toTable: 'employees', toColumn: 'employee_id', description: 'An employee may report to another employee.' },
      { fromTable: 'salaries', fromColumn: 'employee_id', toTable: 'employees', toColumn: 'employee_id', description: 'An employee can have multiple salary history records.' },
    ],
  },
  {
    id: 'ecommerce', name: 'E-commerce Database', summary: 'Customers, products, orders, and order items.',
    purpose: 'Practice multi-table joins, order totals, customer activity, and product analysis.',
    tables: [
      { name: 'customers', description: 'Shopper profiles and registration details.', columns: [
        { name: 'customer_id', type: 'INTEGER', description: 'Unique customer identifier.', primaryKey: true },
        { name: 'first_name', type: 'TEXT', description: 'Customer given name.' },
        { name: 'last_name', type: 'TEXT', description: 'Customer family name.' },
        { name: 'email', type: 'TEXT', description: 'Customer email address.' },
        { name: 'city', type: 'TEXT', description: 'Customer city.' },
        { name: 'country', type: 'TEXT', description: 'Customer country.' },
        { name: 'registration_date', type: 'DATE', description: 'Date the customer registered.' },
      ], rows: [
        [1,'Avery','Stone','avery.stone@example.com','Toronto','Canada','2022-01-12'],[2,'Riley','James','riley.james@example.com','Vancouver','Canada','2022-02-08'],
        [3,'Jordan','Lee','jordan.lee@example.com','Seattle','USA','2022-04-15'],[4,'Casey','Morgan','casey.morgan@example.com','Montreal','Canada','2022-05-21'],
        [5,'Taylor','Reed','taylor.reed@example.com','Austin','USA','2022-07-04'],[6,'Quinn','Parker','quinn.parker@example.com','Calgary','Canada','2022-08-19'],
        [7,'Morgan','Bailey','morgan.bailey@example.com','London','UK','2022-10-02'],[8,'Jamie','Brooks','jamie.brooks@example.com','Toronto','Canada','2023-01-11'],
        [9,'Drew','Kelly','drew.kelly@example.com','Dublin','Ireland','2023-03-09'],[10,'Reese','Carter','reese.carter@example.com','Vancouver','Canada','2023-04-18'],
        [11,'Skyler','Bell','skyler.bell@example.com','Boston','USA','2023-06-20'],[12,'Rowan','Cook','rowan.cook@example.com','Ottawa','Canada','2023-09-01'],
      ].map(([customer_id, first_name, last_name, email, city, country, registration_date]) => ({ customer_id, first_name, last_name, email, city, country, registration_date })) },
      { name: 'products', description: 'Products currently offered by the store.', columns: [
        { name: 'product_id', type: 'INTEGER', description: 'Unique product identifier.', primaryKey: true },
        { name: 'product_name', type: 'TEXT', description: 'Product display name.' },
        { name: 'category', type: 'TEXT', description: 'Product category.' },
        { name: 'price', type: 'REAL', description: 'Unit price in CAD.' },
        { name: 'stock_quantity', type: 'INTEGER', description: 'Units currently in stock.' },
      ], rows: [
        [1,'Desk Lamp','Home',39.99,84],[2,'Notebook Set','Stationery',12.5,210],[3,'Wireless Mouse','Electronics',28,65],[4,'Travel Mug','Home',22.75,130],
        [5,'SQL Basics','Books',34.95,42],[6,'Keyboard','Electronics',79.99,31],[7,'Canvas Tote','Accessories',18,95],[8,'Water Bottle','Home',26.5,72],
        [9,'Data Modeling','Books',42,28],[10,'USB-C Hub','Electronics',54.5,44],[11,'Pen Set','Stationery',9.99,260],[12,'Desk Organizer','Home',31.25,53],
      ].map(([product_id, product_name, category, price, stock_quantity]) => ({ product_id, product_name, category, price, stock_quantity })) },
      { name: 'orders', description: 'Customer orders and their fulfillment status.', columns: [
        { name: 'order_id', type: 'INTEGER', description: 'Unique order identifier.', primaryKey: true },
        { name: 'customer_id', type: 'INTEGER', description: 'Customer who placed the order.', references: { table: 'customers', column: 'customer_id' } },
        { name: 'order_date', type: 'DATE', description: 'Date the order was placed.' },
        { name: 'order_status', type: 'TEXT', description: 'Current order status.' },
        { name: 'total_amount', type: 'REAL', description: 'Order total in CAD.' },
      ], rows: [
        [1,1,'2023-01-10','shipped',70.49],[2,2,'2023-02-04','delivered',39.99],[3,3,'2023-02-16','delivered',107.99],[4,1,'2023-03-22','delivered',57.45],
        [5,4,'2023-04-09','cancelled',79.99],[6,5,'2023-05-13','shipped',77.45],[7,6,'2023-06-01','delivered',49],[8,7,'2023-07-18','delivered',77.9],
        [9,8,'2023-08-27','processing',62.5],[10,9,'2023-09-12','delivered',84],[11,2,'2023-10-03','shipped',112.99],[12,10,'2023-11-21','delivered',58.49],
        [13,11,'2024-01-15','processing',99.96],[14,12,'2024-02-06','delivered',56.25],[15,3,'2024-03-17','shipped',121.99],[16,5,'2024-05-08','delivered',65.5],
        [17,1,'2024-06-14','processing',96.5],[18,8,'2024-08-29','delivered',43.99],
      ].map(([order_id, customer_id, order_date, order_status, total_amount]) => ({ order_id, customer_id, order_date, order_status, total_amount })) },
      { name: 'order_items', description: 'Products and quantities included in each order.', columns: [
        { name: 'order_item_id', type: 'INTEGER', description: 'Unique order line identifier.', primaryKey: true },
        { name: 'order_id', type: 'INTEGER', description: 'Order containing this item.', references: { table: 'orders', column: 'order_id' } },
        { name: 'product_id', type: 'INTEGER', description: 'Product purchased.', references: { table: 'products', column: 'product_id' } },
        { name: 'quantity', type: 'INTEGER', description: 'Number of units.' },
        { name: 'unit_price', type: 'REAL', description: 'Price per unit at purchase time.' },
      ], rows: [
        [1,1,1,1,39.99],[2,1,2,1,12.5],[3,1,7,1,18.0],[4,2,1,1,39.99],[5,3,6,1,79.99],[6,3,3,1,28.0],[7,4,4,1,22.75],[8,4,8,1,26.5],
        [9,4,11,1,8.2],[10,5,6,1,79.99],[11,6,5,1,34.95],[12,6,2,2,12.25],[13,6,7,1,18.0],[14,7,3,1,28.0],[15,7,2,1,12.5],[16,7,11,1,8.5],
        [17,8,9,1,42.0],[18,8,4,1,22.75],[19,8,2,1,13.15],[20,9,2,3,12.5],[21,9,11,2,12.5],[22,10,9,2,42.0],[23,11,10,1,54.5],[24,11,6,1,58.49],
        [25,12,3,1,28.0],[26,12,11,1,9.99],[27,12,4,1,20.5],[28,13,1,2,39.99],[29,13,11,2,9.99],[30,14,12,1,31.25],[31,14,2,2,12.5],[32,15,6,1,79.99],
        [33,15,9,1,42.0],[34,16,8,2,26.5],[35,16,2,1,12.5],[36,17,10,1,54.5],[37,17,4,1,22.0],[38,17,7,1,20.0],[39,18,5,1,34.0],[40,18,11,1,9.99],
      ].map(([order_item_id, order_id, product_id, quantity, unit_price]) => ({ order_item_id, order_id, product_id, quantity, unit_price })) },
    ],
    relationships: [
      { fromTable: 'orders', fromColumn: 'customer_id', toTable: 'customers', toColumn: 'customer_id', description: 'Each order belongs to one customer; customers can place multiple orders.' },
      { fromTable: 'order_items', fromColumn: 'order_id', toTable: 'orders', toColumn: 'order_id', description: 'Each order line belongs to one order; an order can contain multiple products.' },
      { fromTable: 'order_items', fromColumn: 'product_id', toTable: 'products', toColumn: 'product_id', description: 'Each order line references one product; a product can appear in many orders.' },
    ],
  },
];

export const databaseById = Object.fromEntries(databases.map((database) => [database.id, database])) as Record<Exclude<DatabaseId, 'custom'>, DatabaseDefinition>;
export const defaultDatabaseId: Exclude<DatabaseId, 'custom'> = 'hospital';

export function getRecordCount(database: DatabaseDefinition, tableName: string) {
  return database.tables.find((table) => table.name === tableName)?.rows.length ?? 0;
}
