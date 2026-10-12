import { HttpError, saveActualsAndLearn } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { points?: Record<string, number> };
    if (!body?.points || typeof body.points !== "object") throw new HttpError(400, "Send { points: { playerId: number } }");
    const result = await saveActualsAndLearn(id, body.points);
    return Response.json({
      ok: true,
      changed: result.changed,
      notes: result.notes,
      modelMae: result.modelMae,
      baselineMae: result.baselineMae,
      weightsVersion: result.after.version,
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" }, { status });
  }
}
