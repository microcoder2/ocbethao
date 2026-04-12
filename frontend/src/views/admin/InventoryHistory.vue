<template>
  <section class="inventory-history">
    <section class="page-panel inventory-history__filters">
      <div class="inventory-history__filters-head">
        <div class="inventory-history__page-label">LỊCH SỬ TỒN KHO</div>
        <button
          type="button"
          class="inventory-history__filters-toggle"
          :aria-expanded="filtersOpen ? 'true' : 'false'"
          :aria-label="filtersOpen ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'"
          :title="filtersOpen ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'"
          @click="filtersOpen = !filtersOpen"
        >
          <i :class="['bi', filtersOpen ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
        </button>
      </div>

      <div v-show="filtersOpen" class="inventory-history__filters-body">

      <div class="inventory-history__filter-grid">
                <div class="inventory-field inventory-field--search">
          <span>Tìm kiếm</span>
          <div class="inventory-autocomplete">
            <input
              v-model.trim="filters.search"
              class="form-control"
              type="search"
              autocomplete="off"
              spellcheck="false"
              placeholder="Nguyên liệu, mã đơn, món, người thao tác..."
              aria-autocomplete="list"
              :aria-expanded="ingredientAutocompleteOpen ? 'true' : 'false'"
              aria-controls="inventory-history-ingredient-menu"
              @focus="openIngredientAutocomplete"
              @blur="closeIngredientAutocomplete"
              @keydown.enter.prevent="loadMovements"
              @keydown.esc="ingredientAutocompleteOpen = false"
            />
            <div
              v-if="ingredientAutocompleteOpen"
              id="inventory-history-ingredient-menu"
              class="inventory-autocomplete__menu"
              role="listbox"
            >
              <button
                v-if="ingredientsLoading"
                type="button"
                class="inventory-autocomplete__item is-static"
                disabled
              >
                <span class="inventory-autocomplete__name">Đang tải nguyên liệu...</span>
              </button>

              <template v-else>
                <button
                  v-for="ingredient in ingredientSuggestions"
                  :key="ingredient.id"
                  type="button"
                  class="inventory-autocomplete__item"
                  :class="{ 'is-inactive': !ingredient.isActive }"
                  @mousedown.prevent="selectIngredientSuggestion(ingredient)"
                >
                  <span class="inventory-autocomplete__name">{{ ingredient.name }}</span>
                  <span class="inventory-autocomplete__meta">
                    #{{ ingredient.id }}
                    <span v-if="ingredient.unit">· {{ ingredient.unit }}</span>
                    <span v-if="!ingredient.isActive" class="inventory-autocomplete__badge">Ngừng dùng</span>
                  </span>
                </button>

                <div v-if="!ingredientSuggestions.length" class="inventory-autocomplete__empty">
                  Không có nguyên liệu phù hợp.
                </div>
              </template>
            </div>
          </div>
        </div>

        <label class="inventory-field">
          <span>Loại biến động</span>
          <select v-model="filters.movementType" class="form-select">
            <option value="">Tất cả</option>
            <option v-for="option in movementTypeOptions" :key="option" :value="option">
              {{ formatMovementType(option) }}
            </option>
          </select>
        </label>
      </div>

      <div class="inventory-history__range-presets">
        <button
          type="button"
          class="inventory-history__preset"
          :class="{ 'is-active': activeRange === 'all' }"
          @click="clearDateRange"
        >
          Tất cả
        </button>
        <button
          v-for="preset in quickRangeOptions"
          :key="preset.key"
          type="button"
          class="inventory-history__preset"
          :class="{ 'is-active': activeRange === preset.key }"
          @click="applyQuickRange(preset.key)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="inventory-history__date-grid">
        <label class="inventory-field">
          <span>Từ ngày</span>
          <input
            v-model="filters.from"
            class="form-control"
            type="date"
            @change="markCustomRange"
          />
        </label>

        <label class="inventory-field">
          <span>Đến ngày</span>
          <input
            v-model="filters.to"
            class="form-control"
            type="date"
            @change="markCustomRange"
          />
        </label>
      </div>

      <div v-if="errorMessage" class="alert alert-danger py-2 mb-0">
        {{ errorMessage }}
      </div>
      </div>
    </section>

    <section class="page-panel inventory-history__quick-actions">
      <div class="inventory-history__quick-actions-grid">
        <button
          type="button"
          class="btn btn-ember inventory-history__summary-trigger"
          :disabled="summaryLoading || !selectedIngredient"
          @click="openIngredientSummary"
        >
          {{ selectedIngredientButtonLabel }}
        </button>

        <button
          type="button"
          class="btn btn-outline-dark inventory-history__clear-range"
          :disabled="!filters.from || !filters.to"
          @click="clearDateRange"
        >
          Xóa khoảng ngày
        </button>
      </div>
    </section>

    <section class="page-panel inventory-history__results">
      <div class="inventory-history__table-shell">
        <DataTable
          row-key="id"
          :columns="columns"
          :items="movements"
          :loading="loading"
          empty-text="Chưa có biến động kho phù hợp."
          responsive-class="inventory-history__table-responsive"
          table-class="inventory-history__table"
          header-cell-class="inventory-history__th"
          body-row-class="inventory-history__tr"
          body-cell-class="inventory-history__td"
          empty-cell-class="inventory-history__empty-cell"
        >
          <template #cell-ingredient="{ row }">
            <div class="inventory-cell__primary">{{ row.ingredient?.name || "Nguyên liệu" }}</div>
          </template>

          <template #cell-movementType="{ row }">
            <span class="inventory-type-chip" :class="`is-${movementTone(row.movementType)}`">
              {{ formatMovementType(row.movementType) }}
            </span>
          </template>

          <template #cell-quantityDelta="{ row }">
            <span
              class="inventory-delta"
              :class="{
                'is-negative': Number(row.quantityDelta || 0) < 0,
                'is-positive': Number(row.quantityDelta || 0) > 0,
              }"
            >
              {{ formatDelta(Number(row.quantityDelta || 0)) }}
            </span>
          </template>

          <template #cell-order="{ row }">
            <div class="inventory-cell__primary">
              {{ row.order?.orderNumber || "Không gắn đơn" }}
            </div>
          </template>

          <template #cell-createdBy="{ row }">
            <div class="inventory-cell__primary">
              {{ row.createdBy?.fullName || "Hệ thống" }}
            </div>
          </template>

          <template #cell-note="{ row }">
            <div class="inventory-note">{{ row.note || "-" }}</div>
          </template>
        </DataTable>
      </div>

      <div class="inventory-history__pager">
        <AppPagination
          :page="page"
          :page-size="pageSize"
          :total="total"
          :page-size-options="[10, 20, 50, 100]"
          :disabled="loading"
          @update:page="page = $event"
          @update:page-size="onPageSizeChange"
        />
      </div>
    </section>

    <InventoryHistorySummaryModal
      :open="summaryOpen"
      :loading="summaryLoading"
      :error-message="summaryError"
      :summary="summaryData"
      :selected-ingredient-name="selectedIngredient?.name || ''"
      :range-label="formatSummaryRangeLabel()"
      @close="closeIngredientSummary"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../api";
