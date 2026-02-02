-- provider: origen del source (dropbox, etc.) para permitir múltiples en el futuro
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS provider text;

UPDATE public.sources SET provider = 'dropbox' WHERE provider IS NULL;

ALTER TABLE public.sources ALTER COLUMN provider SET NOT NULL;

ALTER TABLE public.sources ALTER COLUMN provider SET DEFAULT 'dropbox';
