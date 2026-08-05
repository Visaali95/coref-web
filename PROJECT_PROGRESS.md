# Coref Web — Project Progress Tracker

> Living document tracking all decisions, changes, and current state of the Coref platform.
> Update this file whenever a significant feature is built or a decision is made.

---

## Project Overview

**Coref** is a B2B sourcing platform that connects Indian businesses with vetted Chinese and international manufacturers. The platform includes:

- A **public-facing website** (product catalogue, enquiry system, how-it-works)
- An **admin panel** for managing products, enquiries, and supplier uploads
- A **REST API backend** for data persistence and PDF processing

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19 + SSR) |
| Router | TanStack Router (file-based) |
| State/Fetching | TanStack Query |
| Styling | Tailwind CSS v4 |
| Component Library | Radix UI + shadcn/ui components |
| Forms | React Hook Form + Zod |
| Build Tool | Vite 8 |
| Language | TypeScript 5 |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | SQLite (`prisma/dev.db`) |
| Validation | Zod |
| PDF Parsing | pdf-parse (digital PDFs) + Tesseract.js (OCR fallback for scanned PDFs) |
| File Uploads | Multer (in-memory, 50 MB limit) |
| Dev Server | ts-node-dev |
| Language | TypeScript 5 |

---

## Monorepo Structure

```
coref-web/                          ← Project root
├── src/                            ← Frontend (TanStack Start)
│   ├── routes/
│   │   ├── __root.tsx              # App shell, providers, nav
│   │   ├── index.tsx               # Landing page
│   │   ├── products.$category.tsx  # Public product listing (live from DB)
│   │   ├── product.$id.tsx         # Single product detail page
│   │   ├── enquiry.tsx             # Customer enquiry form
│   │   ├── how-it-works.tsx        # How it works page
│   │   ├── suppliers.$id.tsx       # Supplier profile page
│   │   └── admin.tsx               # Admin panel (upload, catalogue, enquiries)
│   ├── lib/
│   │   ├── api.ts                  # apiFetch() + apiUrl() helpers
│   │   ├── catalog.ts              # Category metadata (CATEGORIES constant)
│   │   ├── enquiry.tsx             # Enquiry cart context + hook
│   │   └── utils.ts                # Utility helpers
│   ├── components/
│   │   ├── coref/                  # Shared brand components (Logo, etc.)
│   │   └── ui/                     # Radix/shadcn UI primitives
│   └── styles.css                  # Global CSS + Tailwind config
│
├── backend/                        ← Backend (Express + Prisma + SQLite)
│   ├── prisma/
│   │   ├── schema.prisma           # DB schema (Product, Enquiry models)
│   │   └── dev.db                  # SQLite database (auto-generated, gitignored)
│   ├── src/
│   │   ├── index.ts                # Express app entry point
│   │   ├── lib/
│   │   │   └── db.ts               # Prisma client singleton
│   │   ├── routes/
│   │   │   ├── products.ts         # /api/products — CRUD + published filter
│   │   │   ├── enquiries.ts        # /api/enquiries — GET/POST/PUT
│   │   │   └── upload.ts           # /api/upload/pdf — PDF processing
│   │   └── services/
│   │       ├── productService.ts   # Prisma queries for Product
│   │       ├── enquiryService.ts   # Prisma queries for Enquiry
│   │       └── pdfService.ts       # Hybrid OCR pipeline
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md                   # Full backend API reference
│
├── PROJECT_PROGRESS.md             ← THIS FILE
├── BACKEND_README.md               ← Legacy readme (superseded by backend/README.md)
└── README.md                       # Root readme
```

---

## Running the Project Locally

### Prerequisites
- Node.js ≥ 20
- npm ≥ 9

### Terminal 1 — Frontend
```bash
# From project root
npm install
npm run dev
# → http://localhost:3000
```

### Terminal 2 — Backend
```bash
cd backend
npm install
npm run prisma:migrate   # First time only — creates dev.db
npm run dev
# → http://localhost:4000
```

### Environment Variables
| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | Frontend `.env` | `http://localhost:4000` | API base URL |
| `PORT` | Backend `.env` | `4000` | Backend listen port |

---

## API Endpoints

