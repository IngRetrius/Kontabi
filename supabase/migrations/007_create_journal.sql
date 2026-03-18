-- 007_create_journal.sql
-- Double-entry journal: entries (headers) and lines (debit/credit rows).
-- Every confirmed entry must be balanced: SUM(debits) = SUM(credits).

-- =============================================
-- TABLE: journal_entries (header)
-- =============================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_number)
);

COMMENT ON TABLE public.journal_entries IS 'Asientos contables (cabecera). Cada asiento tiene multiples lineas de debito y credito.';
COMMENT ON COLUMN public.journal_entries.entry_number IS 'Numero secuencial por tenant. Formato: YYYY-NNNN (e.g., 2026-0001).';
COMMENT ON COLUMN public.journal_entries.status IS 'draft = editable, confirmed = inmutable (validado y balanceado).';

-- Indexes
CREATE INDEX idx_journal_entries_tenant_id ON public.journal_entries (tenant_id);
CREATE INDEX idx_journal_entries_date ON public.journal_entries (tenant_id, date DESC);
CREATE INDEX idx_journal_entries_status ON public.journal_entries (tenant_id, status);
CREATE INDEX idx_journal_entries_transaction ON public.journal_entries (transaction_id) WHERE transaction_id IS NOT NULL;

-- Auto-update
CREATE TRIGGER trg_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view journal entries in their tenant"
  ON public.journal_entries FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert journal entries in their tenant"
  ON public.journal_entries FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update draft journal entries in their tenant"
  ON public.journal_entries FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete draft journal entries in their tenant"
  ON public.journal_entries FOR DELETE
  USING (tenant_id = public.get_current_tenant_id() AND status = 'draft');

-- Audit
CREATE TRIGGER trg_journal_entries_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- TABLE: journal_entry_lines (detail rows)
-- =============================================

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  )
);

COMMENT ON TABLE public.journal_entry_lines IS 'Lineas de asiento contable. Cada linea afecta una cuenta con debito o credito (nunca ambos).';
COMMENT ON CONSTRAINT chk_debit_or_credit ON public.journal_entry_lines IS 'Cada linea debe tener exactamente un debito O un credito, nunca ambos ni cero.';

-- Indexes
CREATE INDEX idx_journal_lines_entry ON public.journal_entry_lines (journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_entry_lines (account_id);

-- RLS: lines inherit access from their parent journal_entry
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lines of entries in their tenant"
  ON public.journal_entry_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.tenant_id = public.get_current_tenant_id()
    )
  );

CREATE POLICY "Users can insert lines for entries in their tenant"
  ON public.journal_entry_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.tenant_id = public.get_current_tenant_id()
    )
  );

CREATE POLICY "Users can update lines of draft entries in their tenant"
  ON public.journal_entry_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.tenant_id = public.get_current_tenant_id()
        AND je.status = 'draft'
    )
  );

CREATE POLICY "Users can delete lines of draft entries in their tenant"
  ON public.journal_entry_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_id
        AND je.tenant_id = public.get_current_tenant_id()
        AND je.status = 'draft'
    )
  );

-- =============================================
-- FUNCTION: validate_journal_entry_balance
-- Prevents confirming an unbalanced journal entry.
-- =============================================

CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_sum NUMERIC(14,2);
  v_credit_sum NUMERIC(14,2);
  v_line_count INTEGER;
BEGIN
  -- Only validate when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0),
      COUNT(*)
    INTO v_debit_sum, v_credit_sum, v_line_count
    FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    -- Must have at least 2 lines
    IF v_line_count < 2 THEN
      RAISE EXCEPTION 'El asiento debe tener al menos 2 lineas (debito y credito)';
    END IF;

    -- Debits must equal credits
    IF v_debit_sum != v_credit_sum THEN
      RAISE EXCEPTION 'Asiento desbalanceado: debitos (%) != creditos (%)',
        v_debit_sum, v_credit_sum;
    END IF;

    -- Must not be zero
    IF v_debit_sum = 0 THEN
      RAISE EXCEPTION 'El asiento no puede tener monto cero';
    END IF;
  END IF;

  -- Prevent changes to confirmed entries (except system operations)
  IF OLD.status = 'confirmed' AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'No se puede modificar un asiento confirmado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_journal_balance
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_journal_entry_balance();

COMMENT ON FUNCTION public.validate_journal_entry_balance IS 'Validates that SUM(debits) = SUM(credits) before confirming a journal entry. Core double-entry enforcement.';

-- =============================================
-- FUNCTION: generate_entry_number
-- Auto-generates sequential entry numbers per tenant per year.
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_entry_number(p_tenant_id UUID, p_date DATE)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM p_date)::TEXT;

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(entry_number, '-', 2) AS INTEGER)
  ), 0) + 1
  INTO v_seq
  FROM public.journal_entries
  WHERE tenant_id = p_tenant_id
    AND entry_number LIKE v_year || '-%';

  RETURN v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.generate_entry_number IS 'Generates the next sequential entry number for a tenant in format YYYY-NNNN.';

-- =============================================
-- Add FK from transactions to journal_entries
-- (deferred because both tables need to exist first)
-- =============================================

ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_journal_entry
  FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id)
  ON DELETE SET NULL;
