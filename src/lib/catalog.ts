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
  {
    id: "p4", slug: "valencia-glossy-ceramic", name: "Valencia Glossy Ceramic Wall Tile",
    category: "Tiles & Flooring", categorySlug: "tiles-flooring",
    type: "Ceramic", origin: "Spain", originFlag: "🇪🇸",
    size: "600×1200", finish: "Glossy", material: "Ceramic",
    priceMin: 38, priceMax: 52, unit: "sqm",
    leadTime: "6–8 weeks", moq: 250, sample: true, inspection: true,
    supplier: "Castellón Ceramica", supplierSlug: "castellon-ceramica",
    image: baseImg("tile4"),
    gallery: [baseImg("tile4"), baseImg("tile4b"), baseImg("tile4c"), baseImg("tile4d")],
  },
  {
    id: "p5", slug: "morbi-vitrified-tile", name: "Morbi Premium Vitrified Tile",
    category: "Tiles & Flooring", categorySlug: "tiles-flooring",
    type: "Porcelain", origin: "India", originFlag: "🇮🇳",
    size: "800×800", finish: "Satin", material: "Vitrified",
    priceMin: 28, priceMax: 38, unit: "sqm",
    leadTime: "Under 4 weeks", moq: 500, sample: true, inspection: false,
    supplier: "Morbi Tile Exporters", supplierSlug: "morbi-tile-exporters",
    image: baseImg("tile5"),
    gallery: [baseImg("tile5"), baseImg("tile5b"), baseImg("tile5c"), baseImg("tile5d")],
  },
  {
    id: "p6", slug: "nero-mosaic-feature", name: "Nero Mosaic Feature Wall Tile",
    category: "Tiles & Flooring", categorySlug: "tiles-flooring",
    type: "Mosaic", origin: "Italy", originFlag: "🇮🇹",
    size: "Custom", finish: "Matt", material: "Mosaic",
    priceMin: 120, priceMax: 165, unit: "sqm",
    leadTime: "8–12 weeks", moq: 50, sample: true, inspection: true,
    supplier: "Verona Stone Works", supplierSlug: "verona-stone-works",
    image: baseImg("tile6"),
    gallery: [baseImg("tile6"), baseImg("tile6b"), baseImg("tile6c"), baseImg("tile6d")],
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