Base URL: `http://localhost:4000`

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ "status": "ok" }` |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | Admin | All products (all statuses) |
| GET | `/api/products/published` | Public | Only Published products |
| GET | `/api/products/:id` | Admin | Single product |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product (all fields) |
| PATCH | `/api/products/:id/status` | Admin | Quick status change only |
| DELETE | `/api/products/:id` | Admin | Delete product |

### Enquiries
| Method | Path | Description |
|---|---|---|
| GET | `/api/enquiries` | All enquiries |
| GET | `/api/enquiries/:id` | Single enquiry |
| POST | `/api/enquiries` | Submit new enquiry (auto-generates reference) |
| PUT | `/api/enquiries/:id` | Update enquiry status |

### PDF Upload
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload/pdf` | Upload PDF → returns extracted product suggestions |

---

## Database Schema

### `Product` model
| Column | Type | Notes |
|---|---|---|
| `id` | Int | PK, auto-increment |
| `name` | String | Product name |
| `category` | String | e.g. "Tiles & Flooring" |
| `supplier` | String | Supplier name |
| `fobPrice` | String | FOB price as string |
| `leadTime` | String? | Optional |
| `status` | String | `"Draft"` / `"Published"` / `"Needs Review"` |
| `createdAt` | DateTime | Auto |
| `updatedAt` | DateTime | Auto |

### `Enquiry` model
| Column | Type | Notes |
|---|---|---|
| `id` | Int | PK, auto-increment |
| `reference` | String | Unique — `ENQ-YYYYMMDD-XXXX` |
| `name` | String | Contact name |
| `company` | String | Company name |
| `role` | String | Contact role |
| `email` | String? | Optional |
| `phone` | String? | Optional |
| `items` | String | Products being enquired about |
| `message` | String | Enquiry body |
| `status` | String | `"New"` / `"In Progress"` / `"Quoted"` / `"Closed"` |
| `submittedAt` | DateTime | Auto |

---

## Feature Log

---

### ✅ Session 1 — Initial Setup & Bug Fix
**Date:** 2026-08-05

#### Problem Fixed: `ts-node-dev` ESM Crash
- **Cause:** `package.json` had `"type": "module"` which forced Node.js into ESM mode, incompatible with ts-node-dev's CommonJS loader
- **Fix:**
  - Removed `"type": "module"` from `backend/package.json`
  - Changed `tsconfig.json` → `"module": "CommonJS"`, `"moduleResolution": "Node"`
- **Result:** Backend now starts cleanly with `npm run dev`

---

### ✅ Session 2 — Backend README
**Date:** 2026-08-05

- Wrote comprehensive `backend/README.md` documenting:
  - Full API reference with request/response shapes
  - Database schema
  - Getting started steps
  - Frontend integration guide (how `apiFetch()` connects to the API)
  - All npm scripts

---

### ✅ Session 3 — PDF Processing & Product Publishing Workflow
**Date:** 2026-08-05 / 2026-08-06

#### 3a. Improved PDF OCR Pipeline (`backend/src/services/pdfService.ts`)
- **Before:** `pdf-parse` only, basic keyword scan, max 12 results
- **After:**
  - **Hybrid OCR:** `pdf-parse` for digital PDFs → automatically falls back to **Tesseract.js** (real OCR engine) for scanned/image PDFs (triggered when extracted text < 50 meaningful chars)
  - **Expanded category keywords:** 40+ terms across all 6 categories (Tiles & Flooring, Sanitaryware, Machinery, Lighting, Structural, Surface Finishes)
  - **Price extraction:** Scans nearby lines for USD, $, ₹, FOB price patterns → pre-populates `fobPrice` in review table
  - **Lead time extraction:** Detects "X days/weeks" and delivery patterns → pre-populates `leadTime`
  - **Deduplication:** Normalised 60-char key deduplication to avoid duplicate suggestions
  - **Line quality filters:** Skips page numbers, URLs, email addresses, very short lines
  - **Max results:** Increased from 12 → 25

#### 3b. Product Publishing Workflow (`backend/src/routes/products.ts`)
- Added `GET /api/products/published` — only returns `status = "Published"` products
- Added `PATCH /api/products/:id/status` — quick status-only update (no full body needed)
- Updated `productService.ts` with `getPublishedProducts()` and `updateProductStatus()`

#### 3c. Admin Panel Improvements (`src/routes/admin.tsx`)

**Upload Catalogue page:**
- Added **"Save as Draft"** button — saves selected products to DB with `status: "Draft"` without publishing
- Improved upload loading state: animated spinner, gradient progress bar, OCR engine notice
- Unified `saveMutation` handles both publish and draft with a `status` parameter

