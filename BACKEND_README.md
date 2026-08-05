# Coref Admin — Backend Developer Guide

> Internal admin panel for managing the Coref product catalogue, supplier uploads, and customer enquiries.

---

## 📁 Project Structure

```
coref-web/
├── src/                          # Frontend (TanStack Router + React)
│   ├── routes/
│   │   ├── admin.tsx             # Main admin panel (all admin components)
│   │   ├── enquiry.tsx           # Customer-facing enquiry form
│   │   └── index.tsx             # Landing page
│   ├── lib/
│   │   └── api.ts                # apiFetch() helper, apiUrl() util
│   └── components/
│       └── coref/                # Shared UI components
│
└── backend/                      # Backend (Express + Prisma + SQLite)
    ├── prisma/
    │   ├── schema.prisma         # DB schema (Product, Enquiry models)
    │   └── dev.db                # SQLite database file (auto-generated)
    ├── src/
    │   ├── index.ts              # Express app entry point
    │   ├── routes/
    │   │   ├── products.ts       # /api/products — CRUD
    │   │   ├── enquiries.ts      # /api/enquiries — GET + PUT (+ POST needed)
    │   │   └── upload.ts         # /api/upload/pdf — PDF parsing
    │   ├── services/
    │   │   ├── productService.ts # Prisma queries for Product
    │   │   ├── enquiryService.ts # Prisma queries for Enquiry
    │   │   └── pdfService.ts     # PDF text extraction + category suggestion
    │   └── lib/
    │       ├── db.ts             # Prisma client singleton
    │       └── aiClient.ts       # [TODO] AI extraction wrapper (optional)
    ├── package.json
    └── tsconfig.json
```

---

## 🛠 Tech Stack

### Frontend
| Package | Role |
|---|---|
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Server state management (data fetching, caching, mutations) |
| `react` v19 | UI framework |
| `tailwindcss` v4 | Utility CSS |
| `@radix-ui/*` | Accessible UI primitives (dialogs, selects, etc.) |
| `lucide-react` | Icon set |
| `zod` | Schema validation (shared with backend) |
| `vite` | Build tool + dev server |

### Backend
| Package | Role |
|---|---|
| `express` v4 | HTTP server framework |
| `cors` | Cross-origin request headers |
| `multer` | File upload handling (multipart/form-data) |
| `pdf-parse` | Extract raw text from PDF buffers |
| `prisma` + `@prisma/client` | ORM + type-safe DB client |
| `zod` | Request body validation |
| `ts-node-dev` | TypeScript dev runner with hot-reload |
| `typescript` v5 | Type system |

### Database
| Environment | Database |
|---|---|
| Development | **SQLite** (`backend/prisma/dev.db`) |
| Production (recommended) | **PostgreSQL** via Supabase / Railway / Neon |

---

## 🗄 Database Schema

```prisma
// backend/prisma/schema.prisma

model Product {
  id         Int      @id @default(autoincrement())
  name       String
  category   String
  supplier   String
  fobPrice   String
  leadTime   String?            // Optional — from PDF or manual entry
  status     String             // "Draft" | "Published" | "Needs Review"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Enquiry {
  id          Int      @id @default(autoincrement())
  reference   String   @unique  // e.g. "ENQ-20260805-0001"
  name        String
  company     String
  role        String
  items       String            // Comma-separated product names
  message     String
  submittedAt DateTime @default(now())
  status      String   @default("New")  // "New" | "In Progress" | "Quoted" | "Closed"
  email       String?
  phone       String?
}
```

---

## 🔌 API Endpoints

### Products
| Method | URL | Body | Description |
|---|---|---|---|
| `GET` | `/api/products` | — | List all products |
| `GET` | `/api/products/:id` | — | Get single product |
| `POST` | `/api/products` | `{ name, category, supplier, fobPrice, status, leadTime? }` | Create product |
| `PUT` | `/api/products/:id` | partial fields | Update product |
| `DELETE` | `/api/products/:id` | — | Delete product |

### Enquiries
| Method | URL | Body | Description |
|---|---|---|---|
| `GET` | `/api/enquiries` | — | List all enquiries (ordered by newest) |
| `GET` | `/api/enquiries/:id` | — | Get single enquiry |
| `POST` | `/api/enquiries` | `{ name, company, role, items, message, email?, phone? }` | Submit new enquiry (customer form) |
| `PUT` | `/api/enquiries/:id` | `{ status }` | Update enquiry status |

### Upload
| Method | URL | Body | Description |
|---|---|---|---|
| `POST` | `/api/upload/pdf` | `multipart/form-data` with `file` field | Upload PDF → returns `{ suggestions: PdfSuggestion[] }` |

---

## 🧩 Service Layer

### `productService.ts`
```typescript
getProducts()               // → Product[]
getProductById(id)          // → Product | null
createProduct(data)         // → Product
updateProduct(id, data)     // → Product
deleteProduct(id)           // → void
```

### `enquiryService.ts`
```typescript
getEnquiries()                    // → Enquiry[]
getEnquiryById(id)                // → Enquiry | null
createEnquiry(data)               // → Enquiry (with auto-generated reference)
updateEnquiryStatus(id, status)   // → Enquiry
```

### `pdfService.ts`
```typescript
parsePdfBuffer(buffer)            // → ParsedProductSuggestion[]
extractProductCandidates(text)    // → ParsedProductSuggestion[]
suggestCategory(text)             // → string (category name)

// [Optional — with AI]
extractWithAI(text)               // → ParsedProductSuggestion[] (calls LLM API)
```

