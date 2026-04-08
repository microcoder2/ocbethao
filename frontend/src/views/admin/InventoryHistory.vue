<template>
  <section class="inventory-history">
    <header class="inventory-history__hero page-panel">
      <div>
        <h1 class="inventory-history__title">Lịch sử tồn kho</h1>
        <p class="inventory-history__note">
          Theo dõi biến động kho từ đơn hàng và các lần chỉnh tay của admin.
        </p>
      </div>

      <button
        type="button"
        class="btn btn-ember inventory-history__refresh"
        :disabled="loading"
        @click="loadMovements"
      >
        <i :class="loading ? 'bi bi-hourglass-split' : 'bi bi-arrow-clockwise'"></i>
        <span>{{ loading ? "Đang tải..." : "Tải lại" }}</span>
      </button>
    </header>

    <section class="inventory-history__stats">
      <article class="inventory-stat-card">
        <div class="inventory-stat-card__label">Bản ghi</div>
        <div class="inventory-stat-card__value">{{ movements.length }}</div>
        <div class="inventory-stat-card__meta">trên tổng {{ total }}</div>
      </article>
      <article class="inventory-stat-card">
        <div class="inventory-stat-card__label">Biến động ròng</div>
        <div class="inventory-stat-card__value" :class="{ 'is-negative': netDelta < 0 }">
          {{ formatDelta(netDelta) }}
        </div>
        <div class="inventory-stat-card__meta">trong danh sách đang lọc</div>
      </article>
      <article class="inventory-stat-card">
        <div class="inventory-stat-card__label">Giữ kho</div>
        <div class="inventory-stat-card__value">{{ reserveCount }}</div>
        <div class="inventory-stat-card__meta">lệnh `ORDER_RESERVE`</div>
      </article>
      <article class="inventory-stat-card">
        <div class="inventory-stat-card__label">Chỉnh tay</div>
        <div class="inventory-stat-card__value">{{ manualAdjustCount }}</div>
        <div class="inventory-stat-card__meta">lệnh `MANUAL_ADJUST`</div>
      </article>
    </section>

    <section class="page-panel inventory-history__filters">
      <div>
        <div class="panel-title mb-1">Bộ lọc</div>
        <div class="small text-muted">
          Lọc theo loại biến động, thời gian, mã đơn hoặc tên nguyên liệu.
        </div>
      </div>

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

        <label class="inventory-field">
          <span>Từ ngày</span>
          <input v-model="filters.from" class="form-control" type="date" />
        </label>

        <label class="inventory-field">
          <span>Đến ngày</span>
          <input v-model="filters.to" class="form-control" type="date" />
        </label>

        <label class="inventory-field">
          <span>Giới hạn</span>
          <select v-model.number="filters.limit" class="form-select">
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="300">300</option>
            <option :value="500">500</option>
          </select>
        </label>

        <div class="inventory-history__filter-actions">
          <button type="button" class="btn btn-outline-dark" @click="resetFilters">
            Xóa lọc
          </button>
          <button type="button" class="btn btn-ember" :disabled="loading" @click="loadMovements">
            Áp dụng
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert-danger py-2 mb-0">
        {{ errorMessage }}
      </div>
    </section>

    <section class="page-panel">
      <DataTable
        row-key="id"
        :columns="columns"
        :items="movements"
        :loading="loading"
        empty-text="Chưa có biến động kho phù hợp."
      >
        <template #cell-createdAt="{ row }">
          <div class="inventory-cell__primary">{{ formatDateTime(row.createdAt) }}</div>
          <div class="inventory-cell__sub">#{{ row.id }}</div>
        </template>

        <template #cell-ingredient="{ row }">
          <div class="inventory-cell__primary">{{ row.ingredient?.name || "Nguyên liệu" }}</div>
          <div class="inventory-cell__sub">
            ingredientId: {{ row.ingredientId }}
            <span v-if="row.ingredient?.unit">| {{ row.ingredient.unit }}</span>
          </div>
        </template>

        <template #cell-movementType="{ row }">
          <span class="inventory-type-chip" :class="`is-${movementTone(row.movementType)}`">
            {{ formatMovementType(row.movementType) }}
          </span>
        </template>

        <template #cell-quantityDelta="{ row }">
          <span
            class="inventory-delta"
            :class="{ 'is-negative': Number(row.quantityDelta || 0) < 0, 'is-positive': Number(row.quantityDelta || 0) > 0 }"
          >
            {{ formatDelta(Number(row.quantityDelta || 0)) }}
          </span>
        </template>

        <template #cell-order="{ row }">
          <div class="inventory-cell__primary">
            {{ row.order?.orderNumber || "Không gắn đơn" }}
          </div>
          <div class="inventory-cell__sub">
            {{ row.orderItem?.itemNameSnapshot || row.note || "-" }}
          </div>
        </template>

        <template #cell-createdBy="{ row }">
          <div class="inventory-cell__primary">
            {{ row.createdBy?.fullName || "Hệ thống" }}
          </div>
          <div class="inventory-cell__sub">
            {{ row.createdBy?.role || "-" }}
          </div>
        </template>

        <template #cell-note="{ row }">
          <div class="inventory-note">{{ row.note || "-" }}</div>
        </template>
      </DataTable>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
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
  { key: "createdAt", title: "Thời gian" },
  { key: "ingredient", title: "Nguyên liệu" },
  { key: "movementType", title: "Loại" },
  { key: "quantityDelta", title: "Biến động" },
  { key: "order", title: "Nguồn phát sinh" },
  { key: "createdBy", title: "Người thao tác" },
  { key: "note", title: "Ghi chú" },
];

