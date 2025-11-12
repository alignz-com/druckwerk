import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ftp from "basic-ftp";

export type JdfExportJob = {
  id: string;
  orderId: string;
  pdfUrl: string;
  jdfXml: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  attemptCount: number;
  lastError: string | null;
};

export type JdfWorkerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  ftpHost: string;
  ftpUser: string;
  ftpPassword: string;
  ftpBasePath?: string;
  batchSize: number;
  maxAttempts: number;
  pdfTimeoutMs: number;
  pdfPollIntervalMs: number;
};

export type JdfWorkerResult = {
  id: string;
  status: "COMPLETED" | "FAILED" | "SKIPPED";
  attempts: number;
  error?: string | null;
};

export function buildJdfWorkerConfigFromEnv(): JdfWorkerConfig {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ftpHost: requireEnv("PRINTER_FTP_HOST"),
    ftpUser: requireEnv("PRINTER_FTP_USER"),
    ftpPassword: requireEnv("PRINTER_FTP_PASSWORD"),
    ftpBasePath: process.env.PRINTER_FTP_BASE_PATH,
    batchSize: intFromEnv("JDF_WORKER_BATCH_SIZE", 5),
    maxAttempts: intFromEnv("JDF_WORKER_MAX_ATTEMPTS", 5),
    pdfTimeoutMs: intFromEnv("JDF_WORKER_PDF_TIMEOUT_MS", 60_000),
    pdfPollIntervalMs: intFromEnv("JDF_WORKER_PDF_POLL_MS", 5000),
  };
}

export async function runJdfWorker(config: JdfWorkerConfig): Promise<JdfWorkerResult[]> {
  const supabase = createAdminClient(config);
  const jobs = await fetchPendingJobs(supabase, config);

  const processed: JdfWorkerResult[] = [];

  for (const job of jobs) {
    const locked = await lockJob(supabase, job.id);
    if (!locked) {
      processed.push({
        id: job.id,
        status: "SKIPPED",
        attempts: job.attemptCount,
      });
      continue;
    }

    try {
      await processJob(supabase, locked, config);
      processed.push({
        id: locked.id,
        status: "COMPLETED",
        attempts: locked.attemptCount + 1,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(supabase, locked, config, message);
      processed.push({
        id: locked.id,
        status: "FAILED",
        attempts: locked.attemptCount + 1,
        error: message,
      });
    }
  }

  return processed;
}

function createAdminClient(config: JdfWorkerConfig) {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function fetchPendingJobs(supabase: SupabaseClient, config: JdfWorkerConfig) {
  const { data, error } = await supabase
    .from("JdfExportJob")
    .select("*")
    .eq("status", "PENDING")
    .lt("attemptCount", config.maxAttempts)
    .order("createdAt", { ascending: true })
    .limit(config.batchSize);

  if (error) {
    console.error("[jdf-worker] failed to fetch jobs", error);
    return [];
  }

  return (data as JdfExportJob[]) ?? [];
}

async function lockJob(supabase: SupabaseClient, jobId: string) {
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
    if (error) {
      console.warn("[jdf-worker] failed to lock job", jobId, error);
    }
    return null;
  }

  return data as JdfExportJob;
}

async function processJob(supabase: SupabaseClient, job: JdfExportJob, config: JdfWorkerConfig) {
  const pdfReady = await waitForPdf(job.pdfUrl, config);
  if (!pdfReady) {
    throw new Error("PDF not reachable within timeout");
  }

  await uploadToFtp(job.jdfXml, `${job.orderId}.jdf`, config);

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

async function failJob(supabase: SupabaseClient, job: JdfExportJob, config: JdfWorkerConfig, message: string) {
  const attemptCount = job.attemptCount + 1;
  const status = attemptCount >= config.maxAttempts ? "FAILED" : "PENDING";
  const { error } = await supabase
    .from("JdfExportJob")
    .update({
      status,
      attemptCount,
      lastError: message,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (error) {
    console.error("[jdf-worker] failed to update failed job", job.id, error);
  }
}

async function waitForPdf(url: string, config: JdfWorkerConfig) {
  const start = Date.now();
  while (Date.now() - start < config.pdfTimeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.warn("[jdf-worker] pdf HEAD failed", error);
    }
    await delay(config.pdfPollIntervalMs);
  }
  return false;
}

async function uploadToFtp(jdfXml: string, fileName: string, config: JdfWorkerConfig) {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.ftpHost,
      user: config.ftpUser,
      password: config.ftpPassword,
      secure: false,
    });

    const basePath = config.ftpBasePath?.trim();
    if (basePath) {
      await client.ensureDir(basePath);
    }

    const data = Buffer.from(jdfXml, "utf-8");
    await client.uploadFrom(Readable.from([data]), fileName);
  } finally {
    client.close();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set`);
  }
  return value;
}

function intFromEnv(key: string, defaultValue: number) {
  const raw = process.env[key];
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