**Product Catalogue page:**
- Added **status filter tabs**: All / Published / Draft / Needs Review (with live counts per tab)
- Added **per-row quick Publish / Unpublish buttons** using `PATCH /:id/status` — no need to open edit mode
- Status mutations invalidate both `["products"]` and `["products", "published"]` query caches for instant consistency

#### 3d. Public Products Page (`src/routes/products.$category.tsx`)
- **Before:** Loaded 6 hard-coded demo products from `catalog.ts` (static, not in DB)
- **After:** Fetches live data from `/api/products/published` via `useQuery`
- Features:
  - Dynamic **Supplier filter** (extracted from actual DB products)
  - **Lead Time bucket filter** (Under 4 weeks / 4–8 weeks / 8–12 weeks / Over 12 weeks)
  - **Search** by product name or supplier
  - **Loading skeleton** with spinner
  - **Empty state** when category has no published products, with a direct link to Admin → Upload
  - Deterministic placeholder images via `picsum.photos/seed/prod-{id}`

#### 3e. TypeScript Bug Fixes
- Fixed `.ts` extension in import paths in `index.ts` (caused TS5097 errors)
- Fixed `undefined` vs `null` mismatch for Prisma's optional fields (`leadTime`, `email`, `phone`) — Prisma uses `null`, Zod produces `undefined`
- Installed `@types/pdf-parse` for proper type declarations

---

## Product Status Workflow

```
[Upload PDF] → OCR Extraction → Review Table (all Draft by default)
                                     │
                    ┌────────────────┴───────────────────┐
                    ↓                                    ↓
             [Save as Draft]                    [Publish Selected]
                    │                                    │
                    ↓                                    ↓
           status = "Draft"                   status = "Published"
           (Admin only)                       (Live on /products page)
                    │
                    ↓ (Admin clicks "Publish" in Catalogue)
           status = "Published"
                    │
                    ↓ (Admin clicks "Unpublish")
           status = "Draft"
```

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| Backend server | ✅ Running | `http://localhost:4000` |
| Frontend dev server | ✅ Running | `http://localhost:3000` |
| PDF upload & OCR | ✅ Working | Hybrid pdf-parse + Tesseract |
| Product publishing | ✅ Working | Draft / Published workflow complete |
| Public Products page | ✅ Live data | Fetches from `/api/products/published` |
| Admin catalogue | ✅ Enhanced | Status tabs, quick publish/unpublish |
| Admin upload | ✅ Enhanced | Save as Draft + Publish |
| Enquiries | ✅ Working | Submit, list, update status |
| Authentication | ⚠️ Demo only | SessionStorage flag, no real auth |
| Supplier pages | ⚠️ Static | Not connected to DB |
| Product detail page | ⚠️ Static | Uses `catalog.ts`, not DB |
| Image handling | ⚠️ Placeholder | `picsum.photos` seed images |
| Production deployment | ❌ Not done | Dev only |

---

## Known Issues / Limitations

1. **Admin auth is demo-only** — any credentials work. No real JWT/session auth implemented yet.
2. **Product detail page** (`product.$id.tsx`) still uses static `catalog.ts` data — not wired to DB.
3. **Supplier pages** (`suppliers.$id.tsx`) are static; no Supplier model in DB yet.
4. **Images** are placeholder `picsum.photos` URLs — no image upload feature yet.
5. **`dev.db` is not seeded** — the public Products page will show empty state until an admin uploads and publishes products via the Upload workflow.
6. **CORS** is wide-open (`cors()` with no origin restriction) — fine for dev, needs restriction in production.

---

## Upcoming / Next Steps (Ideas)

- [ ] Real authentication (JWT or session-based) for the admin panel
- [ ] Seed script for initial demo products in the DB
- [ ] Connect `product.$id.tsx` detail page to live DB products
- [ ] Supplier model + supplier management in admin
- [ ] Image upload support (store images in object storage, reference URL in DB)
- [ ] Pagination for large product catalogues
- [ ] Email notification when a new enquiry is submitted
- [ ] Production deployment (backend to Railway/Render, frontend to Vercel/Cloudflare)
- [ ] Rate limiting and input sanitisation for production

---

*Last updated: 2026-08-06 by Antigravity (AI assistant)*
