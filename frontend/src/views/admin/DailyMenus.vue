<template>
  <div class="admin-daily-menu d-grid gap-4">
    <section class="page-panel admin-daily-menu__hero">
      <div class="admin-daily-menu__hero-head">
        <div class="admin-daily-menu__hero-copy">
          <div class="admin-daily-menu__eyebrow">Menu thông minh</div>
          <h2 class="admin-daily-menu__title">{{ form.id ? "Chỉnh menu ngày" : "Tạo menu ngày" }}</h2>
          <p class="admin-daily-menu__description">
            Nhập nhanh tag món chính trước, hệ thống sẽ giữ nguồn hàng theo tag và kéo các món liên quan lên đầu.
          </p>
        </div>

        <div class="admin-daily-menu__hero-actions">
          <button type="button" class="btn btn-outline-secondary" @click="resetForm">Mới</button>
          <button
            type="button"
            class="btn btn-outline-dark"
            :disabled="suggestedDraftItems.length === 0"
            @click="enableSuggestedItems"
          >
            Bật món gợi ý
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert-danger py-2 mb-0">{{ errorMessage }}</div>

      <div class="admin-daily-menu__meta-grid">
        <label class="admin-field admin-field--full">
          <span>Tên menu</span>
          <input v-model="form.title" class="form-control" placeholder="Ví dụ: Hải sản tươi hôm nay" />
        </label>

        <label class="admin-field">
          <span>Ngày bán</span>
          <input v-model="form.serviceDate" type="date" class="form-control" />
        </label>

        <label class="admin-field">
          <span>Trạng thái</span>
          <select v-model="form.status" class="form-select">
            <option v-for="option in statusOptions" :key="option" :value="option">
              {{ formatStatusLabel(option) }}
            </option>
          </select>
        </label>

        <label class="admin-field admin-field--full">
          <span>Banner trong ngày</span>
          <textarea
            v-model="form.bannerText"
            rows="2"
            class="form-control"
            placeholder="Ví dụ: Sò điệp đẹp, ốc tỏi mới về, ưu tiên lên món nhanh."
          ></textarea>
        </label>

        <label class="admin-field admin-field--full">
          <span>Ghi chú ca</span>
          <textarea
            v-model="form.note"
            rows="2"
            class="form-control"
            placeholder="Ghi chú bếp, size đẹp, món cần đẩy..."
          ></textarea>
        </label>
      </div>

      <div class="admin-daily-menu__quick-box">
        <div class="admin-daily-menu__section-label"># Tag món chính với số lượng</div>
        <textarea
          v-model="quickTagInput"
          rows="3"
          class="form-control"
          placeholder="Ví dụ: sò lông(4), hào(10 con), ốc tỏi size khủng(3), ốc tỏi vừa(10), sò điệp(5)"
        ></textarea>

        <div class="admin-daily-menu__quick-actions">
          <button type="button" class="btn btn-ember" @click="applyQuickTags">Tách tag</button>
          <button type="button" class="btn btn-outline-dark" @click="addEmptyStockPool">Thêm tag tay</button>
          <span class="small text-muted" v-if="loading">Đang tải dữ liệu...</span>
        </div>

        <div class="small text-muted">
          Mỗi tag sẽ trở thành một pool nguồn hàng trong ngày. Nếu hệ thống chưa khớp được nguyên liệu, bạn chỉ cần chọn lại ở bên dưới.
        </div>
      </div>

      <div v-if="stockPools.length" class="admin-daily-menu__tag-list">
        <div
          v-for="pool in stockPools"
          :key="pool.key"
          class="smart-tag"
          :class="{ 'smart-tag--warning': !pool.ingredientId }"
        >
          <span>#{{ formatPoolTag(pool) }}</span>
          <small v-if="!pool.ingredientId">Cần chọn nguồn</small>
        </div>
      </div>
    </section>

    <section class="page-panel">
      <div class="section-head">
        <div>
          <div class="panel-title mb-1">Nguồn hàng chính</div>
          <div class="small text-muted">
            {{ stockPools.length ? `Đã có ${stockPools.length} tag chính.` : "Chưa có tag món chính." }}
            <template v-if="unresolvedPoolCount">
              Còn {{ unresolvedPoolCount }} tag cần gắn nguyên liệu trước khi lưu.
            </template>
          </div>
        </div>
      </div>

      <div v-if="stockPools.length === 0" class="empty-state">
        Nhập chuỗi tag phía trên hoặc bấm "Thêm tag tay" để bắt đầu.
      </div>

      <div v-else class="pool-list">
        <article v-for="pool in stockPools" :key="pool.key" class="pool-card">
          <div class="pool-card__top">
            <div class="smart-tag smart-tag--soft">
              <span>#{{ formatPoolTag(pool) }}</span>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" @click="removeStockPool(pool.key)">Xóa</button>
          </div>

          <div class="pool-card__grid">
            <label class="admin-field">
              <span>Nguyên liệu</span>
              <select v-model.number="pool.ingredientId" class="form-select" @change="syncPoolLabel(pool)">
                <option :value="0">Chọn nguồn hàng</option>
                <option v-for="ingredient in ingredients" :key="ingredient.id" :value="ingredient.id">
                  {{ ingredient.name }}
                </option>
              </select>
            </label>

            <label class="admin-field">
              <span>Tag hiển thị</span>
              <input v-model="pool.label" class="form-control" placeholder="Ví dụ: Sò lông" />
            </label>

            <label class="admin-field">
              <span>Số lượng</span>
              <input v-model.number="pool.quantity" type="number" min="0" step="0.25" class="form-control" />
            </label>

            <label class="admin-field">
              <span>Ghi chú ngắn</span>
              <input v-model="pool.note" class="form-control" placeholder="Ví dụ: con, size khủng, size vừa" />
            </label>
          </div>
        </article>
      </div>
    </section>

    <section class="page-panel">
      <div class="section-head">
        <div>
          <div class="panel-title mb-1">Món bán hôm nay</div>
          <div class="small text-muted">
            {{ enabledDraftCount }}/{{ draftItems.length }} món đang bật.
            {{ suggestedDraftItems.length }} món khớp với tag nguồn hàng chính.
          </div>
        </div>

        <button
          type="button"
          class="btn btn-outline-dark"
          :disabled="suggestedDraftItems.length === 0"
          @click="enableSuggestedItems"
        >
          Bật nhanh món gợi ý
        </button>
      </div>

      <div class="offer-toolbar">
        <input
          v-model="itemSearch"
          class="form-control"
          placeholder="Tìm món theo tên, nhóm hoặc nguyên liệu..."
        />

        <div class="offer-filter">
          <button
            v-for="filter in itemFilters"
            :key="filter.value"
            type="button"
            class="filter-pill"
            :class="{ 'is-active': itemFilter === filter.value }"
            @click="itemFilter = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <div v-if="displayedDraftItems.length === 0" class="empty-state">
        Không có món nào phù hợp bộ lọc hiện tại.
      </div>

      <div v-else class="offer-list">
        <article
          v-for="row in displayedDraftItems"
          :key="row.menuItemId"
          class="offer-card"
          :class="{ 'is-enabled': row.enabled, 'is-suggested': isSuggestedRow(row) }"
        >
          <label class="offer-card__toggle">
            <input v-model="row.enabled" type="checkbox" class="form-check-input mt-1" @change="toggleOffer(row)" />

            <div class="offer-card__main">
              <div class="offer-card__title-row">
                <div class="offer-card__name">{{ row.name }}</div>
                <span v-if="isSuggestedRow(row)" class="tag">Khớp tag chính</span>
              </div>
              <div class="offer-card__meta">
                {{ row.categoryName || "Chưa phân nhóm" }} · {{ row.defaultIngredientName || "Chưa có nguồn mặc định" }}
              </div>
              <div class="offer-card__price">Giá ngày {{ formatMoney(row.overridePrice) }}</div>
            </div>
          </label>

          <p v-if="row.description" class="offer-card__description">{{ row.description }}</p>

          <div class="offer-card__grid">
            <label class="admin-field">
              <span>Pool áp dụng</span>
              <select v-model="row.stockPoolRef" class="form-select" :disabled="!row.enabled">
                <option value="">Chọn pool nguồn hàng</option>
                <option v-for="pool in stockPools" :key="pool.key" :value="getPoolRef(pool)">
                  {{ getPoolDisplayName(pool) }}
                </option>
              </select>
            </label>

            <label class="admin-field">
              <span>Định lượng</span>
              <input
                v-model.number="row.consumeQuantity"
                type="number"
                min="0"
                step="0.25"
                class="form-control"
                :disabled="!row.enabled"
              />
            </label>

            <label class="admin-field">
              <span>Giá ngày</span>
              <input
                v-model.number="row.overridePrice"
                type="number"
                min="0"
                class="form-control"
                :disabled="!row.enabled"
              />
            </label>

            <label class="admin-field">
              <span>Tag món</span>
              <input
                v-model="row.highlightLabel"
                class="form-control"
                placeholder="Ví dụ: Bán chạy"
                :disabled="!row.enabled"
              />
            </label>
          </div>

          <div class="offer-card__actions">
            <button
              type="button"
              class="btn btn-sm btn-outline-dark"
              :disabled="!row.defaultIngredientId"
              @click="assignSuggestedPool(row)"
            >
              Gắn pool gợi ý
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="page-panel">
      <div class="section-head">
        <div>
          <div class="panel-title mb-1">Menu đã tạo</div>
          <div class="small text-muted">Chạm vào một menu để nạp lại cấu hình và chỉnh sửa nhanh.</div>
        </div>
      </div>

      <div v-if="menus.length === 0" class="empty-state">
        Chưa có menu ngày nào được tạo.
      </div>

      <div v-else class="history-list">
        <article v-for="menu in menus" :key="menu.id" class="history-card">
          <div class="history-card__top">
            <div>
              <div class="history-card__date">{{ formatServiceDate(menu.serviceDate) }}</div>
              <div class="history-card__title">{{ menu.title }}</div>
            </div>

            <span class="status-pill" :class="`status-pill--${menu.status.toLowerCase()}`">
              {{ formatStatusLabel(menu.status) }}
            </span>
          </div>

          <div class="history-card__stats">
            <span class="tag">{{ menu.stockPools?.length || 0 }} tag chính</span>
            <span class="tag">{{ menu.items?.length || 0 }} món bán</span>
          </div>

          <div class="history-card__actions">
            <button type="button" class="btn btn-sm btn-outline-dark" @click="editMenu(menu)">Sửa</button>
            <button
              v-if="menu.status !== 'PUBLISHED'"
              type="button"
              class="btn btn-sm btn-ember"
              @click="publishMenu(menu.id)"
            >
              Publish
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="admin-daily-menu__bottom-bar">
      <div class="admin-daily-menu__bottom-copy">
        <strong>{{ stockPools.length }}</strong> tag chính · <strong>{{ enabledDraftCount }}</strong> món đang bật
      </div>

      <div class="admin-daily-menu__bottom-actions">
        <button type="button" class="btn btn-outline-secondary" @click="resetForm">Mới</button>
        <button type="button" class="btn btn-ember" :disabled="saving" @click="saveMenu">
          {{ saving ? "Đang lưu..." : form.id ? "Cập nhật menu" : "Lưu menu" }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatMoney } from "../../utils/format";

type DailyMenuStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type ItemFilter = "suggested" | "enabled" | "all";

interface IngredientRecord {
  id: number;
  name: string;
  slug?: string | null;
  unit?: string | null;
}

interface IngredientPresetRecord {
  ingredientId?: number;
  consumeQuantity?: number;
  ingredient?: IngredientRecord | null;
}

interface MenuItemRecord {
  id: number;
  name: string;
  description?: string | null;
  currentPrice?: number | null;
  basePrice?: number | null;
  isFeatured?: boolean;
  category?: {
    id?: number;
    name?: string | null;
  } | null;
  ingredientPresets?: IngredientPresetRecord[];
}

interface StockPoolDraft {
  id: number | null;
  key: string;
  ingredientId: number;
  label: string;
  quantity: number;
  soldQuantity: number;
  isAvailable: boolean;
  note: string;
}

interface DraftItem {
  id: number | null;
  menuItemId: number;
  name: string;
  description: string;
  categoryName: string;
  enabled: boolean;
  overridePrice: number;
  highlightLabel: string;
  isAvailable: boolean;
  stockPoolRef: string;
  consumeQuantity: number;
  defaultIngredientId: number;
  defaultIngredientName: string;
}

interface MenuRecord {
  id: number;
  title: string;
  serviceDate?: string | null;
  status: DailyMenuStatus;
  bannerText?: string | null;
  note?: string | null;
  stockPools?: any[];
  items?: any[];
}