import InventoryHistorySummaryModal from "../../components/admin/InventoryHistorySummaryModal.vue";
import AppPagination from "../../components/common/Pagination.vue";
import DataTable from "../../components/common/DataTable.vue";

type InventoryMovementRow = {
  id: number;
  ingredientId: number;
  orderId?: number | null;
  orderItemId?: number | null;
  movementType: string;
  quantityDelta: number;
  note?: string | null;
  createdAt: string;
  ingredient?: {
    id: number;
    name: string;
    unit?: string | null;
  } | null;
  order?: {
    id: number;
    orderNumber: string;
  } | null;
  orderItem?: {
    id: number;
    itemNameSnapshot: string;
    quantity: number;
    note?: string | null;
  } | null;
  createdBy?: {
    id: number;
    fullName: string;
    role: string;
  } | null;
};

type IngredientOption = {
  id: number;
  name: string;
  slug: string;
  unit?: string | null;
  isActive: boolean;
};

type IngredientSummaryResponse = {
  ingredient: {
    id: number;
    name: string;
    unit: string | null;
    isActive: boolean;
  };
  currentStock: {
    quantity: number;
    soldQuantity: number;
    remainingQuantity: number;
    updatedAt: string;
  } | null;
  openingSnapshot: {
    day: string;
    capturedAt: string | null;
    totalRemainingQuantity: number | null;
    remainingQuantity: number;
    source: "audit-log" | "derived";
  };
  range: {
    from: string;
    to: string;
  };
  movementCount: number;
  totalIncrease: number;
  totalDecrease: number;
  netChange: number;
  expectedClosingQuantity: number;
  discrepancy: number;
};