const movementTypeOptions = [
  "MANUAL_ADJUST",
  "ORDER_RESERVE",
  "ORDER_RELEASE",
  "ORDER_RESTORE",
  "CORRECTION",
  "MENU_POOL_INCREASE",
  "MENU_POOL_DECREASE",
];

const filters = reactive({
  search: "",
  movementType: "",
  from: "",
  to: "",
  limit: 200,
});

const loading = ref(false);
const errorMessage = ref("");
const total = ref(0);
const movements = ref<InventoryMovementRow[]>([]);

const netDelta = computed(() =>
  movements.value.reduce((sum, row) => sum + Number(row.quantityDelta || 0), 0)
);
const reserveCount = computed(
  () => movements.value.filter((row) => row.movementType === "ORDER_RESERVE").length
);
const manualAdjustCount = computed(
  () => movements.value.filter((row) => row.movementType === "MANUAL_ADJUST").length
);

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatMovementType(value: string) {
  const labels: Record<string, string> = {
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
  if (value === "ORDER_RESERVE" || value === "MENU_POOL_DECREASE") return "danger";
  if (value === "ORDER_RELEASE" || value === "ORDER_RESTORE" || value === "MANUAL_ADJUST") {
    return "success";
  }
  return "muted";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDelta(value: number) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function resetFilters() {
  filters.search = "";
  filters.movementType = "";
  filters.from = "";
  filters.to = "";
  filters.limit = 200;
  void loadMovements();
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
        limit: filters.limit,
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

onMounted(() => {
  void loadMovements();
});
</script>

<style scoped>
.inventory-history {
  display: grid;
  gap: 16px;
}

.inventory-history__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.inventory-history__title {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
}

.inventory-history__note {
  margin: 6px 0 0;
  color: var(--muted);
}

.inventory-history__refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  color: #fff;
  font-weight: 700;
}

.inventory-history__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.inventory-stat-card {
  border: 1px solid rgba(var(--line-rgb), 0.72);
  border-radius: 18px;
  padding: 16px;
  background: rgba(var(--panel-rgb), 0.92);
  box-shadow: var(--shadow);
}

.inventory-stat-card__label {
  color: var(--muted);
  font-size: 0.82rem;
}

.inventory-stat-card__value {
  margin-top: 6px;
  font-size: 1.4rem;
  font-weight: 800;
}

.inventory-stat-card__value.is-negative {
  color: var(--danger);
}

.inventory-stat-card__meta {
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.82rem;
}

.inventory-history__filters {
  display: grid;
  gap: 14px;
}

.inventory-history__filter-grid {
  display: grid;
  grid-template-columns: minmax(260px, 1.6fr) repeat(4, minmax(0, 1fr));
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

.inventory-history__filter-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.inventory-cell__primary {
  font-weight: 700;
}

.inventory-cell__sub {
  color: var(--muted);
  font-size: 0.82rem;
}

.inventory-type-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 800;
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
}

.inventory-delta.is-positive {
  color: var(--green);
}

.inventory-delta.is-negative {
  color: var(--danger);
}

.inventory-note {
  white-space: normal;
  line-height: 1.45;
}

@media (max-width: 1199px) {
  .inventory-history__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inventory-history__filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .inventory-history__hero {
    flex-direction: column;
  }

  .inventory-history__stats,
  .inventory-history__filter-grid {
    grid-template-columns: 1fr;
  }

  .inventory-history__filter-actions {
    justify-content: stretch;
  }

  .inventory-history__filter-actions .btn {
    flex: 1 1 auto;
  }
}
</style>