const statusOptions: DailyMenuStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const itemFilters: Array<{ value: ItemFilter; label: string }> = [
  { value: "suggested", label: "Khớp tag chính" },
  { value: "enabled", label: "Đang bật" },
  { value: "all", label: "Tất cả món" },
];

const menuItems = ref<MenuItemRecord[]>([]);
const ingredients = ref<IngredientRecord[]>([]);
const menus = ref<MenuRecord[]>([]);
const draftItems = ref<DraftItem[]>([]);
const stockPools = ref<StockPoolDraft[]>([]);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const quickTagInput = ref("");
const itemSearch = ref("");
const itemFilter = ref<ItemFilter>("suggested");

const form = reactive<{
  id: number | null;
  title: string;
  serviceDate: string;
  bannerText: string;
  note: string;
  status: DailyMenuStatus;
}>({
  id: null,
  title: "Hải sản tươi hôm nay",
  serviceDate: getTodayInputValue(),
  bannerText: "",
  note: "",
  status: "DRAFT",
});

const selectedIngredientIds = computed(
  () =>
    new Set(
      stockPools.value
        .map((pool) => Number(pool.ingredientId || 0))
        .filter((ingredientId) => ingredientId > 0)
    )
);

const unresolvedPoolCount = computed(
  () => stockPools.value.filter((pool) => !pool.ingredientId).length
);

