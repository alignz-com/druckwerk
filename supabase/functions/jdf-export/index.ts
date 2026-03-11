import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import ftp from "npm:basic-ftp";
import { Buffer } from "node:buffer";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FTP_HOST = Deno.env.get("PRINTER_FTP_HOST")!;
const FTP_USER = Deno.env.get("PRINTER_FTP_USER")!;
const FTP_PASSWORD = Deno.env.get("PRINTER_FTP_PASSWORD")!;
const FTP_BASE_PATH = Deno.env.get("PRINTER_FTP_BASE_PATH") || "";

const BATCH_SIZE = Number(Deno.env.get("JDF_WORKER_BATCH_SIZE") ?? "5");
const MAX_ATTEMPTS = Number(Deno.env.get("JDF_WORKER_MAX_ATTEMPTS") ?? "5");
const PDF_TIMEOUT_MS = Number(Deno.env.get("JDF_WORKER_PDF_TIMEOUT_MS") ?? "60000");
const PDF_POLL_INTERVAL_MS = Number(Deno.env.get("JDF_WORKER_PDF_POLL_MS") ?? "5000");

type JdfExportJob = {
  id: string;
  orderId: string;
  pdfUrl: string;
  jdfXml: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
};

const supabaseFactory = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase configuration", { status: 500 });
  }
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    return new Response("Missing FTP configuration", { status: 500 });
  }

  const supabase = supabaseFactory();
  const jobs = await fetchPendingJobs(supabase);

  const processed: Array<{ id: string; status: string }> = [];

  for (const job of jobs) {
    const locked = await lockJob(supabase, job.id);
    if (!locked) continue;

    try {
      await processJob(supabase, locked);
      processed.push({ id: locked.id, status: "COMPLETED" });
    } catch (error) {
      console.error("[jdf-worker] job failed", locked.id, error);
      await failJob(supabase, locked.id, locked.attemptCount + 1, error instanceof Error ? error.message : String(error));
      processed.push({ id: locked.id, status: "FAILED" });
    }
  }

  return new Response(
    JSON.stringify({
      processed,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

async function fetchPendingJobs(supabase: ReturnType<typeof supabaseFactory>) {
  const { data, error } = await supabase
    .from("JdfExportJob")
    .select("*")
    .eq("status", "PENDING")
    .lt("attemptCount", MAX_ATTEMPTS)
    .order("createdAt", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[jdf-worker] failed to load jobs", error);
    return [];
  }

  return (data as JdfExportJob[]) ?? [];
}

async function lockJob(supabase: ReturnType<typeof supabaseFactory>, jobId: string) {
  const { data, error } = await supabase
    .from("JdfExportJob")
    .update({
      status: "PROCESSING",
      updatedAt: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "PENDING")
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }
  return data as JdfExportJob;
}

async function processJob(supabase: ReturnType<typeof supabaseFactory>, job: JdfExportJob) {
  const pdfReady = await waitForPdf(job.pdfUrl);
  if (!pdfReady) {
    throw new Error("PDF not reachable within timeout");
  }

  await uploadToFtp(job.jdfXml, `${job.orderId}.jdf`);

  const { error } = await supabase
    .from("JdfExportJob")
    .update({
      status: "COMPLETED",
      attemptCount: job.attemptCount + 1,
      lastError: null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (error) {
    console.error("[jdf-worker] failed to mark job completed", job.id, error);
  }
}

async function failJob(supabase: ReturnType<typeof supabaseFactory>, id: string, attemptCount: number, message: string) {
  const status = attemptCount >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
  const { error } = await supabase
    .from("JdfExportJob")
    .update({
      status,
      attemptCount,
      lastError: message,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[jdf-worker] failed to update failed job", id, error);
  }
}

async function waitForPdf(url: string) {
  const start = Date.now();
  while (Date.now() - start < PDF_TIMEOUT_MS) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return true;
    } catch (error) {
      console.warn("[jdf-worker] pdf HEAD failed", error);
    }
    await delay(PDF_POLL_INTERVAL_MS);
  }
  return false;
}

async function uploadToFtp(jdfXml: string, fileName: string) {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,
    });

    if (FTP_BASE_PATH) {
      await client.ensureDir(FTP_BASE_PATH);
    }

    const data = new TextEncoder().encode(jdfXml);
    await client.uploadFrom(Buffer.from(data), fileName);
  } finally {
    client.close();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
