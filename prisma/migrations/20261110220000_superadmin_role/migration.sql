-- Additive migration: existing accounts, sessions and books remain unchanged.
ALTER TYPE "StudioRole" ADD VALUE IF NOT EXISTS 'SUPERADMIN';
