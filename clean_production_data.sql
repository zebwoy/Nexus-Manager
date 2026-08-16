-- Nexus Manager - Production Data Cleanup & Reset Script
-- Run this script in your PostgreSQL database (Neon DB) to purge all dummy/test simulation data.
-- Preserves system settings, pricing rules, device catalog, and user accounts.

BEGIN;

-- Purge all operational logs & transactions
TRUNCATE TABLE session_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE pancafe_sessions RESTART IDENTITY CASCADE;
TRUNCATE TABLE sale_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales RESTART IDENTITY CASCADE;
TRUNCATE TABLE recharges RESTART IDENTITY CASCADE;
TRUNCATE TABLE expenses RESTART IDENTITY CASCADE;
TRUNCATE TABLE day_openings RESTART IDENTITY CASCADE;
TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;

-- Delete non-essential customer records created during testing
DELETE FROM customers WHERE id NOT IN (SELECT DISTINCT customer_id FROM sales WHERE customer_id IS NOT NULL);

COMMIT;

-- Console output summary
SELECT 'Production Cleanup Complete. System is reset and ready for production use.' AS status;
