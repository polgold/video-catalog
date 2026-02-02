import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

const DROPBOX_TOKEN = "https://api.dropboxapi.com/oauth2/token";
const VIDEO_EXT = [".mp4", ".mov", ".mxf", ".mkv"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? request.url.replace("/api/dropbox/callback", "")}/settings?dropbox=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? request.url.replace("/api/dropbox/callback", "")}/settings?dropbox=missing_code`
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/dropbox/callback`;
  const appKey =
    process.env.NEXT_PUBLIC_DROPBOX_APP_KEY ??
    process.env.DROPBOX_APP_KEY ??
    process.env.DROPBOX_CLIENT_ID;
  const appSecret = process.env.DROPBOX_APP_SECRET ?? process.env.DROPBOX_CLIENT_SECRET;

  if (!appKey || !appSecret) {
    return NextResponse.redirect(`${baseUrl}/settings?dropbox=config_error`);
  }

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(DROPBOX_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.redirect(
      `${baseUrl}/settings?dropbox=token_error&message=${encodeURIComponent(text)}`
    );
  }

  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  const supabase = createSupabaseServer();

  const { data: existing } = await supabase.from("dropbox_credentials").select("id").limit(1).single();
  if (existing) {
    await supabase.from("dropbox_credentials").update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabase.from("dropbox_credentials").insert({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
    });
  }

  return NextResponse.redirect(`${baseUrl}/settings?dropbox=connected`);
}
