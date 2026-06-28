ALTER TABLE public.settings_train_ai
  ADD COLUMN IF NOT EXISTS bubble_admin_locked boolean NOT NULL DEFAULT false;