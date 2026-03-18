-- 015_create_audit_log.sql
-- Immutable audit log, partitioned by month for performance.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for the next 12 months (2026)
CREATE TABLE public.audit_log_2026_01 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.audit_log_2026_02 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.audit_log_2026_03 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.audit_log_2026_04 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE public.audit_log_2026_05 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.audit_log_2026_06 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE public.audit_log_2026_07 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.audit_log_2026_08 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE public.audit_log_2026_09 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE public.audit_log_2026_10 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE public.audit_log_2026_11 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE public.audit_log_2026_12 PARTITION OF public.audit_log
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Indexes on the parent (inherited by partitions)
CREATE INDEX idx_audit_log_tenant_id ON public.audit_log (tenant_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log (table_name);
CREATE INDEX idx_audit_log_record_id ON public.audit_log (record_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at);

-- RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.audit_log IS 'Immutable audit trail. Partitioned by month. Never delete rows.';
