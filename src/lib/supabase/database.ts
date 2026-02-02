import type { Source, Video, Job, Duplicate, PlatformCredentials, DropboxCredentials } from "@/lib/db/types";

export type Database = {
  public: {
    Tables: {
      sources: { Row: Source; Insert: Omit<Source, "id" | "created_at" | "updated_at"> & { id?: string }; Update: Partial<Source> };
      videos: { Row: Video; Insert: Omit<Video, "id" | "created_at" | "updated_at"> & { id?: string }; Update: Partial<Video> };
      jobs: { Row: Job; Insert: Omit<Job, "id" | "created_at"> & { id?: string }; Update: Partial<Job> };
      duplicates: { Row: Duplicate; Insert: Omit<Duplicate, "id" | "created_at"> & { id?: string }; Update: Partial<Duplicate> };
      platform_credentials: { Row: PlatformCredentials; Insert: Omit<PlatformCredentials, "id" | "created_at" | "updated_at"> & { id?: string }; Update: Partial<PlatformCredentials> };
      dropbox_credentials: { Row: DropboxCredentials; Insert: Omit<DropboxCredentials, "id" | "created_at" | "updated_at"> & { id?: string }; Update: Partial<DropboxCredentials> };
    };
  };
};
