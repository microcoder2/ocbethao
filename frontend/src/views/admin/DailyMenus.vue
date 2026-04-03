<template>
  <div class="dm-shell">

    <!-- ── Kho hôm nay (+ header controls) ── -->
    <div class="dm-panel">
      <div class="dm-bar">
        <div class="dm-bar-header">
          <span class="dm-panel-title">Kho hôm nay</span>
          <label class="dm-toggle-group" title="Bật/tắt tất cả nguyên liệu" @click="panelRef?.toggleAll()">
            <span class="dm-toggle-label">Tất cả</span>
            <span class="dm-toggle" :class="{ on: panelRef?.allActive }"><span class="dm-toggle-knob"></span></span>
          </label>
          <button class="dm-img-toggle-btn" :class="{ on: panelRef?.showImg }" title="Ẩn/hiện ảnh nguyên liệu" @click="panelRef?.toggleImg()">
            <i class="bi bi-image"></i>
          </button>
          <div class="dm-bar-actions">
            <button class="dm-btn dm-btn--sm dm-btn--ember" :disabled="saving" @click="saveMenu" title="Lưu thay đổi">
              <i :class="saving ? 'bi bi-hourglass-split' : 'bi bi-floppy'"></i>
              <span class="dm-btn-label">Lưu thay đổi</span>
            </button>
            <button
              v-if="form.status !== 'PUBLISHED'"
              class="dm-btn dm-btn--sm dm-btn--ember"
              :disabled="saving"
              @click="saveAndPublish"
            >
              <i class="bi bi-send-check"></i>
              <span class="dm-btn-label">Đăng menu</span>
              <span class="dm-btn-short">Đăng</span>
            </button>
            <button class="dm-collapse-btn" :aria-expanded="stockOpen" @click="stockOpen = !stockOpen">
              <i :class="['bi', stockOpen ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
            </button>
          </div>
        </div>
      </div>
      <div v-if="errorMessage" class="dm-error">{{ errorMessage }}</div>
      <div v-show="stockOpen" class="dm-stock-body">
        <div class="dm-bar-fields">
          <input v-model="form.title" class="dm-title-input" placeholder="Tên menu..." />
          <label class="dm-date-wrap">
            <i class="bi bi-calendar3 dm-date-icon"></i>
            <input v-model="form.serviceDate" type="date" class="dm-date-input" />
          </label>
          <span class="dm-status-pill" :class="`dm-status--${form.status.toLowerCase()}`">
            {{ formatStatusLabel(form.status) }}
          </span>
          <span v-if="enabledDraftCount > 0" class="dm-meta-count">{{ enabledDraftCount }} món bật</span>
        </div>
        <DailyStockPanel ref="panelRef" :service-date="form.serviceDate" @updated="onStockUpdated" />
      </div>
    </div>

    <!-- ── Món bán hôm nay ── -->
    <div class="dm-panel">
      <div class="dm-panel-head">
        <div class="dm-panel-title-group">
          <span class="dm-panel-title">Món bán hôm nay</span>
          <span class="dm-muted">{{ enabledDraftCount }}/{{ draftItems.length }}</span>
        </div>
        <button
          v-if="itemsOpen && suggestedDraftItems.length > 0"
          class="dm-btn dm-btn--sm dm-btn--ember"
          @click="enableSuggestedItems"
        >
          <i class="bi bi-check2-all"></i> Bật {{ suggestedDraftItems.length }} gợi ý
        </button>
        <button class="dm-collapse-btn" :aria-expanded="itemsOpen" @click="itemsOpen = !itemsOpen">
          <i :class="['bi', itemsOpen ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
        </button>
      </div>

      <template v-if="itemsOpen">
      <div class="dm-toolbar">
        <div class="dm-search-wrap">
          <i class="bi bi-search dm-search-icon"></i>
          <input v-model="itemSearch" class="dm-search" placeholder="Tìm tên, nhóm, nguyên liệu..." autocomplete="off" />
        </div>
        <div class="dm-pills">
          <button
            v-for="f in itemFilters"
            :key="f.value"
            class="dm-pill"
            :class="{ 'dm-pill--active': itemFilter === f.value }"
            @click="itemFilter = f.value"
          >
            {{ f.label }}
            <span v-if="f.value === 'suggested' && suggestedDraftItems.length" class="dm-pill-count">{{ suggestedDraftItems.length }}</span>
            <span v-if="f.value === 'enabled' && enabledDraftCount" class="dm-pill-count">{{ enabledDraftCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="dm-empty"><i class="bi bi-hourglass-split"></i> Đang tải...</div>
      <div v-else-if="displayedDraftItems.length === 0" class="dm-empty">Không có món nào phù hợp.</div>
      <div v-else class="dm-items">
        <div
          v-for="row in displayedDraftItems"
          :key="row.menuItemId"
          class="dm-item"
          :class="{
            'dm-item--on': row.enabled,
            'dm-item--suggested': isSuggestedRow(row) && !row.enabled,
          }"
        >
          <!-- Toggle -->
          <label class="dm-item-toggle">
            <input type="checkbox" v-model="row.enabled" @change="toggleOffer(row)" />
          </label>

          <!-- Thumb -->
          <div class="dm-item-thumb">
            <img v-if="row.imageUrl" :src="resolveImg(row.imageUrl)" class="dm-thumb" @error="row.imageUrl = ''" />
            <div v-else class="dm-thumb dm-thumb--blank"><i class="bi bi-egg-fried"></i></div>
          </div>

          <!-- Info -->
          <div class="dm-item-info">
            <div class="dm-item-name">{{ row.name }}</div>
            <div class="dm-item-meta">
              <span v-if="row.categoryName" class="dm-tag">{{ row.categoryName }}</span>
              <span v-if="row.defaultIngredientName" class="dm-tag dm-tag--ing">
                <i class="bi bi-box"></i> {{ row.defaultIngredientName }}
              </span>
              <span v-if="isSuggestedRow(row)" class="dm-tag dm-tag--stock">Có kho ✓</span>
              <span v-else-if="row.defaultIngredientId" class="dm-tag dm-tag--nostock">Thiếu kho</span>
            </div>
          </div>

          <!-- Price -->
          <div class="dm-item-price-wrap">
            <span v-if="!row.enabled" class="dm-price-display">{{ formatMoneyShort(row.overridePrice) }}</span>
            <input
              v-else
              :value="formatPriceInput(row.overridePrice)"
              type="text"
              inputmode="numeric"
              class="dm-price-input"
              @click.stop
              @focus="(e) => ((e.target as HTMLInputElement).value = String(row.overridePrice || 0))"
              @blur="(e) => { row.overridePrice = parsePriceInput((e.target as HTMLInputElement).value) }"
              @keydown.enter.prevent="(e) => (e.target as HTMLInputElement).blur()"
            />
          </div>

          <!-- Pool selector (only when multiple pools) -->
          <div v-if="row.enabled && stockPools.length > 1" class="dm-item-pool">
            <select v-model="row.stockPoolRef" class="dm-pool-select" @click.stop>
              <option value="">— kho —</option>
              <option v-for="pool in stockPools" :key="pool.key" :value="getPoolRef(pool)">
                {{ getPoolDisplayName(pool) }}
              </option>
            </select>
          </div>
        </div>
      </div>
      </template>
    </div>

    <!-- ── Lịch sử menu ── -->
    <div class="dm-panel">
      <div class="dm-panel-head">
        <span class="dm-panel-title">Menu đã tạo</span>
      </div>
      <div v-if="menus.length === 0" class="dm-empty">Chưa có menu nào được tạo.</div>
      <div v-else class="dm-history">
        <div
          v-for="menu in menus"
          :key="menu.id"
          class="dm-history-card"
          :class="{ 'dm-history-card--active': form.id === menu.id }"
        >
          <div class="dm-history-info">
            <div class="dm-history-date">{{ formatServiceDate(menu.serviceDate) }}</div>
            <div class="dm-history-title">{{ menu.title }}</div>
            <div class="dm-history-meta">
              <span class="dm-tag">{{ menu.stockPoolCount ?? menu.stockPools?.length ?? 0 }} kho</span>
              <span class="dm-tag">{{ menu.itemCount ?? menu.items?.length ?? 0 }} món</span>
            </div>
          </div>
          <div class="dm-history-actions">
            <span class="dm-status-pill" :class="`dm-status--${menu.status.toLowerCase()}`">
              {{ formatStatusLabel(menu.status) }}
            </span>
            <template v-if="deletingMenuId === menu.id">
              <button class="dm-btn dm-btn--sm" @click="deletingMenuId = null">Hủy</button>
              <button class="dm-btn dm-btn--sm dm-btn--danger" @click="deleteMenu(menu.id)">Xóa?</button>
            </template>
            <template v-else>
              <button class="dm-btn dm-btn--sm" @click="editMenu(menu)">Sửa</button>
              <button
                v-if="menu.status !== 'PUBLISHED'"
                class="dm-btn dm-btn--sm btn-ember"
                @click="publishMenu(menu.id)"
              >
                Đăng menu
              </button>
              <button class="dm-btn dm-btn--sm dm-btn--ghost" title="Xóa" @click="deletingMenuId = menu.id">
                <i class="bi bi-trash3"></i>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatMoneyShort } from "../../utils/format";

