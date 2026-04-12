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
    name: "Ốc",
    description: "Nhóm ốc chính của quán để tạo món và cập kho hiện tại.",
    sortOrder: 1,
  },
  {
    slug: "hai-manh",
    name: "Hải mảnh",
    description: "Nhóm sò, ngao, nghêu, hàu và càng ghẹ.",
    sortOrder: 2,
  },
  {
    slug: "khac",
    name: "Khác",
    description: "Các nguyên liệu còn lại như vịt lộn và mì.",
    sortOrder: 3,
  },
];

export const seedIngredients: SeedIngredient[] = [
  { slug: "oc-huong", name: "Ốc hương", unit: "phần", demoStockQuantity: 20 },
  { slug: "oc-mo", name: "Ốc mỡ", unit: "phần", demoStockQuantity: 22 },
  { slug: "oc-gao", name: "Ốc gạo", unit: "phần", demoStockQuantity: 18 },
  { slug: "oc-lac", name: "Ốc lác", unit: "phần", demoStockQuantity: 18 },
  { slug: "oc-dua", name: "Ốc dừa", unit: "phần", demoStockQuantity: 18 },
  { slug: "oc-toi", name: "Ốc tỏi", unit: "phần", demoStockQuantity: 16 },
  { slug: "oc-mong-tay", name: "Ốc móng tay", unit: "phần", demoStockQuantity: 18 },
  { slug: "so-long", name: "Sò lông", unit: "phần", demoStockQuantity: 16 },
  { slug: "so-huyet", name: "Sò huyết", unit: "phần", demoStockQuantity: 16 },
  { slug: "so-lua", name: "Sò lụa", unit: "phần", demoStockQuantity: 16 },
  { slug: "ngao-2-coi", name: "Ngao 2 còi", unit: "phần", demoStockQuantity: 18 },
  { slug: "chem-chep", name: "Chem chép", unit: "phần", demoStockQuantity: 18 },
  { slug: "ngheu", name: "Nghêu", unit: "phần", demoStockQuantity: 18 },
  { slug: "hau", name: "Hàu", unit: "con", demoStockQuantity: 24 },
  { slug: "vit-lon", name: "Vịt lộn", unit: "trứng", demoStockQuantity: 16 },
  { slug: "mi", name: "Mì", unit: "phần", demoStockQuantity: 20 },
  { slug: "cang-ghe", name: "Càng ghẹ", unit: "phần", demoStockQuantity: 18 },
];
