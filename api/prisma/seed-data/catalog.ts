export type SeedCategory = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type SeedIngredient = {
  slug: string;
  name: string;
  unit: string;
  description?: string;
  demoStockQuantity: number;
};

export const seedCategories: SeedCategory[] = [
  {
    slug: "oc",
    name: "Oc",
    description: "Nhom oc chinh cua quan de tao mon va cap kho hien tai.",
    sortOrder: 1,
  },
  {
    slug: "hai-manh",
    name: "Hai manh",
    description: "Nhom so, ngao, ngheu, hau, 2 manh va cang ghe.",
    sortOrder: 2,
  },
  {
    slug: "khac",
    name: "Khac",
    description: "Cac nguyen lieu con lai nhu vit lon va mi.",
    sortOrder: 3,
  },
];

export const seedIngredients: SeedIngredient[] = [
  { slug: "oc-huong-xl", name: "Oc huong XL", unit: "phan", demoStockQuantity: 12 },
  { slug: "oc-huong", name: "Oc huong", unit: "phan", demoStockQuantity: 12 },
  { slug: "oc-mo", name: "Oc mo", unit: "phan", demoStockQuantity: 14 },
  { slug: "oc-gao", name: "Oc gao", unit: "phan", demoStockQuantity: 14 },
  { slug: "oc-lac", name: "Oc lac", unit: "phan", demoStockQuantity: 12 },
  { slug: "oc-dua", name: "Oc dua", unit: "phan", demoStockQuantity: 12 },
  { slug: "oc-toi-xxl", name: "Oc toi XXL", unit: "phan", demoStockQuantity: 10 },
  { slug: "oc-toi-xl", name: "Oc toi XL", unit: "phan", demoStockQuantity: 10 },
  { slug: "oc-toi", name: "Oc toi", unit: "phan", demoStockQuantity: 10 },
  { slug: "oc-mong-tay", name: "Oc mong tay", unit: "phan", demoStockQuantity: 14 },
  { slug: "so-long", name: "So long", unit: "phan", demoStockQuantity: 12 },
  { slug: "so-huyet", name: "So huyet", unit: "phan", demoStockQuantity: 12 },
  { slug: "so-lua", name: "So lua", unit: "phan", demoStockQuantity: 12 },
  { slug: "ngao-2-coi", name: "Ngao 2 coi", unit: "phan", demoStockQuantity: 12 },
  { slug: "chem-chep", name: "Chem chep", unit: "phan", demoStockQuantity: 12 },
  { slug: "ngheu", name: "Ngheu", unit: "phan", demoStockQuantity: 12 },
  { slug: "hau-xl", name: "Hau XL", unit: "con", demoStockQuantity: 24 },
  { slug: "hau", name: "Hau", unit: "con", demoStockQuantity: 24 },
  { slug: "vit-lon", name: "Vit lon", unit: "trung", demoStockQuantity: 20 },
  { slug: "mi", name: "Mi", unit: "phan", demoStockQuantity: 20 },
  { slug: "cang-ghe-xl", name: "Cang ghe XL", unit: "phan", demoStockQuantity: 10 },
  { slug: "cang-ghe", name: "Cang ghe", unit: "phan", demoStockQuantity: 12 },
];
