export interface SqlReferenceEntry {
  slug: string;
  title: string;
  category: string;
  summary: string;
  example: string;
}

export const referenceCategories = [
  'Basics', 'Filtering', 'Functions', 'Joins & sets', 'Tables & schema',
];

export const referenceEntries: SqlReferenceEntry[] = [
  { slug:'select', title:'SELECT', category:'Basics', summary:'Choose the columns or expressions to return from a query.', example:'SELECT first_name, city\nFROM patients;' },
  { slug:'from', title:'FROM', category:'Basics', summary:'Choose the table or view that supplies the rows.', example:'SELECT *\nFROM patients;' },
  { slug:'aliases', title:'Aliases', category:'Basics', summary:'Give a column or table a shorter, clearer name with AS.', example:'SELECT first_name AS name\nFROM patients AS p;' },
  { slug:'distinct', title:'DISTINCT', category:'Basics', summary:'Remove duplicate rows from the selected output.', example:'SELECT DISTINCT city\nFROM patients;' },
  { slug:'where', title:'WHERE', category:'Filtering', summary:'Keep only rows that match a condition.', example:"SELECT first_name, city\nFROM patients\nWHERE city = 'Toronto';" },
  { slug:'comparison', title:'Comparison operators', category:'Filtering', summary:'Compare values with =, !=, <, <=, >, and >=.', example:'SELECT first_name, height\nFROM patients\nWHERE height >= 180;' },
  { slug:'and-or', title:'AND / OR', category:'Filtering', summary:'Combine conditions. Use parentheses when mixing AND and OR.', example:"SELECT first_name, city\nFROM patients\nWHERE city = 'Toronto' AND gender = 'F';" },
  { slug:'in', title:'IN', category:'Filtering', summary:'Match a value against a list of possible values.', example:"SELECT first_name, city\nFROM patients\nWHERE city IN ('Toronto', 'Ottawa');" },
  { slug:'between', title:'BETWEEN', category:'Filtering', summary:'Match values inside an inclusive range.', example:'SELECT first_name, height\nFROM patients\nWHERE height BETWEEN 160 AND 180;' },
  { slug:'like', title:'LIKE', category:'Filtering', summary:'Match text patterns. % matches any length; _ matches one character.', example:"SELECT first_name\nFROM patients\nWHERE first_name LIKE 'A%';" },
  { slug:'null', title:'NULL values', category:'Filtering', summary:'Use IS NULL or IS NOT NULL to check missing values.', example:'SELECT first_name\nFROM patients\nWHERE contact_number IS NULL;' },
  { slug:'order-by', title:'ORDER BY', category:'Filtering', summary:'Sort results in ascending (ASC) or descending (DESC) order.', example:'SELECT first_name, height\nFROM patients\nORDER BY height DESC;' },
  { slug:'limit', title:'LIMIT / OFFSET', category:'Filtering', summary:'Restrict how many rows are returned and optionally skip rows.', example:'SELECT first_name\nFROM patients\nORDER BY patient_id\nLIMIT 10 OFFSET 5;' },
  { slug:'count', title:'COUNT', category:'Functions', summary:'Count rows or non-NULL values in a group.', example:'SELECT COUNT(*) AS patient_count\nFROM patients;' },
  { slug:'sum', title:'SUM', category:'Functions', summary:'Add numeric values in a column.', example:'SELECT SUM(salary) AS total_salary\nFROM doctors;' },
  { slug:'avg', title:'AVG', category:'Functions', summary:'Calculate the mean of non-NULL numeric values.', example:'SELECT AVG(height) AS average_height\nFROM patients;' },
  { slug:'min-max', title:'MIN / MAX', category:'Functions', summary:'Find the smallest or largest value in a column.', example:'SELECT MIN(height), MAX(height)\nFROM patients;' },
  { slug:'group-by', title:'GROUP BY', category:'Functions', summary:'Group rows that share a value so each group can be summarized.', example:'SELECT city, COUNT(*) AS patients\nFROM patients\nGROUP BY city;' },
  { slug:'having', title:'HAVING', category:'Functions', summary:'Filter grouped results after GROUP BY.', example:'SELECT city, COUNT(*) AS patients\nFROM patients\nGROUP BY city\nHAVING COUNT(*) > 2;' },
  { slug:'case', title:'CASE', category:'Functions', summary:'Return a value based on the first matching condition.', example:'SELECT first_name,\n  CASE WHEN height >= 180 THEN \'Tall\' ELSE \'Other\' END AS height_group\nFROM patients;' },
  { slug:'coalesce', title:'COALESCE / IFNULL', category:'Functions', summary:'Replace NULL with the first available fallback value.', example:"SELECT COALESCE(contact_number, 'None listed') AS phone\nFROM patients;" },
  { slug:'string', title:'String functions', category:'Functions', summary:'Transform and inspect text with functions such as UPPER, LOWER, and LENGTH.', example:'SELECT UPPER(first_name), LENGTH(last_name)\nFROM patients;' },
  { slug:'round', title:'Numeric functions', category:'Functions', summary:'Round or transform numeric values with ROUND, ABS, and related functions.', example:'SELECT ROUND(AVG(height), 1) AS average_height\nFROM patients;' },
  { slug:'date', title:'Date functions', category:'Functions', summary:'SQLite stores dates as text or numbers; date() and strftime() can extract parts.', example:"SELECT strftime('%Y', birth_date) AS birth_year\nFROM patients;" },
  { slug:'window', title:'Window functions', category:'Functions', summary:'Calculate across related rows while keeping each row in the result.', example:'SELECT first_name, height,\n  RANK() OVER (ORDER BY height DESC) AS height_rank\nFROM patients;' },
  { slug:'join', title:'JOIN', category:'Joins & sets', summary:'Combine matching rows from related tables using an ON condition.', example:'SELECT p.first_name, a.diagnosis\nFROM patients AS p\nJOIN admissions AS a ON a.patient_id = p.patient_id;' },
  { slug:'left-join', title:'LEFT JOIN', category:'Joins & sets', summary:'Keep every row from the left table, even when no matching right row exists.', example:'SELECT p.first_name, a.admission_id\nFROM patients AS p\nLEFT JOIN admissions AS a ON a.patient_id = p.patient_id;' },
  { slug:'union', title:'UNION', category:'Joins & sets', summary:'Append compatible result sets. UNION removes duplicate rows; UNION ALL keeps them.', example:'SELECT city AS value FROM patients\nUNION\nSELECT diagnosis AS value FROM admissions;' },
  { slug:'subquery', title:'Subqueries', category:'Joins & sets', summary:'Use a query inside another query to calculate or filter intermediate results.', example:'SELECT first_name, height\nFROM patients\nWHERE height > (SELECT AVG(height) FROM patients);' },
  { slug:'exists', title:'EXISTS', category:'Joins & sets', summary:'Test whether a subquery returns at least one row. Correlated EXISTS is useful for finding related records without adding columns.', example:'SELECT c.customer_id, c.first_name, c.last_name\nFROM customers AS c\nWHERE EXISTS (\n  SELECT 1 FROM orders AS o\n  WHERE o.customer_id = c.customer_id\n);' },
  { slug:'any-all', title:'ANY / ALL comparisons', category:'Filtering', summary:'SQLite does not implement the SQL ANY and ALL operators. Use IN, EXISTS, or an aggregate subquery: > ANY is often > MIN(...), while >= ALL is often >= MAX(...).', example:'-- Products priced at least as high as every product in their category\nSELECT p.product_name, p.price\nFROM products AS p\nWHERE p.price >= (\n  SELECT MAX(other.price)\n  FROM products AS other\n  WHERE other.category = p.category\n);' },
  { slug:'create-table', title:'CREATE TABLE', category:'Tables & schema', summary:'Create a table by naming its columns and data types.', example:'CREATE TABLE reference_teams (\n  team_id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);' },
  { slug:'constraints', title:'Constraints', category:'Tables & schema', summary:'Constraints enforce valid values. SQLite supports PRIMARY KEY, NOT NULL, UNIQUE, CHECK, and DEFAULT constraints.', example:'CREATE TABLE products_demo (\n  product_id INTEGER PRIMARY KEY,\n  sku TEXT NOT NULL UNIQUE,\n  price REAL NOT NULL CHECK (price >= 0),\n  active INTEGER NOT NULL DEFAULT 1\n);' },
  { slug:'foreign-keys', title:'Foreign keys', category:'Tables & schema', summary:'A foreign key requires a child value to match a key in a parent table. SQLite enforces it when PRAGMA foreign_keys is enabled.', example:'CREATE TABLE order_demo (\n  order_id INTEGER PRIMARY KEY,\n  customer_id INTEGER NOT NULL REFERENCES customers(customer_id)\n);' },
  { slug:'alter-table', title:'ALTER TABLE', category:'Tables & schema', summary:'Change an existing table. SQLite supports renaming tables or columns, adding columns, and dropping columns in current SQLite releases.', example:'ALTER TABLE employees\nRENAME COLUMN city TO office_city;' },
  { slug:'drop-table', title:'DROP TABLE', category:'Tables & schema', summary:'Permanently remove a table and its data. Use IF EXISTS to avoid an error when it is absent.', example:'DROP TABLE IF EXISTS temporary_results;' },
  { slug:'insert-update-delete', title:'INSERT / UPDATE / DELETE', category:'Tables & schema', summary:'Add rows, change rows, or remove rows. Use a WHERE clause for targeted updates and deletes.', example:"UPDATE patients\nSET city = 'Toronto'\nWHERE patient_id = 1;" },
  { slug:'index', title:'Indexes', category:'Tables & schema', summary:'An index can speed up lookups on a column, with extra storage and write cost.', example:'CREATE INDEX idx_patients_city\nON patients(city);' },
];
