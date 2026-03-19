function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/60 ${className ?? ""}`} />;
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-white rounded-xl border border-slate-200">
      <Pulse className="h-3 w-3/4" />
      <Pulse className="h-3 w-1/2" />
      <div className="flex gap-1.5 mt-1">
        <Pulse className="h-4 w-10 rounded" />
        <Pulse className="h-4 w-14 rounded" />
      </div>
    </div>
  );
}

function SkeletonColumn({ cards }: { cards: number }) {
  return (
    <div className="flex-shrink-0 self-stretch" style={{ width: "260px" }}>
      <div className="flex flex-col gap-0 rounded-2xl overflow-hidden border border-slate-200/80">
        <Pulse className="h-10 rounded-none" />
        <div className="flex flex-col gap-2 p-2 bg-slate-50/40">
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FeaturesLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Pulse className="h-7 w-32" />
          <Pulse className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Pulse className="h-9 w-36 rounded-md" />
          <Pulse className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Kanban skeleton */}
      <div className="flex gap-3 overflow-hidden pr-16 h-[calc(100vh-12rem)]">
        <SkeletonColumn cards={3} />
        <SkeletonColumn cards={2} />
        <SkeletonColumn cards={1} />
        <SkeletonColumn cards={4} />
        <SkeletonColumn cards={2} />
        <SkeletonColumn cards={1} />
      </div>
    </div>
  );
}