const columns = [
  { key: "ingredient", title: "Nguyên liệu" },
  { key: "movementType", title: "Loại" },
  { key: "quantityDelta", title: "Biến động" },
  { key: "order", title: "Nguồn phát sinh" },
  { key: "createdBy", title: "Người thao tác" },
  { key: "note", title: "Ghi chú" },
];

type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "day_before_yesterday"
  | "this_week"
  | "this_month"
  | "custom";

const movementTypeOptions = [
  "MANUAL_ADJUST",
  "ORDER_RESERVE",
  "ORDER_RELEASE",
  "ORDER_RESTORE",
  "CORRECTION",
  "MENU_POOL_INCREASE",
  "MENU_POOL_DECREASE",
];

const quickRangeOptions: Array<{ key: Exclude<DatePreset, "all" | "custom">; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "day_before_yesterday", label: "Hôm kia" },
  { key: "this_week", label: "Tuần này" },
  { key: "this_month", label: "Tháng này" },
];

const filters = reactive({
  search: "",
  movementType: "",
  from: "",
  to: "",
});

const loading = ref(false);
const errorMessage = ref("");
const total = ref(0);
const movements = ref<InventoryMovementRow[]>([]);
const activeRange = ref<DatePreset>("all");
const filtersOpen = ref(true);
const ingredients = ref<IngredientOption[]>([]);
const ingredientsLoading = ref(false);
const ingredientAutocompleteOpen = ref(false);
const selectedIngredient = ref<IngredientOption | null>(null);
const summaryOpen = ref(false);
const summaryLoading = ref(false);
const summaryError = ref("");
const summaryData = ref<IngredientSummaryResponse | null>(null);
const page = ref(1);
const pageSize = ref(20);

const selectedIngredientButtonLabel = computed(() =>
  selectedIngredient.value ? `Xem tồn kho (${selectedIngredient.value.name})` : "Xem tồn kho"
);

let loadTimer: number | null = null;

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatMovementType(value: string) {
  const labels: Record<string, string> = {
    LOSS: "Thất thoát",
    MANUAL_ADJUST: "Chỉnh tay",
    ORDER_RESERVE: "Giữ kho",
    ORDER_RELEASE: "Trả kho",
    ORDER_RESTORE: "Khôi phục",
    CORRECTION: "Hiệu chỉnh",
    MENU_POOL_INCREASE: "Tăng kho cũ",
    MENU_POOL_DECREASE: "Giảm kho cũ",
  };
  return labels[value] || value;
}

function movementTone(value: string) {
  if (value === "LOSS" || value === "ORDER_RESERVE" || value === "MENU_POOL_DECREASE") {
    return "danger";
  }
  if (value === "ORDER_RELEASE" || value === "ORDER_RESTORE" || value === "MANUAL_ADJUST") {
    return "success";
  }
  return "muted";
}

