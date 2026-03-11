# Next Steps

## Internationalization (en/de)
- Pick an i18n helper (`next-intl` or `next-international`) and wire it into the App Router via middleware so URLs follow `/en/*` and `/de/*`.
- Extract strings from `app/(app)` and `components` into locale JSON files; start with navigation labels, order form copy, and authentication messages.
- Provide a `LanguageSwitcher` component (header/footer) that persists the chosen locale on the session or cookie.

## Email notifications (Postmark)
- Add `POSTMARK_SERVER_TOKEN` and sender signature to the deployment environment; mirror in `.env.example`.
- Create a `lib/postmark.ts` helper that exposes `sendOrderConfirmation({ orderId, locale })`.
- Trigger the helper from the order creation route once persistence succeeds; template should cover requester + printer notifications.

## Order flow & persistence
- Implement mutation endpoint that validates the order payload, generates a `referenceCode`, uploads the PDF blob, then stores the record via Prisma.
- Extend `Order` queries to respect `brandId` filtering for regular users, while admins/printers can filter across brands.
- Backfill initial data: Prisma seed for Martin Wieland (ADMIN), DTH printer account (PRINTER credential login), default brand(s), templates, and brand-template assignments.

## Guardrails & tooling
- Add middleware that redirects non-admins away from `/admin/*` routes even if navigated directly.
- Introduce zod-based validation shared between client form and API route for consistent error handling.
- Document required environment variables (`DATABASE_URL`, Azure AD, Postmark) and add a migration workflow (`prisma migrate dev` / `prisma migrate deploy`).
