-- 001_create_tenants.sql
-- Base table for multi-tenant architecture.
-- Each tenant represents one condominium (conjunto residencial).

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nit TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bogota',
  department TEXT NOT NULL DEFAULT 'Cundinamarca',
  stratum INTEGER NOT NULL CHECK (stratum BETWEEN 1 AND 6),
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX idx_tenants_nit ON public.tenants (nit);
CREATE INDEX idx_tenants_is_active ON public.tenants (is_active);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tenants IS 'Conjuntos residenciales (copropiedades). Root entity for multi-tenancy.';
