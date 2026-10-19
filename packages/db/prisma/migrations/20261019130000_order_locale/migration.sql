-- The language the buyer checked out in, for their receipt and welcome emails (API-09).
ALTER TABLE "orders" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
