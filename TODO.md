# Druckwerk – TODO

## JDF
- [ ] **Filename hint parser** — parse structured info from PDF filenames (e.g. `{name}_{stock}_{qty}_{ref}_{format}_{duplex}_{gsm}_{variant}.pdf`) and enrich JDF BusinessInfo comments + MediaIntent weight. Customer-specific convention, so parser must be lenient/optional. Do not override authoritative sources (page count for duplex, order form for qty, product config for dimensions).

## Orders
- [ ] **Kanban board** — printer view with drag-and-drop status columns (see memory: kanban-todo.md spec)
- [ ] **Order card UI** — visual clarity still needs work. Filtering (status pills, brand dropdown, type toggle) not yet built.
- [ ] **Order detail page** — requester section blank for PDF orders, needs unified BC + PDF layout.
- [ ] **Mobile UX** — remove card wrapper on mobile, flatten to single layer.
- [ ] **New order page** — sticky preview at top on mobile, form scrolls below.

## Infrastructure
- [ ] **Synology deployment** — Docker Compose production setup, migration from Supabase/Vercel.
- [ ] **Production data migration** — pg_dump from Supabase, rclone files to MinIO, run `scripts/reassign-order-templates.ts` (7 templates to recreate manually).
