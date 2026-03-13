import { NextRequest, NextResponse } from "next/server"
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef, PDFNumber, PDFRawStream } from "pdf-lib"
import unzipper from "unzipper"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sevenZip = require("7zip-min") as {
  config: (opts: { binaryPath: string }) => void
  unpack: (src: string, dest: string, cb: (err: Error | null) => void) => void
}
// Use system 7zz binary where the bundled one won't work.
// Linux (Docker/Synology): Dockerfile must include: apk add --no-cache poppler-utils p7zip qpdf
// macOS (dev): install via `brew install 7-zip`
if (process.platform === "linux") {
  sevenZip.config({ binaryPath: "/usr/bin/7zz" })
} else if (process.platform === "darwin") {
  // Apple Silicon or Intel Homebrew locations
  const darwinBin = ["/opt/homebrew/bin/7zz", "/usr/local/bin/7zz"].find((p) => {
    try { require("fs").accessSync(p, require("fs").constants.X_OK); return true } catch { return false }
  })
  if (darwinBin) sevenZip.config({ binaryPath: darwinBin })
}
import { execFile } from "child_process"
import { promisify } from "util"
import { writeFile, readFile, unlink, readdir, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { randomUUID } from "crypto"

const execFileAsync = promisify(execFile)
const PT_TO_MM = 25.4 / 72

export type PdfFileInfo = {
  filename: string
  pages: number
  trimWidthMm: number
  trimHeightMm: number
  trimSource: "TrimBox" | "MediaBox"
  bleedMm: number | null
  colorSpaces: string[]
  pantoneColors: string[]
  thumbnailDataUrl?: string
  fromZip?: string
  error?: string
}

async function extractColorInfo(
  pdfDoc: PDFDocument,
  rawBuffer: Buffer,
): Promise<{ colorSpaces: string[]; pantoneColors: string[] }> {
  try {
    const colorSpaces = new Set<string>()
    const pantoneColors = new Set<string>()
    const context = pdfDoc.context

    function resolve(obj: unknown): unknown {
      return obj instanceof PDFRef ? context.lookup(obj) : obj
    }

    function inspectCs(obj: unknown) {
      const r = resolve(obj)
      if (r instanceof PDFName) {
        const n = r.asString()
        if (n === "DeviceCMYK") colorSpaces.add("CMYK")
        else if (n === "DeviceRGB") colorSpaces.add("RGB")
        else if (n === "DeviceGray") colorSpaces.add("Grayscale")
        return
      }
      if (!(r instanceof PDFArray)) return
      const first = resolve(r.get(0))
      if (!(first instanceof PDFName)) return
      switch (first.asString()) {
        case "DeviceCMYK": colorSpaces.add("CMYK"); break
        case "DeviceRGB":  colorSpaces.add("RGB");  break
        case "DeviceGray": colorSpaces.add("Grayscale"); break
        case "ICCBased": {
          const stream = resolve(r.get(1))
          if (stream instanceof PDFRawStream) {
            const n = stream.dict.get(PDFName.of("N"))
            if (n instanceof PDFNumber) {
              const ch = n.asNumber()
              if (ch === 4) colorSpaces.add("CMYK")
              else if (ch === 3) colorSpaces.add("RGB")
              else if (ch === 1) colorSpaces.add("Grayscale")
            }
          }
          break
        }
        case "Separation": {
          const nameObj = resolve(r.get(1))
          if (nameObj instanceof PDFName) {
            const name = nameObj.asString()
            if (name !== "None" && name !== "All") {
              colorSpaces.add("Spot")
              if (/pantone/i.test(name)) pantoneColors.add(name)
            }
          }
          break
        }
        case "DeviceN": {
          const comps = resolve(r.get(1))
          if (comps instanceof PDFArray) {
            for (let i = 0; i < comps.size(); i++) {
              const comp = resolve(comps.get(i))
              if (comp instanceof PDFName) {
                const name = comp.asString()
                if (!["Cyan", "Magenta", "Yellow", "Black", "None", "All"].includes(name)) {
                  colorSpaces.add("Spot")
                  if (/pantone/i.test(name)) pantoneColors.add(name)
                }
              }
            }
          }
          break
        }
      }
    }

    function inspectResourcesDict(res: PDFDict) {
      const csEntry = res.get(PDFName.of("ColorSpace"))
      if (!csEntry) return
      const resolved = resolve(csEntry)
      if (resolved instanceof PDFDict) {
        for (const [, val] of resolved.entries()) inspectCs(val)
      } else {
        inspectCs(csEntry)
      }
    }

    for (let i = 0; i < Math.min(pdfDoc.getPageCount(), 10); i++) {
      try {
        const res = pdfDoc.getPage(i).node.Resources()
        if (res) inspectResourcesDict(res)
      } catch { /* skip page */ }
    }

    let objCount = 0
    for (const [, obj] of context.enumerateIndirectObjects()) {
      if (++objCount > 5000) break
      const dict: PDFDict | null =
        obj instanceof PDFDict ? obj :
        obj instanceof PDFRawStream ? obj.dict :
        null
      if (!dict) continue

      const csEntry = dict.get(PDFName.of("ColorSpace"))
      if (csEntry) {
        const resolved = resolve(csEntry)
        if (resolved instanceof PDFDict) {
          for (const [, val] of resolved.entries()) inspectCs(val)
        } else {
          inspectCs(csEntry)
        }
      }

      const resourcesEntry = dict.get(PDFName.of("Resources"))
      if (resourcesEntry) {
        const res = resolve(resourcesEntry)
        if (res instanceof PDFDict) inspectResourcesDict(res)
      }
    }

    const text = rawBuffer.toString("latin1")
    if (/\/DeviceCMYK/i.test(text)) colorSpaces.add("CMYK")
    if (/\/DeviceRGB/i.test(text))  colorSpaces.add("RGB")
    if (/\/DeviceGray/i.test(text)) colorSpaces.add("Grayscale")

    function decodePdfName(name: string): string {
      return name.replace(/#([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    }
    const sepRegex = /\/Separation\s*\/([^\s/\[\]<>(){}]+)/g
    let m
    while ((m = sepRegex.exec(text)) !== null) {
      const name = decodePdfName(m[1])
      if (name !== "None" && name !== "All") {
        colorSpaces.add("Spot")
        if (/pantone/i.test(name)) pantoneColors.add(name)
      }
    }
    const devNRegex = /\/DeviceN\s*\[([^\]]+)\]/g
    while ((m = devNRegex.exec(text)) !== null) {
      const nameRegex = /\/([^\s/\[\]<>(){}]+)/g
      let nm
      while ((nm = nameRegex.exec(m[1])) !== null) {
        const name = decodePdfName(nm[1])
        if (!["Cyan", "Magenta", "Yellow", "Black", "None", "All"].includes(name)) {
          colorSpaces.add("Spot")
          if (/pantone/i.test(name)) pantoneColors.add(name)
        }
      }
    }

    const QPDF_MAX_BYTES = 15 * 1024 * 1024
    if (!colorSpaces.has("CMYK") && !colorSpaces.has("RGB") && !colorSpaces.has("Grayscale")
        && rawBuffer.length < QPDF_MAX_BYTES) {
      const id = randomUUID()
      const pdfPath = join(tmpdir(), `${id}-qpdf.pdf`)
      try {
        await writeFile(pdfPath, rawBuffer)
        const { stdout } = await execFileAsync(
          "qpdf", ["--json", "--json-key=objects", "--json-stream-data=none", pdfPath],
          { maxBuffer: 64 * 1024 * 1024, timeout: 20_000 }
        )
        if (/DeviceCMYK/i.test(stdout)) colorSpaces.add("CMYK")
        if (/DeviceRGB/i.test(stdout))  colorSpaces.add("RGB")
        if (/DeviceGray/i.test(stdout)) colorSpaces.add("Grayscale")
        const qSepRegex = /"\/Separation"\s*,\s*"(\/[^"]+)"/g
        let qm
        while ((qm = qSepRegex.exec(stdout)) !== null) {
          const name = qm[1].slice(1)
          if (name !== "None" && name !== "All") {
            colorSpaces.add("Spot")
            if (/pantone/i.test(name)) pantoneColors.add(name)
          }
        }
      } catch { /* qpdf not available, timed out, or failed */ }
      finally { await unlink(pdfPath).catch(() => {}) }
    }

    return { colorSpaces: Array.from(colorSpaces), pantoneColors: Array.from(pantoneColors) }
  } catch {
    return { colorSpaces: [], pantoneColors: [] }
  }
}

