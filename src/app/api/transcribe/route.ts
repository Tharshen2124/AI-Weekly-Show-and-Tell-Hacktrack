import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// OpenAI rejects anything larger, so oversized clips are refused here rather
// than after a pointless upload round-trip.
const MAX_BYTES = 25 * 1024 * 1024;

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * Proxies a recorded clip to OpenAI's speech-to-text endpoint.
 *
 * The key never reaches the browser, and the route is gated on the same admin
 * check the `updates` mutations use — dictation spends OpenAI credit, and only
 * admins can save an update in the first place.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!apiKey || !convexUrl) {
    return Response.json({ error: "Transcription is not configured." }, { status: 503 });
  }

  const { getToken, sessionClaims } = await auth();
  // Mirrors how `ConvexProviderWithClerk` asks for its token, so Convex
  // authorizes this request against the members table exactly as it would a
  // query made from the UI. Clerk's built-in Convex integration stamps
  // `aud: "convex"` on the ordinary session token; instances wired up the older
  // way mint one from a JWT template of that name instead.
  const token =
    sessionClaims?.aud === "convex"
      ? await getToken()
      : await getToken({ template: "convex" }).catch(() => null);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);
  const me = await convex.query(api.functions.auth.me, {});
  if (!me?.isAdmin) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No audio was sent." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "That recording is too long. Record it in shorter takes." },
      { status: 413 },
    );
  }

  // Forwarded as multipart; `Content-Type` is deliberately left unset so fetch
  // writes the boundary itself.
  const upstream = new FormData();
  upstream.append("file", file, file.name || "dictation.webm");
  upstream.append("model", "gpt-4o-transcribe");
  upstream.append("response_format", "json");

  let response: Response;
  try {
    response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch {
    return Response.json({ error: "Could not reach the transcription service." }, { status: 502 });
  }

  if (!response.ok) {
    // Upstream errors quote account and key detail, so they stay in the server
    // log and the caller gets a generic message.
    console.error("OpenAI transcription failed", response.status, await response.text());
    return Response.json({ error: "Could not transcribe the audio." }, { status: 502 });
  }

  const data = (await response.json()) as { text?: string };
  return Response.json({ text: data.text ?? "" });
}
