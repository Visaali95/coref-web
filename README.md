# Coref Web

## Overview

This repository currently contains the frontend for the Coref admin panel built with React, Vite, TypeScript, Tailwind, and TanStack tooling.

The next phase is to add a backend API and a database so the admin panel can:

- manage product catalogue items
- upload and parse supplier PDF catalogues
- store and update enquiries from customers
- support edit/view actions for products and enquiries

## Recommended Tech Stack

### Frontend

- React + TypeScript
- Vite
- Tailwind CSS
- TanStack Router
- React Query for data fetching
- React Hook Form for admin forms
- Lucide icons for UI

### Backend

- Node.js + TypeScript
- Express or Fastify for REST API
- Prisma ORM for database access
- SQLite for local development
- PostgreSQL for production scaling
- Multer for PDF uploads
- `pdf-parse` or `pdfjs-dist` for initial PDF text extraction

### Database

Start with SQLite locally as a simple file-backed database:

- products table
- enquiries table
- uploaded_catalogues table (optional)

Later migrate to PostgreSQL or MySQL when you need production reliability.

## Proposed Folder Structure

```
coref-web/
  README.md
  package.json
  src/
    routes/
      admin.tsx
      ...
  backend/
    package.json
    tsconfig.json
    prisma/
      schema.prisma
    src/
      index.ts
      routes/
        products.ts
        enquiries.ts
        upload.ts
      services/
        productService.ts
        enquiryService.ts
        pdfService.ts
      lib/
        db.ts
```

## Backend API Plan

### Products

- `GET /api/products` - list all products
- `GET /api/products/:id` - get a single product
- `POST /api/products` - create a product
- `PUT /api/products/:id` - update product details
- `DELETE /api/products/:id` - remove product (optional)

Fields for product catalogue:

- `id`
- `name`
- `category`
- `supplier`
- `fob_price`
- `status`
- `created_at`
- `updated_at`

### PDF Upload

- `POST /api/upload-pdf`
  - receive a PDF file
  - parse text from PDF
  - return extracted product suggestions
  - return suggested category values

For an MVP, the PDF upload can store the file and parse text lines using a PDF parsing library. You can then present parsed results in the admin UI for review before creating the product records.

### Enquiries

- `GET /api/enquiries` - list all enquiries
- `GET /api/enquiries/:id` - view enquiry details
- `PUT /api/enquiries/:id` - update enquiry status

Fields for enquiries:

- `id`
- `reference`
- `name`
- `company`
- `role`
- `items`
- `message`
- `submitted_at`
- `status`
- `email`
- `phone`

## Service Layer Design

Create a service layer inside the backend to keep business logic out of routes:

- `productService.ts`
  - createProduct(data)
  - updateProduct(id, data)
  - getProducts(filters)
  - getProductById(id)

- `enquiryService.ts`
  - getEnquiries(filters)
  - getEnquiryById(id)
  - updateEnquiryStatus(id, status)

- `pdfService.ts`
  - parsePdfBuffer(buffer)
  - extractProductCandidates(text)
  - suggestCategories(extracted)

- `db.ts`
  - initialize Prisma / database connection
  - expose repository methods

This keeps API routes thin and makes it easy to swap storage later.

## PDF Extraction Idea

For the first version, keep the PDF extraction simple:

1. upload the PDF file from the admin panel
2. backend saves it temporarily
3. backend uses a PDF parser to extract plain text
4. detect product lines by pattern matching
5. map strong keywords to categories
6. return suggested product objects to the frontend

Example suggestions:

- Recognize likely product name by heading text
- Recognize supplier by file metadata or field data
- Suggest categories using a keyword map like `tiles`, `mosaic`, `lighting`, `machinery`

This is a good starting point. Later, replace heuristics with an AI/ML model or a PDF extraction pipeline when you want better product detection.

## What to Build First

1. backend skeleton with Express + Prisma + SQLite
2. products API and database table
3. frontend product catalogue CRUD UI inside `admin.tsx`
4. enquiries API and edit-status UI
5. PDF upload endpoint and simple parse flow
6. wire React Query to backend endpoints

## Suggested Next Tasks

- Add a `backend/` folder and initialize `npm` there
- Define `prisma/schema.prisma` with `Product` and `Enquiry`
- Build REST routes for products, enquiries, and PDF upload
- Replace mock frontend state in `admin.tsx` with API calls
- Add service functions to handle validation and database operations
- Add a simple admin login guard for the backend later

## Notes for the Admin UI

### Product Catalogue

The upload catalogue area should allow the admin to:

- create a new product record manually
- choose category, supplier, FOB price, status
- save it to the backend
- edit and view existing records

### Upload PDF

This should be a separate upload flow in the admin panel:

- select a PDF file
- send it to `/api/upload-pdf`
- show parsed suggestions in a review table
- allow admin to confirm or edit suggested product fields
- publish validated products into the catalogue

### Enquiries

- list enquiries from customers
- show status chip
- allow inline status editing or modal edit
- save status changes via `/api/enquiries/:id`

## Summary

This README provides a clear path from your current frontend-only admin panel to a full backend-driven product and enquiries management system. Start by building the backend API and DB schema, then wire the current UI to those APIs and add the PDF upload flow as a second stage.
