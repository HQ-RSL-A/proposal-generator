-- Optional add-ons + 50% deposit.
-- Add-ons offer + deposit config live inside the existing paymentConfig JSON; the only new
-- column records the client's add-on selection at sign time (parallel to selectedTierId).
-- The offered add-ons are frozen into frozenContent.paymentConfig.addOns at send.
ALTER TABLE proposals."Proposal"
  ADD COLUMN IF NOT EXISTS "selectedAddOnIds" jsonb NOT NULL DEFAULT '[]'::jsonb;
