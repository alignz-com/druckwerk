# Druckwerk – TODO

## JDF
- [ ] **Filename hint parser** — parse structured info from PDF filenames and enrich JDF BusinessInfo comments + MediaIntent weight. Must be lenient — same customer uses multiple conventions: format as name (`A4`) or dimensions (`21x28`), print mode as `duplex` or `booklet`, gsm standalone (`150`) or combined (`90150`). Most useful output: flag discrepancy between filename-encoded dimensions and preflight-detected dimensions (e.g. `21x28` in name vs `210×297` detected). Never override authoritative sources (page count for duplex, order form for qty, product config for dimensions).

## Orders
- [ ] **Kanban board** — printer view with drag-and-drop status columns (see memory: kanban-todo.md spec)
- [ ] **Order card UI** — visual clarity still needs work. Filtering (status pills, brand dropdown, type toggle) not yet built.
- [ ] **Order detail page** — requester section blank for PDF orders, needs unified BC + PDF layout.
- [ ] **Mobile UX** — remove card wrapper on mobile, flatten to single layer.
- [ ] **New order page** — sticky preview at top on mobile, form scrolls below.

## Infrastructure
- [ ] **Synology deployment** — Docker Compose production setup, migration from Supabase/Vercel.
- [ ] **Production data migration** — pg_dump from Supabase, rclone files to MinIO, run `scripts/reassign-order-templates.ts` (7 templates to recreate manually).
