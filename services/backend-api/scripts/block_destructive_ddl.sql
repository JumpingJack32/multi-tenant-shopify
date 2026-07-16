-- ============================================================
-- Block Destructive DDL in Local Dev
-- ============================================================
-- Install:  psql -d your_db -f scripts/block_destructive_ddl.sql
-- Verify:   SELECT * FROM pg_event_trigger WHERE evtname LIKE 'block_%';
-- Remove:   DROP EVENT TRIGGER block_drop; DROP EVENT TRIGGER block_truncate;
--            DROP FUNCTION block_drop_func(); DROP FUNCTION block_truncate_func();
-- ============================================================

-- Block DROP TABLE / DROP VIEW / DROP SCHEMA etc.
CREATE OR REPLACE FUNCTION block_drop_func()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DDL LOCKDOWN: DROP is blocked in this environment (dev). Use psql with "SET app.block_destructive = bypass;" first.';
END;
$$;

CREATE EVENT TRIGGER block_drop
  ON ddl_command_end
  WHEN TAG IN (
    'DROP TABLE', 'DROP VIEW', 'DROP SCHEMA', 'DROP INDEX',
    'DROP FOREIGN TABLE', 'DROP MATERIALIZED VIEW'
  )
  EXECUTE FUNCTION block_drop_func();

-- Block TRUNCATE
CREATE OR REPLACE FUNCTION block_truncate_func()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DDL LOCKDOWN: TRUNCATE is blocked in this environment (dev).';
END;
$$;

CREATE EVENT TRIGGER block_truncate
  ON ddl_command_end
  WHEN TAG IN ('TRUNCATE TABLE')
  EXECUTE FUNCTION block_truncate_func();

-- Bypass mechanism (requires superuser or owner):
--   SET app.block_destructive = 'bypass';
--   DROP TABLE some_table;
--   RESET app.block_destructive;
