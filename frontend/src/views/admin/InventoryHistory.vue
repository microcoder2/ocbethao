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
        <label class="inventory-field inventory-field--search">
          <span>Tìm kiếm</span>
          <input
            v-model.trim="filters.search"
            class="form-control"
            type="search"
            placeholder="Nguyên liệu, mã đơn, món, người thao tác..."
            @keydown.enter.prevent="loadMovements"
          />
        </label>

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

        <button
          type="button"
          class="btn btn-outline-dark inventory-history__clear-range"
          :disabled="!filters.from || !filters.to"
          @click="clearDateRange"
        >
          Xóa khoảng ngày
        </button>
      </div>

      <div v-if="errorMessage" class="alert alert-danger py-2 mb-0">
        {{ errorMessage }}
      </div>
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
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../api";
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
  "LOSS",
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
const page = ref(1);
const pageSize = ref(20);

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

function formatDelta(value: number) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
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
  // Initial fetch is handled by the watcher.
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

.inventory-history__clear-range {
  grid-column: 1 / -1;
  white-space: nowrap;
}

.inventory-history__results {
  display: grid;
  gap: 14px;
  padding: 10px;
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

  .inventory-history__clear-range {
    width: 100%;
  }
}
</style>