function normalizeIngredientText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const ingredientSuggestions = computed(() => {
  const query = normalizeIngredientText(filters.search || "");
  const list = [...ingredients.value].sort((a, b) => {
    const activeDelta = Number(b.isActive) - Number(a.isActive);
    if (activeDelta !== 0) return activeDelta;
    return a.name.localeCompare(b.name, "vi");
  });

  if (!query) {
    return list;
  }

  return list.filter((ingredient) =>
    normalizeIngredientText([ingredient.name, ingredient.slug, ingredient.unit || ""].join(" ")).includes(query)
  );
});

function openIngredientAutocomplete() {
  ingredientAutocompleteOpen.value = true;
}

function closeIngredientAutocomplete() {
  ingredientAutocompleteOpen.value = false;
}

function selectIngredientSuggestion(ingredient: IngredientOption) {
  filters.search = ingredient.name;
  selectedIngredient.value = ingredient;
  summaryOpen.value = false;
  summaryData.value = null;
  summaryError.value = "";
  ingredientAutocompleteOpen.value = false;
}

async function loadIngredients() {
  ingredientsLoading.value = true;

  try {
    const { data } = await api.get("/ingredients");
    ingredients.value = Array.isArray(data) ? data : [];
  } catch {
    ingredients.value = [];
  } finally {
    ingredientsLoading.value = false;
  }

  syncSelectedIngredientFromSearch();
}

function formatDelta(value: number) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("vi-VN");
}

function formatSummaryRangeLabel() {
  const range = summaryData.value?.range;
  if (range?.from && range?.to) {
    const fromLabel = formatShortDate(range.from);
    const toLabel = formatShortDate(range.to);
    return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`;
  }

  if (filters.from && filters.to) {
    const fromLabel = formatShortDate(`${filters.from}T00:00:00`);
    const toLabel = formatShortDate(`${filters.to}T23:59:59`);
    return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`;
  }

  if (filters.from) {
    return formatShortDate(`${filters.from}T00:00:00`);
  }

  if (filters.to) {
    return formatShortDate(`${filters.to}T23:59:59`);
  }

  return "Hôm nay";
}

function syncSelectedIngredientFromSearch() {
  const query = normalizeIngredientText(filters.search || "");

  if (!query) {
    selectedIngredient.value = null;
    return;
  }

  const exact = ingredients.value.find((ingredient) => {
    const normalizedName = normalizeIngredientText(ingredient.name);
    const normalizedSlug = normalizeIngredientText(ingredient.slug);
    return normalizedName === query || normalizedSlug === query;
  });

  if (exact) {
    if (!selectedIngredient.value || selectedIngredient.value.id !== exact.id) {
      summaryOpen.value = false;
      summaryData.value = null;
      summaryError.value = "";
    }
    selectedIngredient.value = exact;
    return;
  }

  const current = selectedIngredient.value;
  if (!current) {
    return;
  }

  const currentName = normalizeIngredientText(current.name);
  const currentSlug = normalizeIngredientText(current.slug);
  if (currentName !== query && currentSlug !== query) {
    selectedIngredient.value = null;
    summaryOpen.value = false;
    summaryData.value = null;
    summaryError.value = "";
  }
}

