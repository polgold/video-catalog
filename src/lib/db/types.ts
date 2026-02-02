// DB types matching Supabase schema

export type VideoStatus =
  | "pending_ingest"
  | "processing"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_fix";

export type JobType = "ingest" | "process" | "publish_youtube" | "publish_vimeo";
export type JobStatus = "pending" | "running" | "done" | "failed";

export type DuplicateReason =
  | "exact_hash"
  | "visual_phash"
  | "audio_fp"
  | "semantic";

export interface Source {
  id: string;
  dropbox_folder_id: string;
  path: string;
  provider: string;
  cursor: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Video {
  id: string;
  source_id: string | null;
  dropbox_file_id: string | null;
  path: string | null;
  filename: string | null;
  status: VideoStatus;
  file_sha256: string | null;
  file_size: number | null;
  duration_sec: number | null;
  fps: number | null;
  resolution: string | null;
  codec: string | null;
  title: string | null;
  description: string | null;
  summary: string | null;
  suggested_title: string | null;
  suggested_description: string | null;
  genre: string | null;
  styles: string[];
  tags: string[];
  thumbnail_keyframe: number | null;
  transcript_text: string | null;
  transcript_segments: TranscriptSegment[];
  keyframe_urls: string[];
  phash_keyframes: string[];
  audio_fingerprint: string | null;
  youtube_id: string | null;
  vimeo_id: string | null;
  published_youtube_at: string | null;
  published_vimeo_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  video_id: string | null;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Duplicate {
  id: string;
  video_id: string;
  duplicate_video_id: string;
  score: number;
  reason: DuplicateReason;
  created_at: string;
}

export interface PlatformCredentials {
  id: string;
  platform: "youtube" | "vimeo";
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DropboxCredentials {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  cursor: string | null;
  created_at: string;
  updated_at: string;
}
