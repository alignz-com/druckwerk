"use client"

import * as React from "react"
import { useDropzone } from "react-dropzone"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FileTextIcon, UploadCloudIcon, XIcon, ArchiveIcon, GripVerticalIcon } from "lucide-react"
import type { PdfFileInfo } from "@/app/api/pdf-process/route"
import { Badge } from "@/components/ui/badge"
import pantoneColors from "pantone-colors"

export type SortableFile = PdfFileInfo & {
  id: string
  quantity: number
  /** Original File object for direct PDFs, or the parent archive for ZIP-extracted files */
  _sourceFile?: File
}

function SortableRow({
  file,
  onRemove,
  onQuantityChange,
  isSelected,
  onSelect,
}: {
  file: SortableFile
  onRemove: (id: string) => void
  onQuantityChange: (id: string, qty: number) => void
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(file.id)}
      className={`border-b last:border-0 cursor-pointer transition-colors ${
        isSelected ? "bg-muted" : "hover:bg-muted/40"
      }`}
    >
      <td className="px-2 py-3 w-8">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVerticalIcon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {file.fromZip && (
            <ArchiveIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-sm truncate max-w-[200px]">{file.filename}</span>
        </div>
        {file.fromZip && (
          <p className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5 pl-5">
            {file.fromZip}
          </p>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {file.error ? (
          <span className="text-destructive text-xs">{file.error}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {file.trimWidthMm} × {file.trimHeightMm} mm
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {file.colorSpaces
            .filter((cs) => cs !== "Grayscale" || (!file.colorSpaces.includes("CMYK") && !file.colorSpaces.includes("RGB")))
            .map((cs) => (
              <ColorSpaceBadge key={cs} cs={cs} />
            ))}
        </div>
      </td>
      <td className="px-3 py-3 w-24" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min={1}
          value={file.quantity}
          onChange={(e) => onQuantityChange(file.id, Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded border border-input bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </td>
      <td className="px-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onRemove(file.id)}
          className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove file"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

const COLOR_SPACE_STYLES: Record<string, string> = {
  CMYK: "bg-cyan-100 border-cyan-400 text-cyan-900",
  RGB: "bg-violet-50 border-violet-300 text-violet-800",
  Grayscale: "bg-gray-100 border-gray-400 text-gray-600",
  Spot: "bg-purple-50 border-purple-300 text-purple-800",
}

function ColorSpaceBadge({ cs }: { cs: string }) {
  const cls = COLOR_SPACE_STYLES[cs] ?? "bg-muted border-border text-muted-foreground"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {cs}
    </span>
  )
}

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function darken(hex: string, amount = 0.2): string {
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

function pantoneApproxColor(name: string): { bg: string; border: string; text: string } {
  const num = parseInt(name.match(/\d+/)?.[0] ?? "0")
  if (num === 877) return { bg: "#bcc0c4", border: "#8a8e92", text: "#fff" }
  if (num >= 871 && num <= 876) return { bg: "#c4962a", border: "#9a7320", text: "#fff" }
  if (num >= 878 && num <= 883) return { bg: "#b87333", border: "#8a5526", text: "#fff" }
  const key = String(num) as keyof typeof pantoneColors
  const hex = pantoneColors[key]
  if (hex) {
    const border = darken(hex, 0.2)
    const text = hexLuminance(hex) > 0.35 ? "#1a1a1a" : "#fff"
    return { bg: hex, border, text }
  }
  return { bg: "transparent", border: "#888", text: "#333" }
}

function PantoneBadge({ name }: { name: string }) {
  const { bg, border, text } = pantoneApproxColor(name)
  const unknown = bg === "transparent"
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderStyle: unknown ? "dashed" : "solid",
        color: text,
      }}
    >
      {name}
    </span>
  )
}

// Detail panel shown on the right when a file is selected
function FileDetailPanel({ file }: { file: SortableFile }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Thumbnail */}
      <div className="flex justify-center">
        {file.thumbnailDataUrl ? (
          <img
            src={file.thumbnailDataUrl}
            alt={file.filename}
            className="max-h-48 max-w-full object-contain rounded bg-white"
            style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.18))" }}
          />
        ) : (
          <div className="h-40 w-32 rounded border bg-muted flex items-center justify-center">
            <FileTextIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* File info */}
      <div className="space-y-2 text-sm">
        <div className="font-medium truncate">{file.filename}</div>
        {file.fromZip && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArchiveIcon className="h-3 w-3" />
            {file.fromZip}
          </div>
        )}

        {file.error ? (
          <p className="text-destructive text-xs">{file.error}</p>
        ) : (
          <div className="space-y-2 pt-1">
            <Row label="Format">
              <span className="font-mono text-xs">
                {file.trimWidthMm} × {file.trimHeightMm} mm
              </span>
            </Row>
            <Row label="Box">
              <Badge variant={file.trimSource === "TrimBox" ? "default" : "outline"} className="text-xs">
                {file.trimSource}
              </Badge>
            </Row>
            <Row label="Bleed">
              {file.bleedMm === null ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : file.bleedMm === 0 ? (
                <Badge variant="outline" className="text-xs text-destructive border-destructive">No bleed</Badge>
              ) : (
                <span className="text-xs font-mono text-green-600">{file.bleedMm} mm</span>
              )}
            </Row>
            <Row label="Pages">
              <span className="text-xs">{file.pages}</span>
            </Row>
            <Row label="Colors">
              <div className="flex flex-wrap gap-1">
                {file.colorSpaces
                  .filter((cs) => cs !== "Grayscale" || (!file.colorSpaces.includes("CMYK") && !file.colorSpaces.includes("RGB")))
                  .map((cs) => <ColorSpaceBadge key={cs} cs={cs} />)}
                {file.colorSpaces.length === 0 && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </Row>
            {file.pantoneColors.length > 0 && (
              <Row label="Pantone">
                <div className="flex flex-wrap gap-1">
                  {file.pantoneColors.map((p) => <PantoneBadge key={p} name={p} />)}
                </div>
              </Row>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

type Phase = "idle" | "uploading" | "processing"

function fmtMb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + " MB"
}

export function PdfDropzone({
  files,
  onChange,
}: {
  files: SortableFile[]
  onChange: (files: SortableFile[]) => void
}) {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [uploadPct, setUploadPct] = React.useState(0)
  const [uploadedBytes, setUploadedBytes] = React.useState(0)
  const [totalBytes, setTotalBytes] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [setAllQty, setSetAllQty] = React.useState("")

  const selectedFile = files.find((f) => f.id === selectedId) ?? files[0] ?? null

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return
    setError(null)
    setUploadPct(0)
    setUploadedBytes(0)
    const total = acceptedFiles.reduce((sum, f) => sum + f.size, 0)
    setTotalBytes(total)
    setPhase("uploading")

    const formData = new FormData()
    acceptedFiles.forEach((f) => formData.append("files", f))

    try {
      const data = await new Promise<{ files: PdfFileInfo[] }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadPct(Math.round((e.loaded / e.total) * 100))
            setUploadedBytes(e.loaded)
          }
        }
        xhr.upload.onload = () => setPhase("processing")
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error(`Server error: ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error("Network error"))
        xhr.open("POST", "/api/pdf-process")
        xhr.send(formData)
      })

      // Map each result back to its source File.
      // Direct PDFs: source is the PDF file. ZIP/7z-extracted: source is the archive.
      const withIds: SortableFile[] = data.files.map((f: PdfFileInfo, i: number) => {
        const sourceFile = f.fromZip
          ? acceptedFiles.find((af) => af.name === f.fromZip)
          : acceptedFiles.find((af) => af.name === f.filename)
        return {
          ...f,
          id: `${f.filename}-${Date.now()}-${i}`,
          quantity: 1,
          _sourceFile: sourceFile,
        }
      })
      const next = [...files, ...withIds]
      onChange(next)
      if (!selectedId && next.length > 0) setSelectedId(next[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setPhase("idle")
      setUploadPct(0)
    }
  }, [files, onChange, selectedId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/zip": [".zip"],
      "application/x-7z-compressed": [".7z"],
    },
    multiple: true,
    disabled: phase !== "idle",
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((i) => i.id === active.id)
      const newIndex = files.findIndex((i) => i.id === over.id)
      onChange(arrayMove(files, oldIndex, newIndex))
    }
  }

  function handleQuantityChange(id: string, qty: number) {
    onChange(files.map((f) => f.id === id ? { ...f, quantity: qty } : f))
  }

  function handleSetAll() {
    const qty = Math.max(1, parseInt(setAllQty) || 1)
    onChange(files.map((f) => ({ ...f, quantity: qty })))
    setSetAllQty("")
  }

  function handleRemove(id: string) {
    const next = files.filter((f) => f.id !== id)
    onChange(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragActive
            ? "border-foreground bg-muted"
            : "border-border hover:border-foreground/40 hover:bg-muted/50"
        } ${phase !== "idle" ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        <UploadCloudIcon className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragActive ? "Drop files here" : "Drag & drop PDF, ZIP or 7z files"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse · multiple files supported</p>
        </div>
      </div>

      {/* Upload progress */}
      {phase === "uploading" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading…</span>
            <span>{fmtMb(uploadedBytes)} / {fmtMb(totalBytes)} · {uploadPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Processing */}
      {phase === "processing" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Analysing PDFs, generating thumbnails…</p>
          <div className="h-1.5 w-full rounded-full overflow-hidden">
            <div
              className="h-full w-full rounded-full"
              style={{
                background:
                  "repeating-linear-gradient(45deg, oklch(0.556 0 0) 0px, oklch(0.556 0 0) 10px, oklch(0.708 0 0) 10px, oklch(0.708 0 0) 20px)",
                backgroundSize: "28px 100%",
                animation: "barberpole 0.6s linear infinite",
              }}
            />
          </div>
          <style>{`@keyframes barberpole { from { background-position: 0 0; } to { background-position: 28px 0; } }`}</style>
        </div>
      )}

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      {/* File list + detail panel */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Left: file list */}
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
              <p className="text-sm font-medium">{files.length} file{files.length !== 1 ? "s" : ""}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Set all qty:</span>
                <input
                  type="number"
                  min={1}
                  value={setAllQty}
                  onChange={(e) => setSetAllQty(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetAll()}
                  placeholder="1"
                  className="w-14 rounded border border-input bg-background px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleSetAll}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-input bg-background hover:bg-muted transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => { onChange([]); setSelectedId(null) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-2"
                >
                  <XIcon className="h-3 w-3" /> Clear
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="w-8 px-2" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">File</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Format</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Colors</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {files.map((f) => (
                        <SortableRow
                          key={f.id}
                          file={f}
                          onRemove={handleRemove}
                          onQuantityChange={handleQuantityChange}
                          isSelected={selectedFile?.id === f.id}
                          onSelect={setSelectedId}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
            </div>
          </div>

          {/* Right: detail panel */}
          {selectedFile && (
            <div className="rounded-lg border p-4">
              <FileDetailPanel file={selectedFile} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
