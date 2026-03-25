import { NextResponse } from "next/server";
import { buildJdfWorkerConfigFromEnv, runJdfWorker } from "@/lib/jdf-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorize(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const config = buildJdfWorkerConfigFromEnv();
    const processed = await runJdfWorker(config);
    return NextResponse.json({ processed });
  } catch (error) {
    console.error("[api/jdf-worker] failed", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export const POST = GET;

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.JDF_WORKER_SECRET;
  if (!secret) {
    console.error("[api/jdf-worker] missing CRON_SECRET env");
    return new Response("Server misconfigured", { status: 500 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
