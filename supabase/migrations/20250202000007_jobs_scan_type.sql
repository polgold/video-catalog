-- Permitir job type 'scan' para procesamiento en background
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_type_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_type_check
  CHECK (type IN ('ingest', 'process', 'publish_youtube', 'publish_vimeo', 'scan'));