type BoxRect = { x: number; y: number; width: number; height: number }

async function generateThumbnail(
  pdfBuffer: Buffer,
  trimBox?: BoxRect,
  mediaBox?: BoxRect
): Promise<string | undefined> {
  const id = randomUUID()
  const pdfPath = join(tmpdir(), `${id}.pdf`)
  const thumbBase = join(tmpdir(), `${id}-thumb`)
  const thumbPath = `${thumbBase}.jpg`

  try {
    await writeFile(pdfPath, pdfBuffer)

    const DPI = 150
    const scale = DPI / 72
    const args = ["-jpeg", "-r", String(DPI), "-singlefile"]

    if (trimBox && mediaBox) {
      const px = Math.round(trimBox.x * scale)
      const py = Math.round((mediaBox.height - trimBox.y - trimBox.height) * scale)
      const pw = Math.round(trimBox.width * scale)
      const ph = Math.round(trimBox.height * scale)
      args.push("-x", String(px), "-y", String(py), "-W", String(pw), "-H", String(ph))
    } else {
      args.push("-cropbox")
    }

    args.push(pdfPath, thumbBase)
    await execFileAsync("pdftocairo", args)
    const jpgBuffer = await readFile(thumbPath)
    return `data:image/jpeg;base64,${jpgBuffer.toString("base64")}`
  } catch {
    return undefined
  } finally {
    await unlink(pdfPath).catch(() => {})
    await unlink(thumbPath).catch(() => {})
  }
}

