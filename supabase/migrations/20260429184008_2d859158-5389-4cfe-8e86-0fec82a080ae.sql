
ALTER TYPE conversation_category ADD VALUE IF NOT EXISTS 'shipping_request';
-- (placeholder no-op; enum already has request/suggestion from prior migration applied to conversation_category which tickets.category also uses)

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS display_code text;

CREATE INDEX IF NOT EXISTS idx_tickets_display_code ON public.tickets(tenant_id, display_code);

-- Backfill display codes on existing 3 conversation-linked tickets per tenant
UPDATE public.tickets tk
SET display_code = CASE c.display_code
  WHEN 'CV-001' THEN 'TK-001'
  WHEN 'CV-002' THEN 'TK-002'
  WHEN 'CV-005' THEN 'TK-003'
END
FROM public.conversations c
WHERE tk.conversation_id = c.id
  AND c.display_code IN ('CV-001','CV-002','CV-005')
  AND tk.display_code IS NULL;
