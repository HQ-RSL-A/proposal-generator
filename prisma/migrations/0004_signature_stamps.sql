-- Two-place signing ceremony: the adopted signature is explicitly placed on
-- the Proposal Acceptance block and on the MSA "Agreed and Accepted" block.
-- Client-reported tap timestamps; the legal signing instant stays "signedAt".
ALTER TABLE proposals."Signature"
  ADD COLUMN IF NOT EXISTS "stampedProposalAt" timestamp(3) without time zone,
  ADD COLUMN IF NOT EXISTS "stampedAgreementAt" timestamp(3) without time zone;
