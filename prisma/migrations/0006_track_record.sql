-- Per-proposal Track Record (intro + case studies, each with an optional URL).
-- Editable until send, then copied into frozenContent.trackRecord and covered by the content hash.
-- Null = legacy/pre-migration rows, which fall back to the default case studies at render.
ALTER TABLE proposals."Proposal"
  ADD COLUMN IF NOT EXISTS "trackRecord" jsonb;
