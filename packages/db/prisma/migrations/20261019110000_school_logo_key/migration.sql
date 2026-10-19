-- The logo is an object-storage key, signed into a URL when read (API-08).
ALTER TABLE "schools" RENAME COLUMN "logo_url" TO "logo_key";
