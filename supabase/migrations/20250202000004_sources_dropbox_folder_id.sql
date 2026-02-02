-- Asegurar que sources tenga dropbox_folder_id (fix schema cache / tablas creadas sin esta columna)
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS dropbox_folder_id text;

UPDATE public.sources SET dropbox_folder_id = path WHERE dropbox_folder_id IS NULL;

ALTER TABLE public.sources ALTER COLUMN dropbox_folder_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sources'::regclass AND conname = 'sources_dropbox_folder_id_key'
  ) THEN
    ALTER TABLE public.sources ADD CONSTRAINT sources_dropbox_folder_id_key UNIQUE (dropbox_folder_id);
  END IF;
END
$$;