---

## 🤖 PDF Catalogue Parsing — Strategy Options

The PDF upload extracts product names and suggests categories. There are three approaches:

### Option A — Enhanced Keyword Matching (Current + Improved)
**Best for:** Getting started quickly, no external dependencies.

Expand the keyword dictionary in `pdfService.ts`:
```typescript
const CATEGORY_KEYWORDS = {
  // Tiles
  'tile': 'Tiles & Flooring',
  'porcelain': 'Tiles & Flooring',
  'ceramic': 'Tiles & Flooring',
  'mosaic': 'Tiles & Flooring',
  'marble': 'Tiles & Flooring',
  // Sanitaryware
  'sanitary': 'Sanitaryware',
  'basin': 'Sanitaryware',
  'toilet': 'Sanitaryware',
  'shower': 'Sanitaryware',
  // ... 40+ more
};
```
Add regex for FOB prices (`/USD?\s*[\d,]+\.?\d*/i`) and lead times (`/\d+\s*(?:weeks?|days?)/i`).

**Cost:** Free | **Accuracy:** Medium (misses novel product names)

---

### Option B — OpenAI / Gemini API
**Best for:** High accuracy, complex catalogues with mixed formatting.

1. Install: `npm install openai` (or `@google/generative-ai`)
2. Add to `.env`:
   ```
   USE_AI_EXTRACTION=true
   OPENAI_API_KEY=sk-...
   # or
   GEMINI_API_KEY=AIza...
   ```
3. In `pdfService.ts`, call the API with a structured prompt:
   ```
   You are a product data extractor. Given catalogue text, return JSON array:
   [{ "name": "...", "category": "Tiles & Flooring|Sanitaryware|Machinery|...", "fobPrice": "...", "leadTime": "..." }]
   ```

**Cost:** ~$0.01–0.05 per PDF | **Accuracy:** High | **Latency:** 2–5s

---

### Option C — Local Ollama (Self-hosted LLM)
**Best for:** Privacy-sensitive data, no API costs, offline use.

1. Install [Ollama](https://ollama.com) and pull a model: `ollama pull llama3`
2. Call `http://localhost:11434/api/generate` from `pdfService.ts`

**Cost:** Free | **Accuracy:** Medium-High (depends on model) | **Requires:** Ollama installed + RAM

---

## 🚀 Getting Started

### 1. Frontend
```bash
# From coref-web/
npm install
npm run dev         # → http://localhost:5173
```

### 2. Backend
```bash
# From coref-web/backend/
npm install
npx prisma generate          # Generate Prisma client
npx prisma migrate dev       # Create/migrate SQLite DB
npm run dev                  # → http://localhost:4000
```

### 3. Environment Variables
Create `backend/.env`:
```env
DATABASE_URL="file:./prisma/dev.db"
PORT=4000

# Optional — AI-powered PDF extraction
USE_AI_EXTRACTION=false
OPENAI_API_KEY=
GEMINI_API_KEY=
```

---

## 📋 What Needs to Be Built

### ✅ Already Working
- Product list, create, edit (inline) APIs
- Enquiry list, status update APIs
- PDF upload + keyword-based extraction

### 🔧 To Be Implemented (Priority Order)

1. **`POST /api/enquiries`** — Receive enquiries from the customer form
   - File: `backend/src/routes/enquiries.ts`
   - Auto-generate `reference` field (e.g., `ENQ-20260805-0001`)

2. **Product View Modal** — Replace `window.alert()` with a proper modal/drawer
   - File: `src/routes/admin.tsx` — `CataloguePage`

3. **Enquiries UI enhancements**
   - Status filter tabs
   - Full message view (expandable row or modal)
   - Show email + phone columns
   - File: `src/routes/admin.tsx` — `EnquiriesPage`

4. **`leadTime` field on Product**
   - DB migration: add `leadTime String?` to `Product`
   - Update backend validation schema
   - Update frontend create/edit form

5. **Enhanced PDF extraction** (`pdfService.ts`)
   - Expand keyword map
   - Add FOB price + lead time regex
   - Wire up AI client (if chosen)

6. **`aiClient.ts`** _(optional, if using AI)_
   - Thin wrapper for OpenAI or Gemini API
   - Gated by `USE_AI_EXTRACTION` env var

---

## 🔒 Auth (Future Scope)

Current auth is demo-only (any credentials work, stored in `sessionStorage`). For production, consider:
- **Supabase Auth** — JWT-based, easy to integrate with existing Supabase DB
- **Express sessions** — Cookie-based, simple for internal tools
- **Clerk** — Full auth service, easy setup

---

## 🧪 Testing the APIs

```bash
# Health check
curl http://localhost:4000/api/health

# Get all products
curl http://localhost:4000/api/products

# Create a product
curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Marble Floor Tile 60x60","category":"Tiles & Flooring","supplier":"Elite Ceramics","fobPrice":"USD 8.50","status":"Draft"}'

# Get all enquiries
curl http://localhost:4000/api/enquiries

# Submit an enquiry (customer form)
curl -X POST http://localhost:4000/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{"name":"Rajesh Kumar","company":"BuildWell Pvt Ltd","role":"Procurement Manager","items":"Marble Tiles, Bathroom Fixtures","message":"Looking for 5000 sqm of floor tiles for a commercial project.","email":"rajesh@buildwell.in","phone":"+91 9876543210"}'

# Upload a PDF
curl -X POST http://localhost:4000/api/upload/pdf \
  -F "file=@./sample-catalogue.pdf"
```