const enabledDraftCount = computed(() => draftItems.value.filter((item) => item.enabled).length);

const suggestedDraftItems = computed(() =>
  draftItems.value.filter((row) => isSuggestedRow(row))
);

const displayedDraftItems = computed(() => {
  const keyword = normalizeText(itemSearch.value);

  return [...draftItems.value]
    .filter((row) => {
      if (itemFilter.value === "suggested" && !isSuggestedRow(row)) {
        return false;
      }
      if (itemFilter.value === "enabled" && !row.enabled) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = normalizeText(
        [row.name, row.categoryName, row.defaultIngredientName, row.description, row.highlightLabel].join(" ")
      );
      return haystack.includes(keyword);
    })
    .sort((left, right) => {
      const leftScore =
        Number(left.enabled) * 100 + Number(isSuggestedRow(left)) * 10 + Number(left.defaultIngredientId > 0);
      const rightScore =
        Number(right.enabled) * 100 + Number(isSuggestedRow(right)) * 10 + Number(right.defaultIngredientId > 0);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.name.localeCompare(right.name, "vi");
    });
});

function getTodayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function makePoolKey() {
  return `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function formatNumber(value: number) {
  const normalized = Number(value || 0);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(2).replace(/\.?0+$/, "");
}

function formatPoolQuantity(pool: StockPoolDraft) {
  const quantity = formatNumber(pool.quantity);
  return pool.note ? `${quantity} ${pool.note}`.trim() : quantity;
}

function formatPoolTag(pool: StockPoolDraft) {
  const label = pool.label || getIngredientName(pool.ingredientId) || "tag mới";
  return `${label}(${formatPoolQuantity(pool)})`;
}

function formatStatusLabel(status: DailyMenuStatus) {
  switch (status) {
    case "DRAFT":
      return "Nháp";
    case "PUBLISHED":
      return "Đang bán";
    case "ARCHIVED":
      return "Lưu trữ";
    default:
      return status;
  }
}

function formatServiceDate(value?: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getIngredientName(ingredientId: number) {
  return ingredients.value.find((ingredient) => ingredient.id === ingredientId)?.name || "";
}

function getPoolRef(pool: StockPoolDraft) {
  return pool.id ? `id:${pool.id}` : `key:${pool.key}`;
}

function getPoolDisplayName(pool: StockPoolDraft) {
  return pool.label || getIngredientName(pool.ingredientId) || "Pool chưa đặt tên";
}

function addStockPool(ingredientId = 0, seed: Partial<StockPoolDraft> = {}) {
  const ingredientName = getIngredientName(ingredientId);
  const pool: StockPoolDraft = {
    id: seed.id ?? null,
    key: seed.key || makePoolKey(),
    ingredientId,
    label: seed.label ?? ingredientName,
    quantity: Number(seed.quantity ?? 0),
    soldQuantity: Number(seed.soldQuantity ?? 0),
    isAvailable: seed.isAvailable ?? true,
    note: seed.note ?? "",
  };
  stockPools.value = [...stockPools.value, pool];
  return pool;
}

function addEmptyStockPool() {
  addStockPool();
}

function syncPoolLabel(pool: StockPoolDraft) {
  if (!pool.label.trim()) {
    pool.label = getIngredientName(pool.ingredientId);
  }
}

function removeStockPool(key: string) {
  const pool = stockPools.value.find((candidate) => candidate.key === key);
  if (!pool) {
    return;
  }

  const refs = new Set([getPoolRef(pool), `key:${pool.key}`]);
  stockPools.value = stockPools.value.filter((candidate) => candidate.key !== key);

  for (const row of draftItems.value) {
    if (refs.has(row.stockPoolRef)) {
      row.stockPoolRef = "";
    }
  }

  quickTagInput.value = buildQuickTagInput();
}

function scoreIngredientMatch(keyword: string, ingredient: IngredientRecord) {
  const source = normalizeText(ingredient.name || ingredient.slug || "");
  if (!keyword || !source) {
    return 0;
  }

  if (source === keyword) {
    return 100;
  }

  const keywordTokens = keyword.split(" ").filter(Boolean);
  const sourceTokens = source.split(" ").filter(Boolean);
  const commonCount = keywordTokens.filter((token) => sourceTokens.includes(token)).length;

  let score = 0;
  if (source.includes(keyword) || keyword.includes(source)) {
    score += 40;
  }
  score += commonCount * 12;
  if (commonCount === keywordTokens.length && commonCount > 0) {
    score += 18;
  }
  if (source.startsWith(keyword)) {
    score += 10;
  }

  return score;
}

function findIngredientMatch(label: string) {
  const keyword = normalizeText(label);
  let bestMatch: IngredientRecord | null = null;
  let bestScore = 0;

  for (const ingredient of ingredients.value) {
    const score = scoreIngredientMatch(keyword, ingredient);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = ingredient;
    }
  }

  return bestScore >= 24 ? bestMatch : null;
}

function parseQuickTag(rawValue: string) {
  const cleaned = String(rawValue || "").replace(/^#+/, "").trim();
  if (!cleaned) {
    return null;
  }

  let label = cleaned;
  let quantity = 1;
  let note = "";

  const pairMatch = cleaned.match(/^(.*?)(?:\(([^)]*)\))$/);
  if (pairMatch) {
    label = pairMatch[1].trim();
    const inside = pairMatch[2].trim();
    const numberMatch = inside.match(/\d+(?:[.,]\d+)?/);

    if (numberMatch) {
      quantity = Number(numberMatch[0].replace(",", "."));
      note = inside.replace(numberMatch[0], "").trim();
    } else if (inside) {
      note = inside;
    }
  } else {
    const trailingMatch = cleaned.match(/^(.*?)(\d+(?:[.,]\d+)?)\s*([^\d]*)$/);
    if (trailingMatch) {
      label = trailingMatch[1].trim();
      quantity = Number(trailingMatch[2].replace(",", "."));
      note = trailingMatch[3].trim();
    }
  }

  if (!label) {
    return null;
  }

  const ingredient = findIngredientMatch(label);
  return {
    label,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    note,
    ingredientId: ingredient?.id || 0,
  };
}

function buildQuickTagInput() {
  return stockPools.value.map((pool) => formatPoolTag(pool)).join(", ");
}

function applyQuickTags() {
  errorMessage.value = "";

  const entries = quickTagInput.value
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return;
  }

  for (const entry of entries) {
    const parsed = parseQuickTag(entry);
    if (!parsed) {
      continue;
    }

    const normalizedLabel = normalizeText(parsed.label);
    const existing = stockPools.value.find((pool) => normalizeText(pool.label) === normalizedLabel);

    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + parsed.quantity;
      if (!existing.note && parsed.note) {
        existing.note = parsed.note;
      }
      if (!existing.ingredientId && parsed.ingredientId) {
        existing.ingredientId = parsed.ingredientId;
      }
      continue;
    }

    addStockPool(parsed.ingredientId, {
      label: parsed.label,
      quantity: parsed.quantity,
      note: parsed.note,
    });
  }

  quickTagInput.value = buildQuickTagInput();
}

function isSuggestedRow(row: DraftItem) {
  return row.defaultIngredientId > 0 && selectedIngredientIds.value.has(row.defaultIngredientId);
}

function resetDraftItems() {
  draftItems.value = menuItems.value.map((item) => {
    const preset = item.ingredientPresets?.[0];

    return {
      id: null,
      menuItemId: item.id,
      name: item.name,
      description: item.description || "",
      categoryName: item.category?.name || "",
      enabled: false,
      overridePrice: Number(item.currentPrice || item.basePrice || 0),
      highlightLabel: item.isFeatured ? "Bán chạy" : "Hôm nay",
      isAvailable: true,
      stockPoolRef: "",
      consumeQuantity: Number(preset?.consumeQuantity || 1),
      defaultIngredientId: Number(preset?.ingredientId || 0),
      defaultIngredientName: preset?.ingredient?.name || "",
    };
  });
}

function findPoolRefByIngredient(ingredientId: number) {
  const matched = stockPools.value.find((pool) => pool.ingredientId === ingredientId);
  return matched ? getPoolRef(matched) : "";
}

function toggleOffer(row: DraftItem) {
  if (!row.enabled) {
    row.stockPoolRef = "";
    return;
  }

  if (!row.stockPoolRef && row.defaultIngredientId) {
    row.stockPoolRef = findPoolRefByIngredient(row.defaultIngredientId);
  }
}

function assignSuggestedPool(row: DraftItem) {
  if (!row.defaultIngredientId) {
    return;
  }

  let matched = stockPools.value.find((pool) => pool.ingredientId === row.defaultIngredientId);
  if (!matched) {
    matched = addStockPool(row.defaultIngredientId, {
      label: row.defaultIngredientName || getIngredientName(row.defaultIngredientId),
      quantity: row.consumeQuantity || 1,
    });
  }

  row.enabled = true;
  row.stockPoolRef = getPoolRef(matched);
}

function enableSuggestedItems() {
  for (const row of draftItems.value) {
    if (!isSuggestedRow(row)) {
      continue;
    }

    row.enabled = true;
    if (!row.stockPoolRef) {
      row.stockPoolRef = findPoolRefByIngredient(row.defaultIngredientId);
    }
  }

  itemFilter.value = "enabled";
}

async function loadData() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [ingredientRes, itemRes, menuRes] = await Promise.all([
      api.get("/ingredients"),
      api.get("/menu-items"),
      api.get("/daily-menus"),
    ]);

    ingredients.value = ingredientRes.data;
    menuItems.value = itemRes.data;
    menus.value = menuRes.data;
    resetDraftItems();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được dữ liệu menu ngày.");
  } finally {
    loading.value = false;
  }
}

function buildDefaultTitle() {
  const primaryTags = stockPools.value
    .map((pool) => pool.label || getIngredientName(pool.ingredientId))
    .filter(Boolean)
    .slice(0, 3);

  return primaryTags.length ? primaryTags.join(" · ") : "Hải sản tươi hôm nay";
}

function resetForm() {
  errorMessage.value = "";
  quickTagInput.value = "";
  itemSearch.value = "";
  itemFilter.value = "suggested";

  Object.assign(form, {
    id: null,
    title: "Hải sản tươi hôm nay",
    serviceDate: getTodayInputValue(),
    bannerText: "",
    note: "",
    status: "DRAFT",
  });

  stockPools.value = [];
  resetDraftItems();
}

function editMenu(menu: MenuRecord) {
  errorMessage.value = "";
  itemSearch.value = "";
  itemFilter.value = "enabled";

  Object.assign(form, {
    id: menu.id,
    title: menu.title,
    serviceDate: String(menu.serviceDate || "").slice(0, 10),
    bannerText: menu.bannerText || "",
    note: menu.note || "",
    status: menu.status,
  });

  stockPools.value = (menu.stockPools || []).map((pool: any) => ({
    id: pool.id,
    key: makePoolKey(),
    ingredientId: pool.ingredient?.id || 0,
    label: pool.label || pool.ingredient?.name || "",
    quantity: Number(pool.quantity || 0),
    soldQuantity: Number(pool.soldQuantity || 0),
    isAvailable: pool.isAvailable ?? true,
    note: pool.note || "",
  }));

  quickTagInput.value = buildQuickTagInput();
  resetDraftItems();

  for (const row of draftItems.value) {
    const matched = (menu.items || []).find((item: any) => item.menuItem?.id === row.menuItemId);
    if (!matched) {
      continue;
    }

    row.id = matched.id;
    row.enabled = true;
    row.overridePrice = Number(matched.overridePrice || matched.sellingPrice || row.overridePrice);
    row.highlightLabel = matched.highlightLabel || "";
    row.isAvailable = matched.isAvailable ?? true;
    row.consumeQuantity = Number(matched.stockLinks?.[0]?.consumeQuantity || row.consumeQuantity);
    row.stockPoolRef = matched.stockLinks?.[0]?.stockPool?.id
      ? `id:${matched.stockLinks[0].stockPool.id}`
      : "";
  }
}

function buildStockLinkPayload(stockPoolRef: string, consumeQuantity: number) {
  if (!stockPoolRef) {
    return null;
  }

  if (stockPoolRef.startsWith("id:")) {
    return {
      dailyStockPoolId: Number(stockPoolRef.slice(3)),
      consumeQuantity,
    };
  }

  if (stockPoolRef.startsWith("key:")) {
    return {
      stockPoolKey: stockPoolRef.slice(4),
      consumeQuantity,
    };
  }

  return null;
}

function validateBeforeSave() {
  if (stockPools.value.some((pool) => !pool.label.trim())) {
    return "Có tag món chính chưa có tên hiển thị.";
  }

  const invalidPool = stockPools.value.find((pool) => !pool.ingredientId);
  if (invalidPool) {
    return `Tag "${invalidPool.label || "mới"}" chưa được chọn nguồn hàng.`;
  }

  const missingPoolItem = draftItems.value.find((item) => item.enabled && !item.stockPoolRef);
  if (missingPoolItem) {
    return `Món "${missingPoolItem.name}" chưa gắn pool nguồn hàng.`;
  }

  return "";
}

async function saveMenu() {
  errorMessage.value = validateBeforeSave();
  if (errorMessage.value) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: form.title.trim() || buildDefaultTitle(),
      serviceDate: form.serviceDate,
      bannerText: form.bannerText,
      note: form.note,
      status: form.status,
      stockPools: stockPools.value.map((pool) => ({
        id: pool.id || undefined,
        key: pool.key,
        ingredientId: pool.ingredientId,
        label: pool.label || undefined,
        quantity: Number(pool.quantity || 0),
        isAvailable: pool.isAvailable,
        note: pool.note || undefined,
      })),
      items: draftItems.value
        .filter((item) => item.enabled)
        .map((item) => ({
          id: item.id || undefined,
          menuItemId: item.menuItemId,
          overridePrice: Number(item.overridePrice || 0),
          highlightLabel: item.highlightLabel || "",
          isAvailable: item.isAvailable,
          stockLinks: [buildStockLinkPayload(item.stockPoolRef, Number(item.consumeQuantity || 1))].filter(Boolean),
        })),
    };

    if (form.id) {
      await api.put(`/daily-menus/${form.id}`, payload);
    } else {
      await api.post("/daily-menus", payload);
    }

    await loadData();
    resetForm();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không lưu được menu ngày.");
  } finally {
    saving.value = false;
  }
}

async function publishMenu(id: number) {
  errorMessage.value = "";

  try {
    await api.post(`/daily-menus/${id}/publish`);
    await loadData();
    if (form.id === id) {
      form.status = "PUBLISHED";
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không publish được menu.");
  }
}

onMounted(async () => {
  await loadData();
  resetForm();
});
</script>

<style scoped>
.admin-daily-menu {
  padding-bottom: 96px;
}

.admin-daily-menu__hero {
  display: grid;
  gap: 20px;
  background:
    linear-gradient(135deg, rgba(var(--panel-rgb), 0.96), rgba(255, 244, 231, 0.94)),
    radial-gradient(circle at top right, rgba(var(--ember-rgb), 0.08), transparent 34%);
}

.admin-daily-menu__hero-head,
.section-head,
.history-card__top,
.admin-daily-menu__bottom-bar,
.admin-daily-menu__bottom-actions,
.admin-daily-menu__quick-actions,
.pool-card__top,
.history-card__actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.admin-daily-menu__hero-copy {
  display: grid;
  gap: 8px;
}

.admin-daily-menu__eyebrow,
.admin-field span {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.76rem;
  color: var(--muted);
}

.admin-daily-menu__title {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  line-height: 1.1;
}

.admin-daily-menu__description {
  margin: 0;
  max-width: 60ch;
  color: var(--muted);
}

.admin-daily-menu__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.admin-daily-menu__meta-grid,
.pool-card__grid,
.offer-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.admin-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.admin-field--full {
  grid-column: 1 / -1;
}

.admin-daily-menu__quick-box {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px dashed rgba(var(--ember-rgb), 0.24);
  border-radius: 22px;
  background: rgba(255, 247, 241, 0.78);
}

.admin-daily-menu__section-label {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ember-strong);
}

.admin-daily-menu__tag-list,
.offer-filter,
.history-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.smart-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(var(--ember-rgb), 0.16);
  background: rgba(255, 247, 241, 0.96);
  color: var(--ember-strong);
  font-weight: 700;
}

.smart-tag small {
  color: #8f2f15;
  font-weight: 600;
}

.smart-tag--warning {
  border-color: rgba(var(--gold-rgb), 0.4);
  background: rgba(255, 248, 221, 0.95);
  color: #7d5600;
}

.smart-tag--soft {
  width: fit-content;
}

.empty-state {
  padding: 18px;
  border-radius: 20px;
  background: rgba(246, 233, 220, 0.55);
  color: var(--muted);
}

.pool-list,
.offer-list,
.history-list {
  display: grid;
  gap: 14px;
}

.pool-card,
.offer-card,
.history-card {
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 22px;
  padding: 16px;
  background: rgba(var(--panel-rgb), 0.9);
}

.offer-card {
  display: grid;
  gap: 14px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.offer-card.is-enabled {
  border-color: rgba(var(--green-rgb), 0.26);
  box-shadow: 0 14px 28px rgba(var(--green-rgb), 0.08);
}

.offer-card.is-suggested {
  background:
    linear-gradient(180deg, rgba(var(--panel-rgb), 0.95), rgba(247, 255, 251, 0.95)),
    rgba(var(--panel-rgb), 0.9);
}

.offer-card__toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
}

.offer-card__main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.offer-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.offer-card__name,
.history-card__title {
  font-weight: 700;
  font-size: 1.02rem;
}

.offer-card__meta,
.offer-card__description,
.offer-card__price,
.history-card__date {
  color: var(--muted);
}

.offer-card__description {
  margin: 0;
  font-size: 0.94rem;
}

.offer-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-pill {
  border: 1px solid rgba(var(--text-rgb), 0.1);
  border-radius: 999px;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  font-weight: 600;
}

.filter-pill.is-active {
  border-color: rgba(var(--ember-rgb), 0.24);
  background: rgba(255, 247, 241, 0.95);
  color: var(--ember-strong);
}

.history-card__actions {
  align-items: center;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
}

.status-pill--draft {
  background: rgba(var(--gold-rgb), 0.14);
  color: #8d6510;
}

.status-pill--published {
  background: rgba(var(--green-rgb), 0.14);
  color: var(--green);
}

.status-pill--archived {
  background: rgba(var(--text-rgb), 0.08);
  color: var(--muted);
}

.admin-daily-menu__bottom-bar {
  position: sticky;
  bottom: 0;
  z-index: 20;
  padding: 16px 18px;
  border: 1px solid rgba(var(--line-rgb), 0.92);
  border-radius: 24px;
  background: rgba(var(--panel-rgb), 0.94);
  box-shadow: 0 18px 40px rgba(76, 33, 18, 0.08);
  backdrop-filter: blur(14px);
}

.admin-daily-menu__bottom-copy {
  color: var(--muted);
}

@media (max-width: 767px) {
  .admin-daily-menu {
    padding-bottom: 112px;
  }

  .admin-daily-menu__hero-head,
  .section-head,
  .history-card__top,
  .admin-daily-menu__bottom-bar,
  .admin-daily-menu__bottom-actions,
  .admin-daily-menu__quick-actions,
  .pool-card__top,
  .history-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-daily-menu__meta-grid,
  .pool-card__grid,
  .offer-card__grid {
    grid-template-columns: 1fr;
  }

  .admin-daily-menu__hero-actions,
  .admin-daily-menu__bottom-actions {
    display: grid;
    gap: 10px;
  }

  .offer-card__title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