async function analyzePdf(buffer: Buffer, filename: string): Promise<PdfFileInfo> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pages = pdfDoc.getPageCount()
    const page = pdfDoc.getPage(0)
    const trimBox = page.getTrimBox()
    const bleedBox = page.getBleedBox()
    const box = trimBox ?? page.getMediaBox()

    let bleedMm: number | null = null
    if (trimBox && bleedBox) {
      const bleedPt = Math.min(trimBox.x - bleedBox.x, trimBox.y - bleedBox.y)
      bleedMm = bleedPt > 0 ? Math.round(bleedPt * PT_TO_MM * 10) / 10 : 0
    }

    const mediaBox = page.getMediaBox()
    const { colorSpaces, pantoneColors } = await extractColorInfo(pdfDoc, buffer)
    const thumbnailDataUrl = await generateThumbnail(buffer, trimBox ?? undefined, mediaBox)

    return {
      filename,
      pages,
      trimWidthMm: Math.round(box.width * PT_TO_MM * 10) / 10,
      trimHeightMm: Math.round(box.height * PT_TO_MM * 10) / 10,
      trimSource: trimBox ? "TrimBox" : "MediaBox",
      bleedMm,
      colorSpaces,
      pantoneColors,
      thumbnailDataUrl,
    }
  } catch (err) {
    return {
      filename,
      pages: 0,
      trimWidthMm: 0,
      trimHeightMm: 0,
      trimSource: "MediaBox",
      bleedMm: null,
      colorSpaces: [],
      pantoneColors: [],
      error: err instanceof Error ? err.message : "Failed to parse PDF",
    }
  }
}

async function extract7z(buffer: Buffer, archiveName: string): Promise<PdfFileInfo[]> {
  const id = randomUUID()
  const archivePath = join(tmpdir(), `${id}.7z`)
  const extractDir = join(tmpdir(), `${id}-extracted`)

  try {
    await writeFile(archivePath, buffer)
    await new Promise<void>((resolve, reject) =>
      sevenZip.unpack(archivePath, extractDir, (err: Error | null) =>
        err ? reject(err) : resolve()
      )
    )

    const allFiles = await readdir(extractDir, { recursive: true })
    const pdfFiles = (allFiles as string[]).filter(
      (f) => f.toLowerCase().endsWith(".pdf") && !f.includes("__MACOSX")
    )

    const results: PdfFileInfo[] = []
    for (const relPath of pdfFiles) {
      const fullPath = join(extractDir, relPath)
      const pdfBuffer = await readFile(fullPath)
      const filename = relPath.split(/[\\/]/).pop() ?? relPath
      const info = await analyzePdf(pdfBuffer, filename)
      results.push({ ...info, fromZip: archiveName })
    }
    return results
  } finally {
    await unlink(archivePath).catch(() => {})
    await rm(extractDir, { recursive: true, force: true }).catch(() => {})
  }
}

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll("files") as File[]
    const results: PdfFileInfo[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const name = file.name.toLowerCase()

      if (name.endsWith(".pdf")) {
        results.push(await analyzePdf(buffer, file.name))
      } else if (name.endsWith(".zip")) {
        const dir = await unzipper.Open.buffer(buffer)
        const pdfEntries = dir.files.filter(
          (f: { path: string; type: string }) => f.path.toLowerCase().endsWith(".pdf") && !f.path.startsWith("__MACOSX") && f.type === "File"
        )
        for (const entry of pdfEntries) {
          const pdfBuffer = await entry.buffer()
          const filename = entry.path.split("/").pop() ?? entry.path
          const info = await analyzePdf(pdfBuffer, filename)
          results.push({ ...info, fromZip: file.name })
        }
      } else if (name.endsWith(".7z")) {
        try {
          const extracted = await extract7z(buffer, file.name)
          results.push(...extracted)
        } catch (err) {
          results.push({
            filename: file.name,
            pages: 0,
            trimWidthMm: 0,
            trimHeightMm: 0,
            trimSource: "MediaBox",
            bleedMm: null,
            colorSpaces: [],
            pantoneColors: [],
            error: err instanceof Error ? err.message : "Failed to extract .7z archive",
          })
        }
      }
    }

    return NextResponse.json({ files: results })
  } catch (err) {
    console.error("[pdf-process] unhandled error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
