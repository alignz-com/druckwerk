import { Client } from "basic-ftp";
import { Readable } from "node:stream";

export type PrinterFtpResult =
  | { status: "skipped"; reason: string }
  | { status: "uploaded" }
  | { status: "failed"; error: string };

function getFtpConfig() {
  const host = process.env.PRINTER_FTP_HOST;
  const user = process.env.PRINTER_FTP_USER;
  const password = process.env.PRINTER_FTP_PASSWORD;
  if (!host || !user || !password) {
    return null;
  }
  const port = process.env.PRINTER_FTP_PORT ? Number(process.env.PRINTER_FTP_PORT) : 21;
  const secure = process.env.PRINTER_FTP_SECURE === "true";
  const basePath = process.env.PRINTER_FTP_BASE_PATH ?? "";
  return { host, user, password, port, secure, basePath };
}

export async function uploadJdfToPrinterFtp(content: Buffer, remoteFileName: string): Promise<PrinterFtpResult> {
  const config = getFtpConfig();
  if (!config) {
    return { status: "skipped", reason: "Missing FTP configuration" };
  }

  const client = new Client();
  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      secure: config.secure,
    });

    if (config.basePath) {
      await client.ensureDir(config.basePath);
      await client.cd(config.basePath);
    }

    const segments = remoteFileName.split("/").filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) {
      return { status: "failed", error: "Invalid remote file name" };
    }
    for (const segment of segments) {
      await client.ensureDir(segment);
      await client.cd(segment);
    }

    const readable = Readable.from(content);
    await client.uploadFrom(readable, fileName);
    return { status: "uploaded" };
  } catch (error: any) {
    console.error("[ftp] upload failed", error);
    return { status: "failed", error: error?.message ?? "Unknown FTP error" };
  } finally {
    client.close();
  }
}
