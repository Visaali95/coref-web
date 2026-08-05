# Coref Backend API

> REST API powering the **Coref Web** platform — built with **Express**, **Prisma ORM**, and **SQLite**.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Running the Server](#running-the-server)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [Products](#products)
  - [Enquiries](#enquiries)
  - [PDF Upload](#pdf-upload)
- [Database Schema](#database-schema)
- [Frontend Integration](#frontend-integration)
- [Scripts](#scripts)

---

## Overview

The Coref Backend is a lightweight Express.js REST API that manages:

- **Products** — Full CRUD for the product catalog (name, category, supplier, FOB price, lead time, status)
- **Enquiries** — Customer enquiry submissions with auto-generated references and status management
- **PDF Parsing** — Accept uploaded PDF files and extract product suggestions from their content

It communicates with the **Coref Web** React/TanStack Start frontend over HTTP.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (≥ 20) |
| Language | TypeScript 5 |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | SQLite (`prisma/dev.db`) |
| Validation | Zod |
| PDF Parsing | pdf-parse |
| File Uploads | Multer |
| Dev server | ts-node-dev |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma        # Database schema (Product, Enquiry models)
│   └── dev.db               # SQLite database file (auto-generated)
├── src/
│   ├── index.ts             # Express app entry — registers routes, starts server
│   ├── lib/
│   │   └── db.ts            # Prisma client singleton
│   ├── routes/
│   │   ├── products.ts      # /api/products — full CRUD
│   │   ├── enquiries.ts     # /api/enquiries — list, get, create, update status
│   │   └── upload.ts        # /api/upload/pdf — PDF file parsing
│   └── services/
│       ├── productService.ts   # Prisma queries for Product
│       ├── enquiryService.ts   # Prisma queries for Enquiry
│       └── pdfService.ts       # PDF buffer parsing logic
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20 — [Download](https://nodejs.org)
- **npm** ≥ 9

### Installation

```bash
# From the repo root, navigate into backend
cd backend

# Install dependencies
npm install
```

### Database Setup

Prisma manages the SQLite database. Run migrations to create the schema and generate the client:

```bash
# Create the database and run migrations
npm run prisma:migrate

# (Re-)generate the Prisma client after schema changes
npm run prisma:generate
```

> The SQLite database file is created automatically at `prisma/dev.db`.

### Running the Server

```bash
# Start the development server with hot-reload
npm run dev
```

The API will be available at **http://localhost:4000**.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Port the Express server listens on |

Create a `.env` file in the `backend/` directory to override defaults:

```env
PORT=4000
```

---

## API Reference

All endpoints are prefixed with `/api`. The server returns JSON for all responses.

---

### Health Check

#### `GET /api/health`

Confirms the server is running.

**Response**
```json
{ "status": "ok" }
```

---

### Products

Base path: `/api/products`

#### `GET /api/products`

Returns all products, ordered by most recently updated.

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Ceramic Mug",
    "category": "Kitchenware",
    "supplier": "Acme Co.",
    "fobPrice": "$2.50",
    "leadTime": "30 days",
    "status": "Active",
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-05T12:00:00.000Z"
  }
]
```

---

#### `GET /api/products/:id`

Returns a single product by ID.

**Response** `200 OK` — product object
**Response** `404 Not Found` — `{ "message": "Product not found" }`

---

#### `POST /api/products`

Creates a new product.

**Request Body**
```json
{
  "name": "Ceramic Mug",
  "category": "Kitchenware",
  "supplier": "Acme Co.",
  "fobPrice": "$2.50",
  "leadTime": "30 days",
  "status": "Active"
}
```

| Field | Type | Required |
|---|---|---|
| `name` | `string` | ✅ |
| `category` | `string` | ✅ |
| `supplier` | `string` | ✅ |
| `fobPrice` | `string` | ✅ |
| `status` | `string` | ✅ |
| `leadTime` | `string` | ❌ optional |

**Response** `201 Created` — created product object
**Response** `400 Bad Request` — Zod validation errors

---

#### `PUT /api/products/:id`

Partially updates an existing product (all fields optional).

**Request Body** — any subset of the product fields
**Response** `200 OK` — updated product object
**Response** `404 Not Found` — `{ "message": "Product not found" }`

---

#### `DELETE /api/products/:id`

Deletes a product by ID.

**Response** `204 No Content`
**Response** `404 Not Found` — `{ "message": "Product not found" }`

---

### Enquiries

Base path: `/api/enquiries`

#### `GET /api/enquiries`

Returns all enquiries, ordered by most recently submitted.

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "reference": "ENQ-20260805-A3B2",
    "name": "John Doe",
    "company": "Retail Ltd.",
    "role": "Buyer",
    "email": "john@retail.com",
    "phone": "+44 7700 900000",
    "items": "Ceramic Mug x500",
    "message": "Please send us a quote.",
    "status": "New",
    "submittedAt": "2026-08-05T10:00:00.000Z"
  }
]
```

---

#### `GET /api/enquiries/:id`

Returns a single enquiry by ID.

**Response** `200 OK` — enquiry object
**Response** `404 Not Found` — `{ "message": "Enquiry not found" }`

---

#### `POST /api/enquiries`

Submits a new customer enquiry. A unique reference (`ENQ-YYYYMMDD-XXXX`) is auto-generated and the status defaults to `"New"`.

**Request Body**
```json
{
  "name": "John Doe",
  "company": "Retail Ltd.",
  "role": "Buyer",
  "email": "john@retail.com",
  "phone": "+44 7700 900000",
  "items": "Ceramic Mug x500",
  "message": "Please send us a quote."
}
```

| Field | Type | Required |
|---|---|---|
| `name` | `string` | ✅ |
| `company` | `string` | ✅ |
| `role` | `string` | ✅ |
| `items` | `string` | ✅ |
| `message` | `string` | ✅ |
| `email` | `string` (email) | ❌ optional |
| `phone` | `string` | ❌ optional |

**Response** `201 Created` — created enquiry object (includes auto-generated `reference`)
**Response** `400 Bad Request` — Zod validation errors
**Response** `500 Internal Server Error` — unexpected failure

---

#### `PUT /api/enquiries/:id`

Updates the status of an enquiry (e.g., `"New"` → `"In Progress"` → `"Closed"`).

**Request Body**
```json
{ "status": "In Progress" }
```

**Response** `200 OK` — updated enquiry object
**Response** `404 Not Found` — `{ "message": "Enquiry not found" }`

---

### PDF Upload

#### `POST /api/upload/pdf`

Accepts a PDF file and returns a list of parsed product suggestions extracted from the document.

**Request** — `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | `File` (PDF) | The PDF to parse. Max size: **50 MB** |

**Response** `200 OK`
```json
{
  "suggestions": [
    "Ceramic Mug",
    "Stainless Steel Bottle"
  ]
}
```

**Response** `400 Bad Request` — `{ "message": "PDF file is required" }`
**Response** `500 Internal Server Error` — `{ "message": "Failed to parse PDF" }`

---

## Database Schema

Defined in [`prisma/schema.prisma`](./prisma/schema.prisma). Uses **SQLite**.

### `Product`

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` | Auto-incremented primary key |
| `name` | `String` | Product name |
| `category` | `String` | Product category |
| `supplier` | `String` | Supplier name |
| `fobPrice` | `String` | FOB price (stored as string for flexibility) |
| `leadTime` | `String?` | Optional lead time |
| `status` | `String` | e.g. `"Active"`, `"Inactive"` |
| `createdAt` | `DateTime` | Auto-set on creation |
| `updatedAt` | `DateTime` | Auto-updated on every save |

### `Enquiry`

| Column | Type | Notes |
|---|---|---|
| `id` | `Int` | Auto-incremented primary key |
| `reference` | `String` | Unique — format `ENQ-YYYYMMDD-XXXX` |
| `name` | `String` | Contact name |
| `company` | `String` | Company name |
| `role` | `String` | Contact role/title |
| `email` | `String?` | Optional email |
| `phone` | `String?` | Optional phone |
| `items` | `String` | Items being enquired about |
| `message` | `String` | Enquiry message body |
| `status` | `String` | Default `"New"` |
| `submittedAt` | `DateTime` | Auto-set on creation |

---

## Frontend Integration

The backend is consumed by the **Coref Web** frontend (TanStack Start + React + Tailwind CSS).

### Connection

The frontend resolves the API base URL via the environment variable:

```
VITE_API_BASE_URL=http://localhost:4000
```

If not set, it defaults to `http://localhost:4000` automatically (see `src/lib/api.ts`).

### Frontend API Helper

All HTTP calls go through [`src/lib/api.ts`](../src/lib/api.ts):

```ts
// Build a full API URL
apiUrl("/api/products")          // → "http://localhost:4000/api/products"

// Typed fetch helper (throws on non-2xx responses)
const products = await apiFetch<Product[]>("/api/products");
```

### Running Both Together (Local Development)

Open **two terminals** from the project root:

```bash
# Terminal 1 — Frontend (http://localhost:3000)
npm run dev

# Terminal 2 — Backend (http://localhost:4000)
cd backend
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Health Check | http://localhost:4000/api/health |

### Request Flow

```
Browser
  └── TanStack Router page/component
        └── apiFetch("/api/...") [src/lib/api.ts]
              └── fetch() → http://localhost:4000/api/...
                    └── Express route handler
                          └── Prisma service → SQLite DB
```

---

## Scripts

Run these from inside the `backend/` directory:

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start dev server with hot-reload (ts-node-dev) |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `prisma:generate` | `npm run prisma:generate` | Regenerate Prisma client after schema changes |
| `prisma:migrate` | `npm run prisma:migrate` | Run migrations and update the database |

---

> **Note:** The `prisma/dev.db` SQLite file is local-only and not committed to version control. Run `npm run prisma:migrate` on first setup to create it.
