-- Manual-invoice (no-checkout) pricing mode.
-- A proposal can now show full pricing, get signed, and skip Stripe checkout entirely so the
-- owner invoices manually and later marks it paid. The toggle itself lives inside the existing
-- paymentConfig JSON (paymentConfig.manualInvoice); the only schema change is a new terminal-ish
-- payment status for "signed, awaiting offline payment", reconciled to PAID via an admin action.
ALTER TYPE proposals."PaymentStatus" ADD VALUE IF NOT EXISTS 'MANUAL_INVOICE';
