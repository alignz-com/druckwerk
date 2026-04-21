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
import { FileTextIcon, UploadCloudIcon, XIcon, ArchiveIcon, GripVerticalIcon, Maximize2 } from "lucide-react"
import type { PdfFileInfo } from "@/app/api/pdf-process/route"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import { useTranslations, useLocale } from "@/components/providers/locale-provider"
import { matchProductFormat, getProductFormatsForSize, getProductFormatLabel, getFormatLabel, type ProductFormatForMatching } from "@/lib/product-matching"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pantoneTable = require("pantone-table") as Record<string, string>

export type SortableFile = PdfFileInfo & {
  id: string
  quantity: number
  productFormatId: string | null
  paperStockId: string | null
  /** Original File for direct PDFs; parent archive for ZIP/7z-extracted */
  _sourceFile?: File
}

type PaperOption = { paperStockId: string; name: string; finish: string | null; weightGsm: number | null; isDefault: boolean }

function SortableRow({
  file,
  onRemove,
  onQuantityChange,
  onProductChange,
  onPaperChange,
  isSelected,
  onSelect,
  products,
  papers,
  showPaperColumn,
}: {
  file: SortableFile
  onRemove: (id: string) => void
  onQuantityChange: (id: string, qty: number) => void
  onProductChange: (id: string, productFormatId: string | null) => void
  onPaperChange: (id: string, paperStockId: string | null) => void
  isSelected: boolean
  onSelect: (id: string) => void
  products: ProductFormatForMatching[]
  papers: PaperOption[]
  showPaperColumn: boolean
}) {
  const { locale } = useLocale()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform) ?? undefined,
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
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVerticalIcon className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-3 overflow-hidden">
        <div className="flex items-center gap-2">
          {file.fromZip && (
            <ArchiveIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-sm truncate" title={file.filename}>{file.filename}</span>
        </div>
        {file.fromZip && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 pl-5">
            {file.fromZip}
          </p>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {file.error ? (
          <span className="text-destructive text-xs">{file.error}</span>
        ) : (() => {
          const matched = file.productFormatId ? products.find(p => p.id === file.productFormatId) : null
          return matched ? (
            <div className="flex flex-col">
              <span className="text-xs font-medium">{getFormatLabel(matched, locale)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{file.trimWidthMm} × {file.trimHeightMm} mm</span>
            </div>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">
              {file.trimWidthMm} × {file.trimHeightMm} mm
            </span>
          )
        })()}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {file.pages > 0 ? file.pages : "—"}
      </td>
      {products.length > 0 && (
        <td className="px-3 py-3 w-44" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const sizeMatches = file.error ? [] : getProductFormatsForSize(file.trimWidthMm, file.trimHeightMm, products)
            if (sizeMatches.length === 0) {
              return (
                <span className="text-xs text-muted-foreground italic">No match</span>
              )
            }
            return (
              <select
                value={file.productFormatId ?? ""}
                onChange={(e) => onProductChange(file.id, e.target.value || null)}
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">—</option>
                {sizeMatches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getProductFormatLabel(p, locale)}
                  </option>
                ))}
              </select>
            )
          })()}
        </td>
      )}
      {showPaperColumn && (
        <td className="px-3 py-3 w-44" onClick={(e) => e.stopPropagation()}>
          {papers.length > 1 ? (
            <select
              value={file.paperStockId ?? ""}
              onChange={(e) => onPaperChange(file.id, e.target.value || null)}
              className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {papers.map((p) => (
                <option key={p.paperStockId} value={p.paperStockId}>
                  {p.name}{p.weightGsm ? ` · ${p.weightGsm}g` : ""}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="px-3 py-3 w-24" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min={1}
          value={file.quantity || ""}
          onChange={(e) => onQuantityChange(file.id, parseInt(e.target.value) || 0)}
          onBlur={() => { if (!file.quantity || file.quantity < 1) onQuantityChange(file.id, 1) }}
          className="w-16 rounded border border-input bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </td>
      <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
      {children}
    </span>
  )
}

function pantoneHex(name: string): string | null {
  // "PANTONE 871 C" → "pantone_871_c"
  const key = name.trim().toLowerCase().replace(/^pantone\s+/, "pantone_").replace(/\s+/g, "_")
  return pantoneTable[key] ?? pantoneTable[`${key}_c`] ?? null
}

// Detail panel shown on the right when a file is selected
function FileDetailPanel({ file, onView }: { file: SortableFile; onView: () => void }) {
  const t = useTranslations()
  const canView = !!file.previewUrl
  return (
    <div className="flex flex-col gap-5">
      {/* Filename + archive source */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-snug" title={file.filename}>
          {file.filename}
        </p>
        {file.fromZip && (
          <div className="flex items-center gap-1 mt-1">
            <ArchiveIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground truncate">{file.fromZip}</span>
          </div>
        )}
      </div>

      {/* Thumbnail */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={canView ? onView : undefined}
          disabled={!canView}
          title={canView ? undefined : "Not available for files extracted from .7z archives"}
          className="group relative rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center disabled:cursor-default"
          style={{ width: "120px", height: "160px" }}
        >
          {file.thumbnailDataUrl ? (
            <img
              src={file.thumbnailDataUrl}
              alt={file.filename}
              className="w-full h-full object-contain p-2"
            />
          ) : (
            <FileTextIcon className="h-8 w-8 text-muted-foreground/50" />
          )}
          {canView && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 p-1.5 rounded-full shadow-sm">
                <Maximize2 className="h-3.5 w-3.5" />
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Specs */}
      {file.error ? (
        <p className="text-xs text-destructive">{file.error}</p>
      ) : (
        <div className="space-y-0 divide-y divide-border/60">
          <SpecRow label={t("pdfOrder.dropzoneFormat")}>
            <span className="font-mono text-xs">{file.trimWidthMm} × {file.trimHeightMm} mm</span>
            {file.trimSource === "MediaBox" && (
              <span className="text-[10px] text-destructive font-medium ml-1.5">{t("pdfOrder.dropzoneNoTrimBox")}</span>
            )}
          </SpecRow>
          <SpecRow label={t("pdfOrder.dropzoneBleed")}>
            {file.bleedMm === null ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : file.bleedMm === 0 ? (
              <span className="text-xs text-destructive font-semibold">{t("pdfOrder.dropzoneNoBleed")}</span>
            ) : (
              <span className="font-mono text-xs">{file.bleedMm} mm</span>
            )}
          </SpecRow>
          <SpecRow label={t("pdfOrder.dropzonePages")}>
            <span className="text-xs tabular-nums">{file.pages}</span>
          </SpecRow>
          <SpecRow label={t("pdfOrder.dropzoneColors")}>
            <div className="flex flex-wrap gap-1">
              {file.colorSpaces
                .filter((cs) => cs !== "Grayscale" || (!file.colorSpaces.includes("CMYK") && !file.colorSpaces.includes("RGB")))
                .map((cs) => <Pill key={cs}>{cs}</Pill>)}
              {file.colorSpaces.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </SpecRow>
          {file.pantoneColors.length > 0 && (
            <SpecRow label="Pantone">
              <div className="flex flex-wrap gap-1">
                {file.pantoneColors.map((p) => {
                  const hex = pantoneHex(p)
                  return (
                    <Pill key={p}>
                      {hex && (
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: hex }} />
                      )}
                      {p}
                    </Pill>
                  )
                })}
              </div>
            </SpecRow>
          )}
        </div>
      )}
    </div>
  )
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-1">{children}</div>
    </div>
  )
}

type Phase = "idle" | "uploading" | "processing"

function fmtMb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + " MB"
}

async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

export function PrintFileUploader({
  files,
  onChange,
  products = [],
  brandId,
}: {
  files: SortableFile[]
  onChange: (files: SortableFile[]) => void
  products?: ProductFormatForMatching[]
  brandId?: string | null
}) {
  const t = useTranslations()
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [uploadPct, setUploadPct] = React.useState(0)
  const [uploadedBytes, setUploadedBytes] = React.useState(0)
  const [totalBytes, setTotalBytes] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [setAllQty, setSetAllQty] = React.useState("")
  const [viewingFile, setViewingFile] = React.useState<SortableFile | null>(null)
  const [viewObjectUrl, setViewObjectUrl] = React.useState<string | null>(null)
  const [downloading, setDownloading] = React.useState(false)

  const handleDownload = React.useCallback(async (url: string, filename: string) => {
    setDownloading(true)
    try { await triggerDownload(url, filename) } finally { setDownloading(false) }
  }, [])

  React.useEffect(() => {
    setViewObjectUrl(viewingFile?.previewUrl ?? null)
  }, [viewingFile])

  // ── Paper stock fetching (cached per productFormatId) ───────
  const [papersCache, setPapersCache] = React.useState<Record<string, PaperOption[]>>({})
  const papersFetchedRef = React.useRef<Set<string>>(new Set())
  const filesRef = React.useRef(files)
  filesRef.current = files

  // Collect unique productFormatIds that need papers fetched
  const productFormatIds = React.useMemo(
    () => [...new Set(files.map((f) => f.productFormatId).filter(Boolean))] as string[],
    [files],
  )

  React.useEffect(() => {
    if (!brandId) return
    for (const pfId of productFormatIds) {
      if (papersFetchedRef.current.has(pfId)) continue
      papersFetchedRef.current.add(pfId)
      void fetch(`/api/orders/papers?brandId=${brandId}&productFormatId=${pfId}`)
        .then((res) => res.ok ? res.json() : [])
        .then((data: PaperOption[]) => {
          setPapersCache((prev) => ({ ...prev, [pfId]: data }))
          // Auto-select default paper for files that have no paper yet
          if (data.length > 0) {
            const defaultPaper = data.find((p) => p.isDefault) ?? data[0]
            onChange(filesRef.current.map((f) =>
              f.productFormatId === pfId && !f.paperStockId
                ? { ...f, paperStockId: defaultPaper.paperStockId }
                : f
            ))
          }
        })
        .catch(() => {})
    }
  }, [productFormatIds, brandId])

  function handlePaperChange(id: string, paperStockId: string | null) {
    onChange(files.map((f) => f.id === id ? { ...f, paperStockId } : f))
  }

  // Get papers for a specific file's product format
  const getPapersForFile = (file: SortableFile): PaperOption[] => {
    if (!file.productFormatId) return []
    return papersCache[file.productFormatId] ?? []
  }

  const showPaperColumn = files.some((f) => getPapersForFile(f).length > 1)

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
      const withIds: SortableFile[] = data.files.map((f: PdfFileInfo, i: number) => {
        const sourceFile = f.fromZip
          ? acceptedFiles.find((af) => af.name === f.fromZip)
          : acceptedFiles.find((af) => af.name === f.filename)
        const matched = !f.error
          ? matchProductFormat(f.trimWidthMm, f.trimHeightMm, f.pages, products)
          : null
        return {
          ...f,
          id: `${f.filename}-${Date.now()}-${i}`,
          quantity: 1,
          productFormatId: matched?.id ?? null,
          paperStockId: null,
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

  function handleProductChange(id: string, productFormatId: string | null) {
    onChange(files.map((f) => f.id === id ? { ...f, productFormatId, paperStockId: null } : f))
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
      {/* PDF viewer modal */}
      <Dialog open={!!viewingFile} onOpenChange={(open) => { if (!open) setViewingFile(null) }}>
        <DialogContent showClose={false} className="p-0 gap-0 overflow-hidden flex flex-col" style={{ width: "96vw", maxWidth: "96vw", height: "96vh" }}>
          <DialogHeader className="flex flex-row items-center gap-2 px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-medium truncate flex-1">{viewingFile?.filename}</DialogTitle>
            {viewObjectUrl && (
              <LoadingButton
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(viewObjectUrl!, viewingFile?.filename ?? "file.pdf")}
                loading={downloading}
                loadingText="…"
                minWidthClassName="min-w-[60px]"
                className="shrink-0 h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {t("pdfOrder.dropzoneDownload")}
              </LoadingButton>
            )}
            <DialogClose className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0">
              <XIcon className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {viewObjectUrl && (
              <iframe src={viewObjectUrl} className="w-full h-full border-0 block" title={viewingFile?.filename} />
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragActive
            ? "border-foreground bg-muted"
            : "border-border hover:border-foreground/40 hover:bg-muted/50"
        } ${phase !== "idle" ? "pointer-events-none" : ""}`}
        style={{ height: "200px" }}
      >
        <input {...getInputProps()} />

        {phase === "uploading" && (
          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("pdfOrder.dropzoneUploading")}</span>
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

        {phase === "processing" && (
          <div className="w-full max-w-xs space-y-3">
            <p className="text-xs text-muted-foreground text-center">{t("pdfOrder.dropzoneProcessing")}</p>
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

        {phase === "idle" && (
          <>
            <UploadCloudIcon className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragActive ? t("pdfOrder.dropzoneDropHere") : t("pdfOrder.dropzoneDragDrop")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t("pdfOrder.dropzoneBrowse")}</p>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      {/* File list + detail panel */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          {/* Left: file list */}
          <div className="rounded-lg border overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
              <p className="text-sm font-medium">{files.length} {files.length !== 1 ? t("pdfOrder.dropzoneFiles") : t("pdfOrder.dropzoneFile")}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("pdfOrder.dropzoneSetAllQty")}</span>
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
                  type="button"
                  onClick={handleSetAll}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-input bg-background hover:bg-muted transition-colors"
                >
                  {t("pdfOrder.dropzoneApply")}
                </button>
                <button
                  type="button"
                  onClick={() => { onChange([]); setSelectedId(null) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-2"
                >
                  <XIcon className="h-3 w-3" /> {t("pdfOrder.dropzoneClear")}
                </button>
              </div>
            </div>
            <div>
              <table className="w-full text-sm" style={{ tableLayout: "fixed", minWidth: showPaperColumn ? "780px" : products.length > 0 ? "620px" : "460px" }}>
                <colgroup>
                  <col style={{ width: "32px" }} />
                  <col />
                  <col style={{ width: "130px" }} />
                  <col style={{ width: "58px" }} />
                  {products.length > 0 && <col style={{ width: "160px" }} />}
                  {showPaperColumn && <col style={{ width: "160px" }} />}
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "40px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-2" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("pdfOrder.dropzoneColFile")}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("pdfOrder.dropzoneColFormat")}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("pdfOrder.dropzoneColPages")}</th>
                    {products.length > 0 && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Product</th>}
                    {showPaperColumn && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("pdfOrder.dropzoneColPaper") ?? "Paper"}</th>}
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">{t("pdfOrder.dropzoneColQty")}</th>
                    <th className="px-2" />
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
                          onProductChange={handleProductChange}
                          onPaperChange={handlePaperChange}
                          isSelected={selectedFile?.id === f.id}
                          onSelect={setSelectedId}
                          products={products}
                          papers={getPapersForFile(f)}
                          showPaperColumn={showPaperColumn}
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
            <div className="rounded-lg border p-5">
              <FileDetailPanel file={selectedFile} onView={() => setViewingFile(selectedFile)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
