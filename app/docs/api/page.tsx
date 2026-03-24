import { ClipboardCopy } from "./clipboard-copy";

const BASE_URL = process.env.API_DOCS_BASE_URL || "https://api.dth.at";

function CodeBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <ClipboardCopy text={children} />
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed text-slate-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function ParamRow({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 border-b border-slate-100 py-3.5 last:border-0">
      <div>
        <code className="text-sm font-semibold text-slate-900">{name}</code>
        {required && <span className="ml-1.5 text-xs text-red-500">required</span>}
        <div className="mt-0.5 text-xs text-slate-400">{type}</div>
      </div>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              D
            </div>
            <div>
              <h1 className="text-lg font-semibold">Druckwerk API</h1>
              <p className="text-sm text-slate-500">v1</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Intro */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Getting started</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
            The Druckwerk API allows external systems to submit print orders programmatically.
            All requests are authenticated using a Bearer token obtained from the brand admin panel.
          </p>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <strong>Base URL:</strong>{" "}
              <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">{BASE_URL}</code>
            </p>
          </div>
        </section>

        {/* Authentication */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold tracking-tight">Authentication</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
            All API requests require a Bearer token in the <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Authorization</code> header.
            API keys are managed in the brand settings under the <strong>API</strong> tab.
          </p>
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
              <span className="text-slate-500">Header</span>
              <code className="text-slate-800">Authorization: Bearer YOUR_API_KEY</code>
            </div>
            <div className="mt-2 grid grid-cols-[140px_1fr] gap-3 text-sm">
              <span className="text-slate-500">Scope</span>
              <span className="text-slate-800">Brand-level (one key per brand)</span>
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold tracking-tight mb-6">Endpoints</h2>

          {/* ── POST /v1/orders ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <Badge color="green">POST</Badge>
                <code className="text-sm font-mono font-medium text-slate-800">/v1/orders</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Submit a new print order with one or more files. Each file can be a PDF, ZIP, or 7Z archive.
                Archives are automatically extracted and each PDF inside becomes a separate order item.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-slate-200">
              {/* Left: parameters */}
              <div className="px-6 py-5 space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Request body
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Content-Type: <code className="rounded bg-slate-100 px-1 py-0.5">multipart/form-data</code>
                  </p>

                  <ParamRow name="files" type="file[]" required>
                    One or more files. Repeat the field for multiple files. Accepted formats: <code>.pdf</code>, <code>.zip</code>, <code>.7z</code>
                  </ParamRow>
                  <ParamRow name="quantities" type="integer[]" required>
                    Number of copies for each file, in the same order. Repeat the field once per file.
                  </ParamRow>
                  <ParamRow name="customerReference" type="string">
                    Your internal reference (e.g. sales order number). Stored with the order and visible in the dashboard.
                  </ParamRow>
                  <ParamRow name="notes" type="string">
                    Free-text notes for the print operator.
                  </ParamRow>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Response
                  </h3>
                  <ParamRow name="orderId" type="string">
                    Unique identifier of the created order.
                  </ParamRow>
                  <ParamRow name="referenceCode" type="string">
                    Human-readable order reference (e.g. <code>2026-00042</code>).
                  </ParamRow>
                  <ParamRow name="items" type="array">
                    List of created order items. Each item includes:
                  </ParamRow>
                  <ParamRow name="items[].filename" type="string">
                    Original filename of the PDF.
                  </ParamRow>
                  <ParamRow name="items[].archive" type="string | null">
                    Source archive name if the file was extracted from a ZIP/7Z. <code>null</code> for direct uploads.
                  </ParamRow>
                  <ParamRow name="items[].quantity" type="integer">
                    Number of copies.
                  </ParamRow>
                  <ParamRow name="items[].trimWidthMm" type="number | null">
                    Detected trim width in millimeters.
                  </ParamRow>
                  <ParamRow name="items[].trimHeightMm" type="number | null">
                    Detected trim height in millimeters.
                  </ParamRow>
                  <ParamRow name="items[].bleedMm" type="number | null">
                    Detected bleed in millimeters.
                  </ParamRow>
                  <ParamRow name="items[].pages" type="integer | null">
                    Page count.
                  </ParamRow>
                  <ParamRow name="items[].colorSpaces" type="string[]">
                    Detected color spaces (e.g. <code>CMYK</code>, <code>RGB</code>, <code>Spot</code>).
                  </ParamRow>
                  <ParamRow name="items[].pantoneColors" type="string[]">
                    Detected Pantone spot color names.
                  </ParamRow>
                  <ParamRow name="items[].product" type="string | null">
                    Auto-matched product name based on dimensions, or <code>null</code> if no match.
                  </ParamRow>
                  <ParamRow name="items[].format" type="string | null">
                    Auto-matched format name (e.g. <code>A4</code>, <code>Letter</code>).
                  </ParamRow>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Errors
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge color="red">401</Badge>
                      <span className="text-slate-600">Invalid or missing API key</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color="yellow">400</Badge>
                      <span className="text-slate-600">Missing files, invalid quantities, or unsupported file type</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color="red">500</Badge>
                      <span className="text-slate-600">Internal server error</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: examples */}
              <div className="px-6 py-5 space-y-4 bg-slate-50/50">
                <CodeBlock title="Request (single PDF)">{`$ curl -X POST "${BASE_URL}/v1/orders" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -F "files=@manual.pdf" \\
    -F "quantities=100" \\
    -F "customerReference=PO-2026-001"`}</CodeBlock>

                <CodeBlock title="Request (multiple files)">{`$ curl -X POST "${BASE_URL}/v1/orders" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -F "files=@manual-EN.pdf" \\
    -F "quantities=100" \\
    -F "files=@manual-DE.pdf" \\
    -F "quantities=50" \\
    -F "files=@appendix.pdf" \\
    -F "quantities=200" \\
    -F "customerReference=PO-2026-001" \\
    -F "notes=Urgent delivery"`}</CodeBlock>

                <CodeBlock title="Request (archive)">{`$ curl -X POST "${BASE_URL}/v1/orders" \\
    -H "Authorization: Bearer YOUR_API_KEY" \\
    -F "files=@all-manuals.7z" \\
    -F "quantities=150"`}</CodeBlock>

                <CodeBlock title="200 — Response">{`{
  "orderId": "cm5x9k2a30001abcd",
  "referenceCode": "2026-00042",
  "items": [
    {
      "id": "cm5x9k2a30002efgh",
      "filename": "product-brochure.pdf",
      "archive": null,
      "quantity": 100,
      "trimWidthMm": 210,
      "trimHeightMm": 297,
      "bleedMm": 3,
      "pages": 12,
      "colorSpaces": ["CMYK"],
      "pantoneColors": [],
      "product": "Broschüre",
      "format": "A4"
    },
    {
      "id": "cm5x9k2a30003ijkl",
      "filename": "info-flyer.pdf",
      "archive": "print-bundle.7z",
      "quantity": 500,
      "trimWidthMm": 148,
      "trimHeightMm": 210,
      "bleedMm": 3,
      "pages": 2,
      "colorSpaces": ["CMYK", "Spot"],
      "pantoneColors": ["PANTONE 300 C"],
      "product": "Flyer",
      "format": "A5"
    }
  ]
}`}</CodeBlock>

                <CodeBlock title="401 — Unauthorized">{`{
  "error": "Unauthorized"
}`}</CodeBlock>

                <CodeBlock title="400 — Validation error">{`{
  "error": "Missing or invalid qty_0 for file manual.pdf"
}`}</CodeBlock>
              </div>
            </div>
          </div>
        </section>

        {/* Archive handling */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold tracking-tight">Archive handling</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
            When you upload a <code>.zip</code> or <code>.7z</code> archive, Druckwerk automatically extracts
            all PDF files inside and creates a separate order item for each. All extracted files inherit
            the quantity specified for that archive. The <code>archive</code> field in the response identifies
            which source archive each file came from.
          </p>
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              Only PDF files inside archives are processed. Other file types are silently ignored.
              Nested folders are supported — files in subdirectories are extracted normally.
            </p>
          </div>
        </section>

        {/* Rate limits */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold tracking-tight">Limits</h2>
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
            <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
              <span className="text-slate-500">Max request size</span>
              <span className="text-slate-800">100 MB</span>
            </div>
            <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
              <span className="text-slate-500">Max duration</span>
              <span className="text-slate-800">120 seconds</span>
            </div>
            <div className="grid grid-cols-[180px_1fr] gap-3 text-sm">
              <span className="text-slate-500">Supported formats</span>
              <span className="text-slate-800">PDF, ZIP, 7Z</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-100 pt-6 text-xs text-slate-400">
          Druckwerk API v1 &middot; Druckerei Thurnher GmbH
        </footer>
      </main>
    </div>
  );
}