function formatPriceInput(val: number | undefined): string {
  if (!val && val !== 0) return "";
  return new Intl.NumberFormat("vi-VN").format(val);
}
function parsePriceInput(val: string): number {
  return parseInt(val.replace(/\D/g, ""), 10) || 0;
}
import { API_BASE_URL } from "../../config";
import DailyStockPanel, { type PoolSummary } from "../../components/admin/DailyStockPanel.vue";

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
  imageUrl?: string | null;
  category?: { id?: number; name?: string | null } | null;
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
  imageUrl: string;
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
  stockPoolCount?: number;
  itemCount?: number;
  stockPools?: any[];
  items?: any[];
}

const itemFilters: Array<{ value: ItemFilter; label: string }> = [
  { value: "suggested", label: "Gợi ý" },
  { value: "enabled",   label: "Đang bật" },
  { value: "all",       label: "Tất cả" },
];

// ── state ──────────────────────────────────────────────────────────────────
const menuItems   = ref<MenuItemRecord[]>([]);
const ingredients = ref<IngredientRecord[]>([]);
const menus       = ref<MenuRecord[]>([]);
const draftItems  = ref<DraftItem[]>([]);
const stockPools  = ref<StockPoolDraft[]>([]);
const loading     = ref(false);
const saving      = ref(false);
const errorMessage = ref("");
const itemSearch     = ref("");
const itemFilter     = ref<ItemFilter>("suggested");
const deletingMenuId = ref<number | null>(null);
const stockOpen      = ref(true);
const itemsOpen      = ref(true);
const panelRef       = ref<InstanceType<typeof DailyStockPanel>>();

