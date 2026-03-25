/**
 * Font sync: keeps local system fonts in sync with MinIO fonts bucket
 * so that pdftocairo (poppler) can render text with the correct typography.
 *
 * - syncAllFonts(): downloads all TTF/OTF from MinIO to /tmp/druckwerk-fonts/
 * - installFont(): installs a single font file locally
 * - removeFont(): removes a single font file locally
 * - All functions call fc-cache after changes.
 */
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3"
import { s3, FONT_BUCKET } from "@/lib/s3"
import { execFile } from "child_process"
import { promisify } from "util"
import { writeFile, unlink, mkdir, readdir } from "fs/promises"
import { join } from "path"
import { Readable } from "stream"

const execFileAsync = promisify(execFile)

import { homedir } from "os"

// ~/.fonts is scanned by fontconfig by default — no extra config needed
const FONT_DIR = join(homedir(), ".fonts", "druckwerk")
const INSTALLABLE_EXTENSIONS = [".ttf", ".otf"]

async function ensureFontDir() {
  await mkdir(FONT_DIR, { recursive: true })
}

async function refreshFontCache() {
  try {
    await execFileAsync("fc-cache", ["-f", FONT_DIR], { timeout: 10_000 })
  } catch (err) {
    console.warn("[font-sync] fc-cache failed (fonts may still work):", err)
  }
}

function isInstallable(key: string): boolean {
  const lower = key.toLowerCase()
  return INSTALLABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function keyToFilename(key: string): string {
  // e.g. "bau-pro/400.ttf" → "bau-pro--400.ttf"
  return key.replace(/\//g, "--")
}

/**
 * Download a single S3 object as a Buffer.
 */
async function downloadObject(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: FONT_BUCKET, Key: key }))
  const stream = res.Body as Readable
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Sync all TTF/OTF fonts from MinIO to the local font directory.
 * Called on startup / first thumbnail generation.
 */
export async function syncAllFonts(): Promise<number> {
  await ensureFontDir()

  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: FONT_BUCKET,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key && isInstallable(obj.Key)) {
        keys.push(obj.Key)
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  let installed = 0
  await Promise.all(
    keys.map(async (key) => {
      try {
        const buffer = await downloadObject(key)
        const localPath = join(FONT_DIR, keyToFilename(key))
        await writeFile(localPath, buffer)
        installed++
      } catch (err) {
        console.error(`[font-sync] failed to download ${key}:`, err)
      }
    })
  )

  await refreshFontCache()
  console.log(`[font-sync] synced ${installed}/${keys.length} fonts to ${FONT_DIR}`)
  return installed
}

/**
 * Install a single font after upload. Call from the font upload API route.
 */
export async function installFont(storageKey: string, data: Uint8Array): Promise<void> {
  if (!isInstallable(storageKey)) return
  await ensureFontDir()
  const localPath = join(FONT_DIR, keyToFilename(storageKey))
  await writeFile(localPath, data)
  await refreshFontCache()
}

/**
 * Remove a single font after deletion. Call from the font delete API route.
 */
export async function removeFont(storageKey: string): Promise<void> {
  if (!isInstallable(storageKey)) return
  const localPath = join(FONT_DIR, keyToFilename(storageKey))
  await unlink(localPath).catch(() => {})
  await refreshFontCache()
}

// Track whether initial sync has run
let _synced = false

/**
 * Ensure fonts are synced at least once. Safe to call multiple times.
 */
export async function ensureFontsSynced(): Promise<void> {
  if (_synced) return
  _synced = true
  try {
    await syncAllFonts()
  } catch (err) {
    _synced = false
    console.error("[font-sync] initial sync failed:", err)
  }
}