async function loadIngredientSummary() {
  const ingredient = selectedIngredient.value;
  if (!ingredient) {
    return;
  }

  summaryLoading.value = true;
  summaryError.value = "";

  try {
    const { data } = await api.get("/inventory-movements/summary", {
      params: {
        ingredientId: ingredient.id,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
    });
    summaryData.value = data as IngredientSummaryResponse;
  } catch (error) {
    summaryError.value = getErrorMessage(error, "Không tải được số liệu tồn kho.");
    summaryData.value = null;
  } finally {
    summaryLoading.value = false;
  }
}

async function openIngredientSummary() {
  if (!selectedIngredient.value) {
    return;
  }

  ingredientAutocompleteOpen.value = false;
  summaryOpen.value = true;
  await loadIngredientSummary();
}

function closeIngredientSummary() {
  summaryOpen.value = false;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfWeek(date = new Date()) {
  const value = startOfLocalDay(date);
  const day = value.getDay();
  const delta = (day + 6) % 7;
  value.setDate(value.getDate() - delta);
  return value;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function setDateRange(start: Date | null, end: Date | null, preset: DatePreset) {
  filters.from = start ? toDateInputValue(start) : "";
  filters.to = end ? toDateInputValue(end) : "";
  activeRange.value = preset;
}

function applyQuickRange(preset: Exclude<DatePreset, "all" | "custom">) {
  const today = new Date();

  if (preset === "today") {
    setDateRange(startOfLocalDay(today), endOfLocalDay(today), preset);
    return;
  }

  if (preset === "yesterday") {
    const start = startOfLocalDay(today);
    start.setDate(start.getDate() - 1);
    setDateRange(start, endOfLocalDay(start), preset);
    return;
  }

  if (preset === "day_before_yesterday") {
    const start = startOfLocalDay(today);
    start.setDate(start.getDate() - 2);
    setDateRange(start, endOfLocalDay(start), preset);
    return;
  }

  if (preset === "this_week") {
    setDateRange(startOfWeek(today), endOfLocalDay(today), preset);
    return;
  }

  if (preset === "this_month") {
    setDateRange(startOfMonth(today), endOfLocalDay(today), preset);
  }
}

function clearDateRange() {
  filters.from = "";
  filters.to = "";
  activeRange.value = "all";
}

function markCustomRange() {
  activeRange.value = filters.from || filters.to ? "custom" : "all";
}

function scheduleLoad() {
  loading.value = true;

  if (loadTimer) {
    window.clearTimeout(loadTimer);
  }

  loadTimer = window.setTimeout(() => {
    void loadMovements();
  }, 180);
}

function onPageSizeChange(value: number) {
  pageSize.value = value;
  page.value = 1;
}

async function loadMovements() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const { data } = await api.get("/inventory-movements", {
      params: {
        search: filters.search || undefined,
        movementType: filters.movementType || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page: page.value,
        pageSize: pageSize.value,
      },
    });

    movements.value = Array.isArray(data?.items) ? data.items : [];
    total.value = Number(data?.total || 0);
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được lịch sử tồn kho.");
  } finally {
    loading.value = false;
  }
}

watch(
  () => filters.search,
  () => {
    syncSelectedIngredientFromSearch();
  }
);

watch(
  () => [filters.search, filters.movementType, filters.from, filters.to],
  () => {
    page.value = 1;
    scheduleLoad();
  },
  { immediate: true }
);

watch([page, pageSize], () => {
  scheduleLoad();
});

onMounted(() => {
  void loadIngredients();
});

onBeforeUnmount(() => {
  if (loadTimer) {
    window.clearTimeout(loadTimer);
  }
});
</script>

<style scoped>
.inventory-history {
  display: grid;
  gap: 0;
}

.inventory-history__page-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.inventory-history__filters {
  display: grid;
  gap: 14px;
  padding: 10px;
  border: 0;
  border-radius: 0;
}

.inventory-history__filters-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.inventory-history__filters-body {
  display: grid;
  gap: 14px;
}

.inventory-history__filters-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(126, 86, 65, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  transition: color 0.18s, border-color 0.18s, background 0.18s;
}

.inventory-history__filters-toggle:hover,
.inventory-history__filters-toggle:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}

.inventory-history__filters-toggle i {
  font-size: 0.82rem;
}

.inventory-history__filter-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1.6fr) minmax(0, 1fr);
  gap: 12px;
  align-items: end;
}

.inventory-field {
  display: grid;
  gap: 6px;
}

.inventory-field span {
  font-size: 0.82rem;
  font-weight: 700;
}

.inventory-autocomplete {
  position: relative;
  min-width: 0;
}

.inventory-autocomplete__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 15;
  display: grid;
  gap: 2px;
  padding: 8px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: var(--shadow);
  max-height: 280px;
  overflow-y: auto;
}

.inventory-autocomplete__item {
  display: grid;
  gap: 2px;
  width: 100%;
  border: 0;
  border-radius: 0;
  padding: 8px 10px;
  background: transparent;
  color: var(--text);
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}