const form = reactive<{
  id: number | null;
  title: string;
  serviceDate: string;
  bannerText: string;
  note: string;
  status: DailyMenuStatus;
}>({
  id: null,
  title: defaultMenuTitle(),
  serviceDate: getTodayInputValue(),
  bannerText: "",
  note: "",
  status: "DRAFT",
});

// ── computed ───────────────────────────────────────────────────────────────
const selectedIngredientIds = computed(() =>
  new Set(
    stockPools.value
      .filter(p => p.isAvailable && Number(p.quantity || 0) > 0)
      .map(p => Number(p.ingredientId || 0))
      .filter(id => id > 0)
  )
);

const enabledDraftCount = computed(() => draftItems.value.filter(i => i.enabled).length);

const suggestedDraftItems = computed(() => draftItems.value.filter(isSuggestedRow));

const displayedDraftItems = computed(() => {
  const keyword = normalizeText(itemSearch.value);
  return [...draftItems.value]
    .filter(row => {
      if (itemFilter.value === "suggested" && !isSuggestedRow(row)) return false;
      if (itemFilter.value === "enabled"   && !row.enabled)          return false;
      if (!keyword) return true;
      return normalizeText([row.name, row.categoryName, row.defaultIngredientName].join(" ")).includes(keyword);
    })
    .sort((a, b) => {
      const sa = Number(a.enabled) * 100 + Number(isSuggestedRow(a)) * 10;
      const sb = Number(b.enabled) * 100 + Number(isSuggestedRow(b)) * 10;
      return sb !== sa ? sb - sa : a.name.localeCompare(b.name, "vi");
    });
});

