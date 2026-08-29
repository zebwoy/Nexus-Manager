-- ============================================================
-- v5_customer_ledger.sql
-- Adds the unified customer_ledger table and safely seeds it
-- from all existing historical financial transactions.
--
-- Target schema: tenant_hgc  (change below if running on another tenant)
-- ============================================================

-- ⚠ Set this to your tenant schema before running
SET search_path TO tenant_hgc, public;

-- ─── 1. Create table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_ledger (
  id               SERIAL PRIMARY KEY,
  customer_id      INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Which module originated this entry
  module           VARCHAR(30) NOT NULL
                   CHECK (module IN ('session','sale','recharge','payment','adjustment','pancafe')),
  reference_id     INT,          -- FK to the source row (session.id / recharge.id etc.)
  reference_module VARCHAR(30),  -- 'sessions' | 'recharges' | 'sales' | 'session_payments' etc.

  -- POSITIVE  = money owed TO the cafe (charge / debit)
  -- NEGATIVE  = money received / credit given back (payment / refund)
  amount           DECIMAL(10, 2) NOT NULL,

  -- Snapshot running balance AFTER this entry (per-customer cumulative sum)
  -- Positive = customer still owes cafe
  -- Negative = cafe owes customer (credit on account)
  running_balance  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

  description      TEXT NOT NULL,
  note             TEXT,

  -- Convenience computed flags for UI filtering
  is_charge  BOOLEAN GENERATED ALWAYS AS (amount > 0) STORED,
  is_payment BOOLEAN GENERATED ALWAYS AS (amount < 0) STORED,

  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cl_customer   ON customer_ledger (customer_id);
CREATE INDEX IF NOT EXISTS idx_cl_created_at ON customer_ledger (customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cl_reference  ON customer_ledger (reference_module, reference_id);
CREATE INDEX IF NOT EXISTS idx_cl_module     ON customer_ledger (module);

-- ─── 2. Safe historical seed ────────────────────────────────
-- Builds a complete chronological event stream per customer,
-- then inserts with correct running_balance using a window SUM.
-- Only runs if the table is empty (idempotent / safe to re-run).

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM customer_ledger) = 0 THEN

    WITH events AS (

      -- 2a. Session charges (each session adds a debit = +total)
      SELECT
        s.customer_id,
        COALESCE(s.created_at, (s.date::text || 'T12:00:00+05:30')::timestamptz) AS event_at,
        'session'    AS module,
        s.id         AS reference_id,
        'sessions'   AS reference_module,
        s.total      AS amount,
        'Session #' || s.id || ' — ' || COALESCE(d.label, 'Station') AS description,
        s.created_by AS created_by
      FROM sessions s
      LEFT JOIN devices d ON d.id = s.device_id
      WHERE s.customer_id IS NOT NULL
        AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)

      UNION ALL

      -- 2b. Session payments (each payment = credit back = negative)
      SELECT
        s.customer_id,
        COALESCE(sp.created_at, s.created_at) AS event_at,
        'payment'           AS module,
        sp.id               AS reference_id,
        'session_payments'  AS reference_module,
        -sp.amount          AS amount,
        'Payment for Session #' || s.id || ' (' || sp.payment_method || ')' AS description,
        sp.created_by
      FROM session_payments sp
      JOIN sessions s ON s.id = sp.session_id
      WHERE s.customer_id IS NOT NULL
        AND (s.is_deleted IS NULL OR s.is_deleted = FALSE)

      UNION ALL

      -- 2c. Recharge charges
      SELECT
        r.customer_id,
        COALESCE(r.created_at, (r.date::text || 'T12:00:00+05:30')::timestamptz) AS event_at,
        'recharge'   AS module,
        r.id         AS reference_id,
        'recharges'  AS reference_module,
        r.charge_price AS amount,
        'Recharge — ' || COALESCE(r.game_platform, 'Platform') AS description,
        r.created_by AS created_by
      FROM recharges r
      WHERE r.customer_id IS NOT NULL

      UNION ALL

      -- 2d. Recharge payments (negative — only if something was actually paid)
      SELECT
        r.customer_id,
        COALESCE(r.created_at, (r.date::text || 'T12:00:00+05:30')::timestamptz) AS event_at,
        'payment'    AS module,
        r.id         AS reference_id,
        'recharges'  AS reference_module,
        -r.payment_received AS amount,
        'Payment for Recharge #' || r.id || ' (' || r.payment_method || ')' AS description,
        r.created_by AS created_by
      FROM recharges r
      WHERE r.customer_id IS NOT NULL
        AND r.payment_received > 0

    ),

    -- Assign stable ordering within the same customer + same timestamp
    ordered AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY customer_id
          ORDER BY event_at,
            -- Charges before payments at same timestamp
            CASE module WHEN 'session' THEN 1 WHEN 'recharge' THEN 2 ELSE 3 END,
            reference_id
        ) AS rn
      FROM events
    ),

    -- Compute per-customer running balance (cumulative sum in chronological order)
    with_balance AS (
      SELECT
        customer_id, module, reference_id, reference_module,
        amount, description, created_by, event_at, rn,
        SUM(amount) OVER (
          PARTITION BY customer_id
          ORDER BY event_at,
            CASE module WHEN 'session' THEN 1 WHEN 'recharge' THEN 2 ELSE 3 END,
            reference_id,
            rn
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_balance
      FROM ordered
    )

    INSERT INTO customer_ledger
      (customer_id, module, reference_id, reference_module,
       amount, description, running_balance, created_by, created_at)
    SELECT
      customer_id, module, reference_id, reference_module,
      amount, description, running_balance, created_by, event_at
    FROM with_balance
    ORDER BY customer_id, event_at, rn;

    RAISE NOTICE 'customer_ledger seeded with % rows.', (SELECT COUNT(*) FROM customer_ledger);
  ELSE
    RAISE NOTICE 'customer_ledger already has data — seed skipped.';
  END IF;
END $$;
