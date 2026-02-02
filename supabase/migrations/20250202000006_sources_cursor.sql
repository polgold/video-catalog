-- Cursor para scan incremental (delta) de Dropbox por source
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS cursor text;
