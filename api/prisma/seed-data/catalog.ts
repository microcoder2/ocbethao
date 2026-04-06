import { DailyMenuStatus } from "@prisma/client";

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
    description: "Nhóm ốc chính của quán để tạo món và cấp kho theo ngày.",
    sortOrder: 1,
  },
  {
    slug: "hai-manh",
    name: "Hai mảnh",
    description: "Nhóm sò, ngao, nghêu, hàu, 2 mảnh và càng ghẹ.",
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
  { slug: "oc-huong-xl", name: "Ốc hương XL", unit: "phần", demoStockQuantity: 12 },
  { slug: "oc-huong", name: "Ốc hương", unit: "phần", demoStockQuantity: 12 },
  { slug: "oc-mo", name: "Ốc mỡ", unit: "phần", demoStockQuantity: 14 },
  { slug: "oc-gao", name: "Ốc gạo", unit: "phần", demoStockQuantity: 14 },
  { slug: "oc-lac", name: "Ốc lác", unit: "phần", demoStockQuantity: 12 },
  { slug: "oc-dua", name: "Ốc dừa", unit: "phần", demoStockQuantity: 12 },
  { slug: "oc-toi-xxl", name: "Ốc tỏi XXL", unit: "phần", demoStockQuantity: 10 },
  { slug: "oc-toi-xl", name: "Ốc tỏi XL", unit: "phần", demoStockQuantity: 10 },
  { slug: "oc-toi", name: "Ốc tỏi", unit: "phần", demoStockQuantity: 10 },
  { slug: "oc-mong-tay", name: "Ốc móng tay", unit: "phần", demoStockQuantity: 14 },
  { slug: "so-long", name: "Sò lông", unit: "phần", demoStockQuantity: 12 },
  { slug: "so-huyet", name: "Sò huyết", unit: "phần", demoStockQuantity: 12 },
  { slug: "so-lua", name: "Sò lụa", unit: "phần", demoStockQuantity: 12 },
  { slug: "ngao-2-coi", name: "Ngao 2 còi", unit: "phần", demoStockQuantity: 12 },
  { slug: "chem-chep", name: "Chem chép", unit: "phần", demoStockQuantity: 12 },
  { slug: "ngheu", name: "Ngêu", unit: "phần", demoStockQuantity: 12 },
  { slug: "hau-xl", name: "Hàu XL", unit: "con", demoStockQuantity: 24 },
  { slug: "hau", name: "Hàu", unit: "con", demoStockQuantity: 24 },
  { slug: "vit-lon", name: "Vịt lộn", unit: "trứng", demoStockQuantity: 20 },
  { slug: "mi", name: "Mì", unit: "phần", demoStockQuantity: 20 },
  { slug: "cang-ghe-xl", name: "Càng ghẹ XL", unit: "phần", demoStockQuantity: 10 },
  { slug: "cang-ghe", name: "Càng ghẹ", unit: "phần", demoStockQuantity: 12 },
];

export const demoTodayMenu = {
  status: DailyMenuStatus.DRAFT,
  title: "Menu nguyên liệu hôm nay",
  note: "Seed dev chỉ tạo kho nguyên liệu và danh mục gốc, chưa clone ngân hàng món.",
  bannerText: "Tạo món từ nguyên liệu và cách nấu trong admin trước khi đăng menu.",
};
