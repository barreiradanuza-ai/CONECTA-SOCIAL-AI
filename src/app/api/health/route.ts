import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const worker = await db.taskState.findUnique({ where: { name: "publish.enqueue" } });
    const workerOk = !!worker?.lastRunAt && Date.now() - worker.lastRunAt.getTime() < 3 * 60_000;
    return NextResponse.json({ ok: true, db: "ok", worker: workerOk ? "ok" : "sem sinal", time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "erro" }, { status: 503 });
  }
}
