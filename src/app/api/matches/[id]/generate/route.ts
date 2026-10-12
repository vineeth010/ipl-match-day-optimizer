import { generateForMatch, HttpError } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the Gemini explanation can take ~10s

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const r = await generateForMatch(id);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" }, { status });
  }
}
