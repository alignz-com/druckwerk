# Detail Sheet Layout Pattern

Use this pattern whenever you build a full-height `Sheet` with scrollable content and persistent actions (e.g., brand/template/user detail forms).

## Structure

```
<SheetContent class="flex h-full max-w-4xl flex-col p-0">
  <SheetHeader class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 text-left">
    ...
  </SheetHeader>
  <form class="flex h-full flex-col">
    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {sections with <section> + headings + content}
      <Separator />
      ...
    </div>
    <div class="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-4 sm:flex sm:items-center sm:justify-between">
      {actions}
    </div>
  </form>
</SheetContent>
```

## Sections
- Each section begins with a title (`text-sm font-semibold`) + helper line.
- Content uses regular `div`/`grid` blocks. Avoid cards unless truly needed.
- Use `<Separator />` between major sections.

## Tables
- Wrap tables with `dataTableContainerClass` and include search/actions above.
- Keep edit/delete buttons as ghost icon buttons on the right.

## Sticky Actions
- Bottom actions should mirror `BrandDetailSheet`: `sticky bottom-0 ... bg-white/95 ...` so buttons stay visible.

Refer to:
- `components/admin/brands/BrandDetailSheet.tsx`
- `components/admin/brands/BrandCreateSheet.tsx`

Copy the snippet above when creating new admin sheets to ensure consistent spacing and behavior.
