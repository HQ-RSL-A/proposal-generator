-- Signer self-identification captured at signing time (title + company)
ALTER TABLE "proposals"."Signature" ADD COLUMN "signerTitle" TEXT;
ALTER TABLE "proposals"."Signature" ADD COLUMN "signerCompany" TEXT;
