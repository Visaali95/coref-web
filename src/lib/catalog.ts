export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  type: string;
  origin: string;
  originFlag: string;
  size: string;
  finish: string;
  material: string;
  priceMin: number;
  priceMax: number;
  unit: string;
  leadTime: string;
  moq: number;
  sample: boolean;
  inspection: boolean;
  supplier: string;
  supplierSlug: string;
  image: string;
  gallery: string[];
};

export const CATEGORIES = [
  { slug: "tiles-flooring", name: "Tiles & Flooring", count: 432, image: "https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=70" },
  { slug: "sanitaryware", name: "Sanitaryware & Fittings", count: 180, image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=70" },
  { slug: "surface-finishes", name: "Surface Finishes", count: 95, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70" },
  { slug: "machinery", name: "Industrial Machinery", count: 310, image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=70" },
  { slug: "structural", name: "Structural Materials", count: 140, image: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=800&q=70" },
  { slug: "lighting", name: "Lighting & Fixtures", count: 88, image: "https://images.unsplash.com/photo-1524634126442-357e0eac3c14?w=800&q=70" },
];

const baseImg = (seed: string) => `https://picsum.photos/seed/${seed}/900/600`;

export const PRODUCTS: Product[] = [
  // ─── Tiles & Flooring ────────────────────────────────────────────────────────
  {
    id: "p1", slug: "italian-marble-look-porcelain", name: "Italian Marble Look Porcelain Tile",
    category: "Tiles & Flooring", categorySlug: "tiles-flooring",
    type: "Porcelain", origin: "China", originFlag: "🇨🇳",
    size: "600×1200", finish: "Matt", material: "Porcelain",
    priceMin: 58, priceMax: 72, unit: "sqm",
    leadTime: "6–8 weeks", moq: 200, sample: true, inspection: true,
    supplier: "Guangdong Elite Ceramics", supplierSlug: "guangdong-elite-ceramics",
    image: baseImg("tile1"),
    gallery: [baseImg("tile1"), baseImg("tile1b"), baseImg("tile1c"), baseImg("tile1d")],
  },
  {
    id: "p2", slug: "carrara-statuario-marble", name: "Carrara Statuario Marble Slab",
    category: "Tiles & Flooring", categorySlug: "tiles-flooring",
    type: "Marble", origin: "Italy", originFlag: "🇮🇹",
    size: "800×800", finish: "Glossy", material: "Marble",
    priceMin: 180, priceMax: 240, unit: "sqm",
    leadTime: "8–12 weeks", moq: 100, sample: true, inspection: true,
    supplier: "Verona Stone Works", supplierSlug: "verona-stone-works",
    image: baseImg("tile2"),
    gallery: [baseImg("tile2"), baseImg("tile2b"), baseImg("tile2c"), baseImg("tile2d")],
  },
  {
    id: "p3", slug: "anatolian-travertine", name: "Anatolian Travertine Floor Tile",
    category: "Tiles & Flooring", categorySlug: "tiles-flooring",
    type: "Ceramic", origin: "Turkey", originFlag: "🇹🇷",
    size: "600×600", finish: "Textured", material: "Travertine",
    priceMin: 42, priceMax: 55, unit: "sqm",
    leadTime: "4–8 weeks", moq: 300, sample: true, inspection: false,
    supplier: "Izmir Tile Co.", supplierSlug: "izmir-tile-co",
    image: baseImg("tile3"),
    gallery: [baseImg("tile3"), baseImg("tile3b"), baseImg("tile3c"), baseImg("tile3d")],
  },

  // ─── Industrial Machinery ───────────────────────────────────────────────────
  {
    id: "p7", slug: "5-axis-cnc-milling-machine", name: "5-Axis High-Precision CNC Milling Machine",
    category: "Industrial Machinery", categorySlug: "machinery",
    type: "CNC Machine", origin: "China", originFlag: "🇨🇳",
    size: "2400×1800×2200", finish: "Industrial Powder Coat", material: "Cast Iron / Steel",
    priceMin: 18500, priceMax: 24000, unit: "unit",
    leadTime: "4–6 weeks", moq: 1, sample: false, inspection: true,
    supplier: "Jinan Precision CNC Equipment", supplierSlug: "jinan-precision-cnc",
    image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=70"],
  },
  {
    id: "p8", slug: "automatic-injection-molding-machine", name: "Automatic Plastic Injection Molding Machine (250T)",
    category: "Industrial Machinery", categorySlug: "machinery",
    type: "Molding Machine", origin: "China", originFlag: "🇨🇳",
    size: "5200×1400×1900", finish: "Standard Industrial", material: "Heavy Duty Alloy",
    priceMin: 14200, priceMax: 19500, unit: "unit",
    leadTime: "3–5 weeks", moq: 1, sample: false, inspection: true,
    supplier: "Ningbo Haitian Plastics Machinery", supplierSlug: "ningbo-haitian-machinery",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=70"],
  },
  {
    id: "p9", slug: "fiber-laser-cutting-machine", name: "3kW Fiber Laser Sheet Metal Cutting Machine",
    category: "Industrial Machinery", categorySlug: "machinery",
    type: "Laser Cutter", origin: "China", originFlag: "🇨🇳",
    size: "3000×1500", finish: "Enclosed Protective Case", material: "Steel Frame",
    priceMin: 22000, priceMax: 31000, unit: "unit",
    leadTime: "4–8 weeks", moq: 1, sample: false, inspection: true,
    supplier: "Wuhan Fiber Laser Tech", supplierSlug: "wuhan-fiber-laser",
    image: "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=800&q=70"],
  },
  {
    id: "p10", slug: "hydraulic-press-machine", name: "200-Ton Hydraulic Stamping Press Machine",
    category: "Industrial Machinery", categorySlug: "machinery",
    type: "Hydraulic Press", origin: "China", originFlag: "🇨🇳",
    size: "1800×1200×2800", finish: "Industrial Red/Blue", material: "Forged Steel",
    priceMin: 9800, priceMax: 13500, unit: "unit",
    leadTime: "4–6 weeks", moq: 1, sample: false, inspection: true,
    supplier: "Wuxi Hydraulic Heavy Industries", supplierSlug: "wuxi-hydraulic-ind",
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&q=70"],
  },

  // ─── Sanitaryware & Fittings ────────────────────────────────────────────────
  {
    id: "p11", slug: "wall-hung-smart-toilet", name: "Rimless Wall-Hung Smart Bidet Toilet",
    category: "Sanitaryware & Fittings", categorySlug: "sanitaryware",
    type: "Toilet", origin: "China", originFlag: "🇨🇳",
    size: "540×360×380", finish: "Glossy White Ceramic", material: "Vitreous China",
    priceMin: 320, priceMax: 450, unit: "piece",
    leadTime: "3–4 weeks", moq: 20, sample: true, inspection: true,
    supplier: "Foshan Arrow Sanitaryware", supplierSlug: "foshan-arrow-sanitary",
    image: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=70"],
  },
  {
    id: "p12", slug: "thermostatic-rainfall-shower-system", name: "Matt Black Thermostatic Concealed Shower System",
    category: "Sanitaryware & Fittings", categorySlug: "sanitaryware",
    type: "Shower System", origin: "China", originFlag: "🇨🇳",
    size: "300mm Head", finish: "Matt Black PVD", material: "Solid Brass",
    priceMin: 145, priceMax: 210, unit: "set",
    leadTime: "2–4 weeks", moq: 50, sample: true, inspection: true,
    supplier: "Kaiping Brass Hardware Mfg", supplierSlug: "kaiping-brass-mfg",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=70"],
  },

  // ─── Surface Finishes ───────────────────────────────────────────────────────
  {
    id: "p13", slug: "acoustic-slatted-wood-wall-panel", name: "Acoustic Natural Oak Slatted Wood Wall Panel",
    category: "Surface Finishes", categorySlug: "surface-finishes",
    type: "Wall Panel", origin: "China", originFlag: "🇨🇳",
    size: "2400×600×22", finish: "Natural Oak Veneer", material: "MDF + Acoustic Felt",
    priceMin: 28, priceMax: 42, unit: "sqm",
    leadTime: "2–3 weeks", moq: 100, sample: true, inspection: false,
    supplier: "Linyi Decor Wood Panels", supplierSlug: "linyi-decor-wood",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70"],
  },

  // ─── Structural Materials ──────────────────────────────────────────────────
  {
    id: "p14", slug: "galvanized-steel-structural-beam", name: "Hot-Dip Galvanized H-Beam Steel Structural Profile",
    category: "Structural Materials", categorySlug: "structural",
    type: "Steel Beam", origin: "China", originFlag: "🇨🇳",
    size: "H200×200×8×12", finish: "Hot-Dip Galvanized", material: "Q355B Steel",
    priceMin: 620, priceMax: 780, unit: "ton",
    leadTime: "4–6 weeks", moq: 10, sample: false, inspection: true,
    supplier: "Tangshan Iron & Steel Group", supplierSlug: "tangshan-steel-group",
    image: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=800&q=70"],
  },

  // ─── Lighting & Fixtures ───────────────────────────────────────────────────
  {
    id: "p15", slug: "architectural-linear-pendant-light", name: "Architectural LED Linear Continuous Pendant Light",
    category: "Lighting & Fixtures", categorySlug: "lighting",
    type: "Linear Light", origin: "China", originFlag: "🇨🇳",
    size: "1200mm / 2400mm", finish: "Anodized Aluminum", material: "Aluminum + PMMA",
    priceMin: 65, priceMax: 110, unit: "piece",
    leadTime: "3–4 weeks", moq: 30, sample: true, inspection: true,
    supplier: "Zhongshan Lighting Tech", supplierSlug: "zhongshan-lighting-tech",
    image: "https://images.unsplash.com/photo-1524634126442-357e0eac3c14?w=800&q=70",
    gallery: ["https://images.unsplash.com/photo-1524634126442-357e0eac3c14?w=800&q=70"],
  },
];

export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id || p.slug === id);
}

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function productsByCategory(slug: string) {
  return PRODUCTS.filter((p) => p.categorySlug === slug);
}
