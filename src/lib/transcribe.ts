/**
 * Sends a recorded clip to the server route, which holds the OpenAI key.
 * Throws with a message fit to show the user.
 */
export async function transcribeAudio(blob: Blob, extension: string): Promise<string> {
  const body = new FormData();
  body.append("file", new File([blob], `dictation.${extension}`, { type: blob.type }));

  const response = await fetch("/api/transcribe", { method: "POST", body });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Could not transcribe the audio.");
  }
  return ((data?.text as string | undefined) ?? "").trim();
}