// ── helpers ────────────────────────────────────────────────────────────────
function getTodayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function defaultMenuTitle() {
  return `Menu món ngày ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())}`;
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function makePoolKey() {
  return `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}


function formatStatusLabel(status: DailyMenuStatus) {
  if (status === "DRAFT")     return "Nháp";
  if (status === "PUBLISHED") return "Đang bán";
  if (status === "ARCHIVED")  return "Lưu trữ";
  return status;
}

function formatServiceDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
}

function resolveImg(url: string) {
  return url.startsWith("/") ? API_BASE_URL + url : url;
}

function getIngredientName(id: number) {
  return ingredients.value.find(i => i.id === id)?.name || "";
}

function getPoolRef(pool: StockPoolDraft) {
  return pool.id ? `id:${pool.id}` : `key:${pool.key}`;
}

function getPoolDisplayName(pool: StockPoolDraft) {
  return pool.label || getIngredientName(pool.ingredientId) || "Pool chưa đặt tên";
}

// ── stock panel integration ────────────────────────────────────────────────
function applyStockSuggestions() {
  const activeIngIds = new Set(
    stockPools.value
      .filter(p => p.isAvailable && Number(p.quantity || 0) > 0)
      .map(p => p.ingredientId)
  );
  for (const row of draftItems.value) {
    if (row.defaultIngredientId <= 0) continue;
    if (activeIngIds.has(row.defaultIngredientId)) {
      if (!row.enabled) {
        row.enabled = true;
        const pool = stockPools.value.find(p => p.ingredientId === row.defaultIngredientId);
        if (pool) row.stockPoolRef = getPoolRef(pool);
      }
    } else if (row.enabled && row.id === null) {
      // Auto-disable only items that were auto-enabled (not manually saved)
      row.enabled = false;
      row.stockPoolRef = "";
    }
  }
}

function onStockUpdated(pools: PoolSummary[]) {
  stockPools.value = pools.map(p => ({
    id: p.id ?? null,
    key: p.id ? `id-${p.id}` : `ing-${p.ingredientId}`,
    ingredientId: p.ingredientId,
    label: p.label,
    quantity: p.quantity,
    soldQuantity: Number(p.soldQuantity || 0),
    isAvailable: p.isAvailable,
    note: p.note,
  }));
  applyStockSuggestions();
}

// ── item management ────────────────────────────────────────────────────────
function isSuggestedRow(row: DraftItem) {
  return row.defaultIngredientId > 0 && selectedIngredientIds.value.has(row.defaultIngredientId);
}

function resetDraftItems() {
  draftItems.value = menuItems.value.map(item => {
    const preset = item.ingredientPresets?.[0];
    return {
      id: null,
      menuItemId: item.id,
      name: item.name,
      description: item.description || "",
      categoryName: item.category?.name || "",
      imageUrl: item.imageUrl || "",
      enabled: false,
      overridePrice: Number(item.currentPrice || item.basePrice || 0),
      highlightLabel: item.isFeatured ? "Bán chạy" : "",
      isAvailable: true,
      stockPoolRef: "",
      consumeQuantity: Number(preset?.consumeQuantity || 1),
      defaultIngredientId: Number(preset?.ingredientId || 0),
      defaultIngredientName: preset?.ingredient?.name || "",
    };
  });
}

function findPoolRefByIngredient(ingredientId: number) {
  const m = stockPools.value.find(p => p.ingredientId === ingredientId);
  return m ? getPoolRef(m) : "";
}

function toggleOffer(row: DraftItem) {
  if (!row.enabled) { row.stockPoolRef = ""; return; }
  if (!row.stockPoolRef && row.defaultIngredientId) {
    row.stockPoolRef = findPoolRefByIngredient(row.defaultIngredientId);
  }
}

function enableSuggestedItems() {
  for (const row of draftItems.value) {
    if (!isSuggestedRow(row)) continue;
    row.enabled = true;
    if (!row.stockPoolRef) row.stockPoolRef = findPoolRefByIngredient(row.defaultIngredientId);
  }
  itemFilter.value = "enabled";
}

// ── data loading ───────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true; errorMessage.value = "";
  try {
    const [ingRes, itemRes, menuRes] = await Promise.all([
      api.get("/ingredients"),
      api.get("/menu-items"),
      api.get("/daily-menus"),
    ]);
    ingredients.value = ingRes.data;
    menuItems.value   = itemRes.data;
    menus.value       = menuRes.data;
    resetDraftItems();
    applyStockSuggestions();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được dữ liệu.");
  } finally {
    loading.value = false;
  }
}

function buildDefaultTitle() {
  const tags = stockPools.value.map(p => p.label || getIngredientName(p.ingredientId)).filter(Boolean).slice(0, 3);
  return tags.length ? tags.join(" · ") : "Hải sản tươi hôm nay";
}

function resetForm() {
  errorMessage.value = "";
  itemSearch.value = "";
  itemFilter.value = "suggested";
  Object.assign(form, {
    id: null, title: defaultMenuTitle(),
    serviceDate: getTodayInputValue(), bannerText: "", note: "", status: "DRAFT",
  });
  stockPools.value = [];
  resetDraftItems();
}

async function editMenu(menu: MenuRecord) {
  errorMessage.value = "";
  itemSearch.value = "";
  itemFilter.value = "enabled";
  loading.value = true;

  try {
    const { data } = await api.get(`/daily-menus/${menu.id}`);
    const detail = data as MenuRecord;

    Object.assign(form, {
      id: detail.id,
      title: detail.title,
      serviceDate: String(detail.serviceDate || "").slice(0, 10),
      bannerText: detail.bannerText || "",
      note: detail.note || "",
      status: detail.status,
    });

    stockPools.value = (detail.stockPools || []).map((p: any) => ({
      id: p.id,
      key: makePoolKey(),
      ingredientId: p.ingredientId || p.ingredient?.id || 0,
      label: p.label || p.ingredient?.name || "",
      quantity: Number(
        p.remainingQuantity ?? Number(p.quantity || 0) - Number(p.soldQuantity || 0)
      ),
      soldQuantity: Number(p.soldQuantity || 0),
      isAvailable: p.isAvailable ?? true,
      note: p.note || "",
    }));

    resetDraftItems();
    for (const row of draftItems.value) {
      const matched = (detail.items || []).find((i: any) => i.menuItem?.id === row.menuItemId);
      if (!matched) continue;
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

    await nextTick();
    await (
      panelRef.value as
        | (InstanceType<typeof DailyStockPanel> & { reload?: () => void | Promise<void> })
        | null
    )?.reload?.();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được chi tiết menu.");
  } finally {
    loading.value = false;
  }
}

function buildStockLinkPayload(ref: string, qty: number) {
  if (!ref) return null;
  if (ref.startsWith("id:"))  return { dailyStockPoolId: Number(ref.slice(3)), consumeQuantity: qty };
  if (ref.startsWith("key:")) return { stockPoolKey: ref.slice(4), consumeQuantity: qty };
  return null;
}

function validateBeforeSave() {
  if (stockPools.value.some(p => !p.label.trim())) return "Có pool chưa có tên hiển thị.";
  const inv = stockPools.value.find(p => !p.ingredientId);
  if (inv) return `Pool "${inv.label || "mới"}" chưa được chọn nguyên liệu.`;
  const mis = draftItems.value.find(i => i.enabled && !i.stockPoolRef);
  if (mis) return `Món "${mis.name}" chưa gắn kho.`;
  return "";
}

function buildPayload() {
  const referencedPoolRefs = new Set(
    draftItems.value
      .filter(i => i.enabled && i.stockPoolRef)
      .map(i => i.stockPoolRef)
  );

  return {
    title: form.title.trim() || buildDefaultTitle(),
    serviceDate: form.serviceDate,
    bannerText: form.bannerText,
    note: form.note,
    status: form.status,
    stockPools: stockPools.value
      .filter((p) => {
        const ref = getPoolRef(p);
        return p.isAvailable || Number(p.quantity || 0) > 0 || referencedPoolRefs.has(ref);
      })
      .map(p => ({
        id: p.id || undefined, key: p.key,
        ingredientId: p.ingredientId,
        label: p.label || undefined,
        quantity: Number(p.quantity || 0) + Number(p.soldQuantity || 0),
        isAvailable: p.isAvailable,
        note: p.note || undefined,
      })),
    items: draftItems.value.filter(i => i.enabled).map(i => ({
      id: i.id || undefined,
      menuItemId: i.menuItemId,
      overridePrice: Number(i.overridePrice || 0),
      highlightLabel: i.highlightLabel || "",
      isAvailable: i.isAvailable,
      stockLinks: [buildStockLinkPayload(i.stockPoolRef, Number(i.consumeQuantity || 1))].filter(Boolean),
    })),
  };
}

async function saveMenu() {
  errorMessage.value = validateBeforeSave();
  if (errorMessage.value) return;
  saving.value = true;
  try {
    const payload = buildPayload();
    if (form.id) {
      await api.put(`/daily-menus/${form.id}`, payload);
    } else {
      const { data } = await api.post("/daily-menus", payload);
      form.id = data.id;
    }
    await loadData();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không lưu được menu ngày.");
  } finally {
    saving.value = false;
  }
}

async function deleteMenu(id: number) {
  errorMessage.value = "";
  try {
    await api.delete(`/daily-menus/${id}`);
    menus.value = menus.value.filter(m => m.id !== id);
    if (form.id === id) resetForm();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không xóa được menu.");
  } finally {
    deletingMenuId.value = null;
  }
}

async function publishMenu(id: number) {
  errorMessage.value = "";
  try {
    await api.post(`/daily-menus/${id}/publish`);
    await loadData();
    if (form.id === id) form.status = "PUBLISHED";
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không publish được menu.");
  }
}

async function saveAndPublish() {
  errorMessage.value = validateBeforeSave();
  if (errorMessage.value) return;
  saving.value = true;
  try {
    const payload = buildPayload();
    let id = form.id;
    if (id) {
      await api.put(`/daily-menus/${id}`, payload);
    } else {
      const { data } = await api.post("/daily-menus", payload);
      id = data.id;
      form.id = id;
    }
    await api.post(`/daily-menus/${id}/publish`);
    form.status = "PUBLISHED";
    await loadData();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không lưu được.");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadData();
  resetForm();
});
</script>

<style scoped>
/* ── shell ── */
.dm-shell {
  display: flex; flex-direction: column; gap: 16px;
  margin-inline: -24px; margin-top: -24px;
  padding: 16px 8px 48px;
}

/* ── bar (merged header + panel head) ── */
.dm-bar { display: flex; flex-direction: column; gap: 8px; }
.dm-stock-body { display: flex; flex-direction: column; gap: 12px; }
.dm-bar-header {
  display: flex; align-items: center; gap: 8px;
}
.dm-bar-header .dm-meta-count { margin-right: auto; }
.dm-bar-actions { display: flex; gap: 6px; align-items: center; margin-left: auto; }
.dm-bar-fields {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}

.dm-title-input {
  font-size: 0.9rem; font-weight: 600; color: var(--text);
  background: rgba(var(--panel-rgb), 0.7); border: 1px solid var(--line);
  border-radius: 8px; outline: none; padding: 4px 9px; font: inherit;
  flex: 1; min-width: 140px; transition: border-color 0.15s;
}
.dm-title-input:focus { border-color: var(--ember); }
.dm-title-input::placeholder { color: var(--muted); font-weight: 400; }

.dm-date-wrap {
  position: relative; display: inline-flex; align-items: center;
  border: 1px solid var(--line); border-radius: 8px; cursor: pointer;
  transition: border-color 0.15s;
}
.dm-date-wrap:focus-within { border-color: var(--ember); }
/* desktop: hide custom icon, keep native indicator */
.dm-date-icon { display: none; }
.dm-date-input {
  font-size: 0.8rem; padding: 3px 7px; border: none;
  background: transparent; color: var(--text);
  font: inherit; outline: none; cursor: pointer; border-radius: 8px;
}
/* mobile/touch: show custom icon, hide native indicator */
@media (pointer: coarse) {
  .dm-date-icon {
    display: block; position: absolute; left: 7px;
    font-size: 0.78rem; color: var(--muted); pointer-events: none;
  }
  .dm-date-input { padding-left: 24px; }
  .dm-date-input::-webkit-calendar-picker-indicator { opacity: 0; }
}
.dm-btn-short { display: none; }
.dm-thumb-toggle {
  display: inline-flex; align-items: center; cursor: pointer;
  color: var(--muted); font-size: 0.95rem; padding: 2px 4px;
  border-radius: 6px; transition: color 0.15s;
}
.dm-thumb-toggle:hover { color: var(--text); }
.dm-thumb-toggle-check { display: none; }
.dm-thumb-toggle input:checked ~ i { color: var(--ember); }
.dm-toggle {
  flex-shrink: 0; width: 44px; height: 24px; border-radius: 999px; border: none;
  background: var(--line); cursor: pointer; position: relative;
  transition: background 0.2s; padding: 0;
}
.dm-toggle.on { background: linear-gradient(135deg, var(--ember), var(--ember-strong)); }
.dm-toggle-knob {
  position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: #fff; transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.18);
}
.dm-toggle.on .dm-toggle-knob { transform: translateX(20px); }
.dm-img-toggle-btn {
  background: none; border: none; cursor: pointer; padding: 2px 4px;
  font-size: 1rem; border-radius: 6px;
  color: var(--muted); opacity: 0.4; transition: opacity 0.2s, color 0.2s;
}
.dm-img-toggle-btn.on { color: var(--ember); opacity: 1; }
.dm-toggle-group {
  display: inline-flex; align-items: center; gap: 5px; cursor: pointer; user-select: none;
}
.dm-toggle-label { font-size: 0.75rem; font-weight: 600; color: var(--muted); white-space: nowrap; }

.dm-collapse-btn {
  border: none; background: transparent; color: var(--muted);
  padding: 4px 6px; cursor: pointer; display: inline-flex; align-items: center;
  border-radius: 6px; transition: color 0.15s;
}
.dm-collapse-btn:hover { color: var(--text); }
.dm-meta-count { font-size: 0.78rem; color: var(--muted); font-weight: 600; white-space: nowrap; }
.dm-warn { color: var(--danger, #e55); font-weight: 600; }

.dm-error {
  font-size: 0.82rem; color: var(--danger, #e55);
  padding: 8px 12px; background: rgba(220,50,50,0.08); border-radius: 10px;
}

/* ── status pill ── */
.dm-status-pill {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 3px 9px; border-radius: 999px; display: inline-block;
}
.dm-status--draft     { background: rgba(var(--ember-rgb),0.1); color: var(--ember-strong); }
.dm-status--published { background: rgba(80,180,100,0.15);      color: #2a9147; }
.dm-status--archived  { background: rgba(0,0,0,0.06);           color: var(--muted); }

/* ── buttons ── */
.dm-btn {
  padding: 7px 14px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--text); font-size: 0.85rem; font-weight: 600;
  cursor: pointer; transition: background 0.12s; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 6px;
}
.dm-btn:hover { background: rgba(0,0,0,0.05); }
.dm-btn:disabled { opacity: 0.45; cursor: default; pointer-events: none; }
.dm-btn--ember {
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
  color: #fff; border-color: transparent;
}
.dm-btn--ember:hover { opacity: 0.9; background: linear-gradient(135deg, var(--ember), var(--ember-strong)); }
.dm-btn--sm { padding: 5px 11px; font-size: 0.8rem; border-radius: 8px; }
.dm-btn--ghost { color: var(--muted); background: transparent; border-color: transparent; padding: 5px 7px; }
.dm-btn--ghost:hover { color: var(--danger, #e05); border-color: rgba(var(--danger-rgb), 0.3); background: rgba(var(--danger-rgb), 0.06); }
.dm-btn--danger { background: rgba(var(--danger-rgb), 0.9); color: #fff; border-color: transparent; font-weight: 700; }
.dm-btn--danger:hover { background: var(--danger); }

/* ── panel ── */
.dm-panel {
  background: var(--panel);
  border-radius: 18px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
}
.dm-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.dm-panel-title-group { display: flex; align-items: baseline; gap: 8px; }
.dm-panel-title { font-size: 0.9rem; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.06em; }
.dm-muted { font-size: 0.78rem; color: var(--muted); }

/* ── toolbar ── */
.dm-toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
.dm-search-wrap { position: relative; flex: 1; min-width: 160px; }
.dm-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.8rem; }
.dm-search {
  width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--line);
  border-radius: 10px; background: transparent; color: var(--text);
  font: inherit; font-size: 0.88rem; outline: none; box-sizing: border-box;
}
.dm-search:focus { border-color: var(--ember); }

.dm-pills { display: flex; gap: 6px; }
.dm-pill {
  padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font-size: 0.8rem; font-weight: 600;
  cursor: pointer; transition: all 0.12s; display: inline-flex; align-items: center; gap: 5px;
}
.dm-pill:hover { border-color: var(--ember); color: var(--ember); }
.dm-pill--active { background: rgba(var(--ember-rgb),0.1); border-color: var(--ember); color: var(--ember); }
.dm-pill-count {
  background: var(--ember); color: #fff;
  font-size: 0.7rem; font-weight: 700; min-width: 18px; height: 18px;
  border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;
}

/* ── item list ── */
.dm-items { display: flex; flex-direction: column; gap: 1px; }

.dm-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px;
  transition: background 0.12s;
  cursor: default;
}
.dm-item:hover { background: rgba(0,0,0,0.03); }
.dm-item--on { background: rgba(var(--ember-rgb), 0.05); }
.dm-item--on:hover { background: rgba(var(--ember-rgb), 0.08); }
.dm-item--suggested { background: rgba(80,180,100,0.04); }

.dm-item-toggle { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
.dm-item-toggle input[type="checkbox"] {
  width: 18px; height: 18px; accent-color: var(--ember); cursor: pointer;
}

.dm-item-thumb { flex-shrink: 0; }
.dm-thumb {
  width: 42px; height: 34px; object-fit: cover; border-radius: 8px;
}
.dm-thumb--blank {
  width: 42px; height: 34px; border-radius: 8px;
  background: rgba(var(--ember-rgb), 0.06);
  display: flex; align-items: center; justify-content: center;
  color: rgba(var(--ember-rgb), 0.4); font-size: 1rem;
}

.dm-item-info { flex: 1; min-width: 0; }
.dm-item-name {
  font-size: 0.88rem; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-item-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }

.dm-tag {
  font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 999px;
  background: rgba(0,0,0,0.06); color: var(--muted);
}
.dm-tag--ing   { background: rgba(var(--ember-rgb),0.08); color: var(--ember-strong); }
.dm-tag--stock { background: rgba(80,180,100,0.14); color: #2a9147; }
.dm-tag--nostock { background: rgba(200,50,50,0.1); color: #c04040; }

.dm-item-price-wrap { flex-shrink: 0; text-align: right; min-width: 72px; }
.dm-price-display { font-size: 0.85rem; font-weight: 600; color: var(--muted); }
.dm-price-input {
  width: 80px; padding: 5px 8px; border: 1px solid var(--ember);
  border-radius: 8px; background: rgba(var(--ember-rgb),0.05);
  color: var(--text); font: inherit; font-size: 0.82rem;
  outline: none; text-align: right;
}
.dm-price-input:focus { background: rgba(var(--ember-rgb),0.1); }

.dm-item-pool { flex-shrink: 0; }
.dm-pool-select {
  padding: 5px 8px; border: 1px solid var(--line); border-radius: 8px;
  background: transparent; color: var(--text); font: inherit; font-size: 0.78rem;
  outline: none; max-width: 120px;
}

/* ── empty state ── */
.dm-empty {
  text-align: center; color: var(--muted); font-size: 0.88rem;
  padding: 24px 0; display: flex; align-items: center; justify-content: center; gap: 8px;
}

/* ── history ── */
.dm-history { display: flex; flex-direction: column; gap: 8px; }
.dm-history-card {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line);
  transition: border-color 0.12s;
}
.dm-history-card:hover { border-color: rgba(var(--ember-rgb), 0.3); }
.dm-history-card--active { border-color: var(--ember); background: rgba(var(--ember-rgb), 0.04); }
.dm-history-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.dm-history-date { font-size: 0.72rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
.dm-history-title { font-size: 0.9rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dm-history-meta { display: flex; gap: 5px; }
.dm-history-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

/* ── mobile ── */
@media (max-width: 639px) {
  .dm-shell { margin: -24px; padding: 0 0 48px; gap: 4px; }
  .dm-panel  { padding: 12px; border-radius: 0; box-shadow: none; }
  .dm-btn-label { display: none; }
  .dm-btn-short { display: inline; }
  .dm-toggle-label { display: none; }
  .dm-item { padding: 8px; gap: 8px; }
  .dm-thumb, .dm-thumb--blank { width: 36px; height: 30px; }
  .dm-price-input { width: 68px; }
  .dm-pool-select { display: none; }
}
</style>
