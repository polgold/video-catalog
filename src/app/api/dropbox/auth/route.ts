import { NextResponse } from "next/server";

const DROPBOX_OAUTH = "https://www.dropbox.com/oauth2/authorize";
const VIDEO_EXT = [".mp4", ".mov", ".mxf", ".mkv"];

export async function GET(request: Request) {
  const appKey =
    process.env.NEXT_PUBLIC_DROPBOX_APP_KEY ??
    process.env.DROPBOX_APP_KEY ??
    process.env.DROPBOX_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri =
    process.env.DROPBOX_REDIRECT_URI ?? `${baseUrl}/api/dropbox/callback`;

  if (!appKey) {
    return NextResponse.json({ error: "Dropbox app key not configured" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    token_access_type: "offline",
    scope: "files.metadata.read files.content.read",
  });

  const url = `${DROPBOX_OAUTH}?${params.toString()}`;
  return NextResponse.redirect(url);
}
