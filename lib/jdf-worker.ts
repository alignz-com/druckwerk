import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import ftp from "basic-ftp";
import { prisma } from "./prisma";

export type JdfExportJob = {
  id: string;
  orderId: string;
  pdfOrderItemId: string | null;
  pdfUrl: string | null;
  jdfFileName: string | null;
  jdfXml: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  attemptCount: number;
  lastError: string | null;
};

export type JdfWorkerConfig = {
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
  const jobs = await fetchPendingJobs(config);
  const processed: JdfWorkerResult[] = [];

  for (const job of jobs) {
    const locked = await lockJob(job.id);
    if (!locked) {
      processed.push({ id: job.id, status: "SKIPPED", attempts: job.attemptCount });
      continue;
    }

    try {
      await processJob(locked, config);
      processed.push({ id: locked.id, status: "COMPLETED", attempts: locked.attemptCount + 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failJob(locked, config, message);
      processed.push({ id: locked.id, status: "FAILED", attempts: locked.attemptCount + 1, error: message });
    }
  }

  return processed;
}

async function fetchPendingJobs(config: JdfWorkerConfig) {
  return prisma.jdfExportJob.findMany({
    where: { status: "PENDING", attemptCount: { lt: config.maxAttempts } },
    orderBy: { createdAt: "asc" },
    take: config.batchSize,
  }) as unknown as Promise<JdfExportJob[]>;
}

async function lockJob(jobId: string): Promise<JdfExportJob | null> {
  try {
    const locked = await prisma.jdfExportJob.updateMany({
      where: { id: jobId, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (locked.count === 0) return null;
    return prisma.jdfExportJob.findUnique({ where: { id: jobId } }) as unknown as Promise<JdfExportJob>;
  } catch (error) {
    console.warn("[jdf-worker] failed to lock job", jobId, error);
    return null;
  }
}

async function processJob(job: JdfExportJob, config: JdfWorkerConfig) {
  if (job.pdfUrl) {
    const pdfReady = await waitForPdf(job.pdfUrl, config);
    if (!pdfReady) {
      throw new Error("PDF not reachable within timeout");
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: job.orderId },
    select: { referenceCode: true },
  });
  const fileName = job.jdfFileName ?? `${order?.referenceCode ?? job.orderId}.jdf`;

  await uploadToFtp(job.jdfXml, fileName, config);

  await prisma.jdfExportJob.update({
    where: { id: job.id },
    data: { status: "COMPLETED", attemptCount: job.attemptCount + 1, lastError: null },
  });
}

async function failJob(job: JdfExportJob, config: JdfWorkerConfig, message: string) {
  const attemptCount = job.attemptCount + 1;
  const status = attemptCount >= config.maxAttempts ? "FAILED" : "PENDING";
  await prisma.jdfExportJob.update({
    where: { id: job.id },
    data: { status, attemptCount, lastError: message },
  });
}

async function waitForPdf(url: string, config: JdfWorkerConfig) {
  const start = Date.now();
  while (Date.now() - start < config.pdfTimeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return true;
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
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

function intFromEnv(key: string, defaultValue: number) {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
