/**
 * Extracts individual PDFs from a 7z/zip archive stored in MinIO,
 * renames them with the order reference, and re-uploads individually.
 *
 * Naming convention:
 *   {referenceCode}-{archiveBaseName}-{originalFilename}.pdf
 *   e.g. 2026-00018-SO11049112-CMC-500-Safe-Use-ENU12590202.pdf
 */
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import unzipper from "unzipper"
import { writeFile, readFile, readdir, rm, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"

import { s3, ORDERS_BUCKET, S3_PUBLIC_URL } from "./s3"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sevenZip = require("7zip-min") as {
  config: (opts: { binaryPath: string }) => void
  unpack: (src: string, dest: string, cb: (err: Error | null) => void) => void
}
if (process.platform === "linux") {
  const linuxBin = ["/usr/bin/7zz", "/usr/bin/7z"].find((p) => {
    try { require("fs").accessSync(p, require("fs").constants.X_OK); return true } catch { return false }
  })
  if (linuxBin) sevenZip.config({ binaryPath: linuxBin })
} else if (process.platform === "darwin") {
  const darwinBin = ["/opt/homebrew/bin/7zz", "/usr/local/bin/7zz"].find((p) => {
    try { require("fs").accessSync(p, require("fs").constants.X_OK); return true } catch { return false }
  })
  if (darwinBin) sevenZip.config({ binaryPath: darwinBin })
}

export type ExtractedPdfItem = {
  /** Original filename inside the archive */
  originalFilename: string
  /** Renamed filename stored in MinIO */
  pdfFileName: string
  /** Public URL of the extracted PDF in MinIO */
  pdfUrl: string
  /** MinIO storage key */
  storageKey: string
}

/**
 * Builds the renamed PDF filename: {refCode}-{archiveBase}-{originalName}.pdf
 * Sanitises all segments so the filename is safe for FTP transfer.
 */
export function buildPdfFileName(referenceCode: string, archiveName: string, originalFilename: string): string {
  const archiveBase = archiveName.replace(/\.(7z|zip)$/i, "")
  const originalBase = originalFilename.replace(/\.pdf$/i, "")
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/__+/g, "_").replace(/^_|_$/g, "")
  return `${safe(referenceCode)}-${safe(archiveBase)}-${safe(originalBase)}.pdf`
}

/** Download a file from the orders bucket into a Buffer. */
async function downloadFromOrders(storageKey: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: ORDERS_BUCKET, Key: storageKey }))
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/** Extract PDFs from a .7z buffer, returning {filename, buffer} pairs. */
export async function extract7zBuffer(buffer: Buffer): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const id = randomUUID()
  const archivePath = join(tmpdir(), `${id}.7z`)
  const extractDir = join(tmpdir(), `${id}-ex`)
  try {
    await writeFile(archivePath, buffer)
    await new Promise<void>((resolve, reject) =>
      sevenZip.unpack(archivePath, extractDir, (err: Error | null) => (err ? reject(err) : resolve()))
    )
    const allFiles = await readdir(extractDir, { recursive: true })
    const results: Array<{ filename: string; buffer: Buffer }> = []
    for (const rel of allFiles as string[]) {
      if (!rel.toLowerCase().endsWith(".pdf") || rel.includes("__MACOSX")) continue
      const buf = await readFile(join(extractDir, rel))
      results.push({ filename: rel.split(/[\\/]/).pop() ?? rel, buffer: buf })
    }
    return results
  } finally {
    await unlink(archivePath).catch(() => {})
    await rm(extractDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Extract PDFs from a .zip buffer, returning {filename, buffer} pairs. */
export async function extractZipBuffer(buffer: Buffer): Promise<Array<{ filename: string; buffer: Buffer }>> {
  const dir = await unzipper.Open.buffer(buffer)
  const results: Array<{ filename: string; buffer: Buffer }> = []
  for (const entry of dir.files) {
    if (!entry.path.toLowerCase().endsWith(".pdf") || entry.path.startsWith("__MACOSX") || entry.type !== "File") continue
    const buf = await entry.buffer()
    results.push({ filename: entry.path.split("/").pop() ?? entry.path, buffer: buf })
  }
  return results
}

/**
 * Given a PdfOrderItem whose storagePath points to a 7z/zip archive in MinIO,
 * extracts the specific PDF for that item, renames it, uploads it, and returns
 * the public URL and filename.
 *
 * If the item already has a pdfUrl, returns null (already extracted).
 */
export async function extractAndUploadPdfItem(params: {
  referenceCode: string
  archiveStorageKey: string
  archiveName: string
  originalFilename: string
}): Promise<ExtractedPdfItem> {
  const { referenceCode, archiveStorageKey, archiveName, originalFilename } = params

  const archiveBuffer = await downloadFromOrders(archiveStorageKey)
  const isZip = archiveName.toLowerCase().endsWith(".zip")
  const is7z = archiveName.toLowerCase().endsWith(".7z")

  let pdfs: Array<{ filename: string; buffer: Buffer }> = []
  if (is7z) {
    pdfs = await extract7zBuffer(archiveBuffer)
  } else if (isZip) {
    pdfs = await extractZipBuffer(archiveBuffer)
  } else {
    // Already a PDF — the archive IS the PDF
    pdfs = [{ filename: archiveName, buffer: archiveBuffer }]
  }

  const match = pdfs.find((p) => p.filename === originalFilename)
  if (!match) {
    throw new Error(`PDF "${originalFilename}" not found in archive "${archiveName}"`)
  }

  const pdfFileName = buildPdfFileName(referenceCode, archiveName, originalFilename)
  const storageKey = `${referenceCode}/pdfs/${pdfFileName}`

  await s3.send(new PutObjectCommand({
    Bucket: ORDERS_BUCKET,
    Key: storageKey,
    Body: match.buffer,
    ContentType: "application/pdf",
    Metadata: {
      referenceCode,
      sourceArchive: archiveName,
      originalFilename,
    },
  }))

  const pdfUrl = `${S3_PUBLIC_URL}/${ORDERS_BUCKET}/${storageKey}`
  return { originalFilename, pdfFileName, pdfUrl, storageKey }
}