.inventory-autocomplete__item:hover,
.inventory-autocomplete__item:focus-visible {
  outline: none;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
}

.inventory-autocomplete__item.is-static {
  cursor: default;
}

.inventory-autocomplete__item.is-inactive {
  color: var(--muted);
}

.inventory-autocomplete__name {
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.3;
}

.inventory-autocomplete__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--muted);
}

.inventory-autocomplete__badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--line-rgb), 0.14);
  color: var(--muted);
}

.inventory-autocomplete__empty {
  padding: 8px 10px;
  font-size: 0.8rem;
  color: var(--muted);
}

.inventory-history__range-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inventory-history__preset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgba(var(--line-rgb), 0.92);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--text);
  font-size: 0.76rem;
  font-weight: 700;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.inventory-history__preset:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--orange-rgb), 0.75);
}

.inventory-history__preset.is-active {
  background: rgba(var(--orange-rgb), 0.12);
  border-color: rgba(var(--orange-rgb), 0.72);
  color: var(--orange);
}

.inventory-history__date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.inventory-history__quick-actions {
  display: grid;
  gap: 8px;
  padding: 0 10px;
  border: 0;
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.88);
}

.inventory-history__quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.inventory-history__summary-trigger,
.inventory-history__clear-range {
  width: 100%;
  border-radius: var(--bs-border-radius, 0.375rem);
  min-height: 44px;
  padding: 0.65rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: normal;
  text-align: center;
}

.inventory-history__results {
  display: grid;
  gap: 14px;
  padding: 10px;
  border: 0;
  border-radius: 0;
}

.inventory-history__table-shell {
  min-width: 0;
}

.inventory-history__pager {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.inventory-cell__primary {
  font-weight: 700;
  font-size: 0.8rem;
  line-height: 1.25;
  color: var(--text);
}

.inventory-type-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 700;
  background: rgba(var(--line-rgb), 0.12);
}

.inventory-type-chip.is-danger {
  background: rgba(var(--danger-rgb), 0.14);
  color: var(--danger);
}

.inventory-type-chip.is-success {
  background: rgba(var(--green-rgb), 0.14);
  color: var(--green);
}

.inventory-type-chip.is-muted {
  background: rgba(var(--line-rgb), 0.16);
  color: var(--muted);
}

.inventory-delta {
  font-weight: 800;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.inventory-delta.is-positive {
  color: var(--green);
}

.inventory-delta.is-negative {
  color: var(--danger);
}

.inventory-note {
  white-space: normal;
  line-height: 1.35;
  font-size: 0.78rem;
  color: var(--text);
}

:deep(.inventory-history__table-responsive) {
  overflow-x: auto;
}

:deep(.inventory-history__table) {
  min-width: 1080px;
  width: 100%;
  color: var(--text);
  border-collapse: separate;
  border-spacing: 0;
}

:deep(.inventory-history__table thead tr) {
  background: rgba(var(--panel-rgb), 0.88);
}

:deep(.inventory-history__table thead th) {
  padding: 9px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--muted);
  border-bottom: 1px solid rgba(var(--line-rgb), 0.68);
}

:deep(.inventory-history__table tbody td) {
  padding: 9px 10px;
  font-size: 0.8rem;
  color: var(--text);
  vertical-align: middle;
  border-bottom-color: rgba(var(--line-rgb), 0.38);
}

:deep(.inventory-history__tr:hover) {
  background: rgba(var(--ember-rgb), 0.04);
}

:deep(.inventory-history__empty-cell) {
  padding: 22px 12px;
  color: var(--muted);
  font-size: 0.84rem;
}

@media (max-width: 1199px) {
  .inventory-history__filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inventory-history__date-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .inventory-history__filters-head {
    align-items: center;
  }

  .inventory-history__filter-grid,
  .inventory-history__date-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inventory-history__range-presets {
    gap: 6px;
  }

  .inventory-history__preset {
    flex: 1 1 auto;
  }
}
</style>


