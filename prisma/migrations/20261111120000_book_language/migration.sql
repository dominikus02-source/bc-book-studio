-- Additive bibliographic language (BCP 47 subset used by the studio: id or en).
-- Existing rows stay Indonesian so current books and exports do not change language.
ALTER TABLE "Book" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'id';
