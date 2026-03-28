<template>
  <div class="cust-orders">
    <!-- Filter bar -->
    <div class="cust-filters">
      <div class="cust-filter-tabs">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          :class="['cust-tab', { 'is-active': filter.status === tab.value }]"
          type="button"
          @click="filter.status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="cust-filter-date-row">
        <input
          v-model="filter.date"
          class="cust-date-input"
          type="date"
          :max="todayDateValue"
        />
        <button
          v-if="filter.date"
          class="cust-date-clear"
          type="button"
          aria-label="Xóa ngày"
          @click="filter.date = ''"
        >×</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="cust-state">Đang tải đơn hàng...</div>

    <!-- Empty -->
    <div v-else-if="!filteredOrders.length" class="cust-state">
      {{ allOrders.length ? "Không có đơn phù hợp bộ lọc." : "Bạn chưa có đơn hàng nào." }}
    </div>

    <!-- Order list -->
    <div v-else class="cust-list">
      <div
        v-for="order in filteredOrders"
        :key="order.id"
        :class="['cust-card', `is-${order.status.toLowerCase()}`]"
      >
        <!-- Head -->
        <div class="cust-card-head">
          <div class="cust-card-meta">
            <span class="cust-order-number">{{ order.orderNumber }}</span>
            <span class="cust-order-date">{{ formatDate(order.createdAt) }}</span>
            <span v-if="order.arrivalAt" class="cust-order-date">
              Giờ hẹn: {{ formatTime(order.arrivalAt) }}
            </span>
          </div>
          <span :class="['cust-badge', `is-${order.status.toLowerCase()}`]">
            {{ getStatusLabel(order.status) }}
          </span>
        </div>

        <!-- Items -->
        <ul class="cust-item-list">
          <li
            v-for="(item, index) in getDraftItems(order)"
            :key="item.key"
            class="cust-item-row"
          >
            <span class="cust-item-name">{{ item.itemNameSnapshot }}</span>
            <div class="cust-item-right">
              <template v-if="canEditOrder(order)">
                <button
                  class="cust-qty-btn"
                  type="button"
                  :disabled="isBusy(order)"
                  @click="changeDraftQty(order, index, -1)"
                >−</button>
                <span class="cust-item-qty">{{ item.quantity }}</span>
                <button
                  class="cust-qty-btn"
                  type="button"
                  :disabled="isBusy(order)"
                  @click="changeDraftQty(order, index, 1)"
                >+</button>
              </template>
              <span v-else class="cust-item-qty-read">×{{ item.quantity }}</span>
              <span class="cust-item-price">{{ formatMoney(item.lineTotal) }}</span>
            </div>
          </li>
        </ul>

        <!-- Add item (PENDING + has today menu) -->
        <div v-if="canEditOrder(order) && todayMenuOptions.length" class="cust-add-row">
          <select
            :value="addSelections[order.id] || ''"
            class="cust-select"
            :disabled="isBusy(order)"
            @change="addSelections[order.id] = ($event.target as HTMLSelectElement).value"
          >
            <option value="">Thêm món...</option>
            <option
              v-for="option in todayMenuOptions"
              :key="option.id"
              :value="String(option.id)"
            >
              {{ option.menuItem.name }} · {{ formatMoney(option.sellingPrice) }}
            </option>
          </select>
          <button
            class="cust-add-btn"
            type="button"
            :disabled="isBusy(order) || !addSelections[order.id]"
            @click="addDraftItem(order)"
          >+</button>
        </div>

        <!-- Footer -->
        <div class="cust-card-foot">
          <span class="cust-total">Tổng <strong>{{ formatMoney(order.totalAmount) }}</strong></span>
          <div class="cust-actions">
            <template v-if="canEditOrder(order) && hasDraftChanged(order)">
              <button
                class="cust-btn cust-btn-save"
                type="button"
                :disabled="isBusy(order)"
                @click="saveEdit(order)"
              >{{ savingId === order.id ? "Đang lưu..." : "Lưu" }}</button>
              <button
                class="cust-btn cust-btn-ghost"
                type="button"
                :disabled="isBusy(order)"
                @click="discardDraft(order.id)"
              >Bỏ</button>
            </template>
            <button
              v-if="canCancelOrder(order)"
              class="cust-btn cust-btn-cancel"
              type="button"
              :disabled="isBusy(order)"
              @click="openCancelConfirm(order)"
            >Hủy đơn</button>
          </div>
        </div>

        <div v-if="orderError[order.id]" class="cust-error">{{ orderError[order.id] }}</div>
      </div>
    </div>

    <!-- Cancel confirm modal -->
    <div
      v-if="cancelConfirm.visible"
      class="cust-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="closeCancelConfirm"
    >
      <div class="cust-modal">
        <div class="cust-modal-title">Xác nhận hủy đơn?</div>
        <p class="cust-modal-text">Sau khi hủy, đơn hàng sẽ không thể khôi phục.</p>
        <div class="cust-modal-actions">
          <button class="cust-btn cust-btn-ghost" type="button" @click="closeCancelConfirm">
            Quay lại
          </button>
          <button class="cust-btn cust-btn-cancel" type="button" @click="confirmCancel">
            Xác nhận hủy
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatDate, formatMoney } from "../../utils/format";

type OrderItem = {
  id: number;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lineTotal: number;
};

type OrderRecord = {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  arrivalAt?: string | null;
  createdAt: string;
  dailyMenuId?: number | null;
  items?: OrderItem[];
  itemProgress?: { total: number; ready: number };
};

type DraftItem = {
  key: string;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

type MenuOption = {
  id: number;
  sellingPrice: number;
  isAvailable: boolean;
  menuItem: { id: number; name: string };
};

const statusTabs = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đang xử lý" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const allOrders = ref<OrderRecord[]>([]);
const isLoading = ref(false);
const savingId = ref<number | null>(null);
const cancellingId = ref<number | null>(null);
const drafts = reactive<Record<number, DraftItem[]>>({});
const addSelections = reactive<Record<number, string>>({});
const orderError = reactive<Record<number, string>>({});
const todayMenuOptions = ref<MenuOption[]>([]);

const filter = reactive({ status: "", date: "" });

const todayDateValue = new Date().toISOString().slice(0, 10);

const cancelConfirm = reactive<{ visible: boolean; order: OrderRecord | null }>({
  visible: false,
  order: null,
});

const filteredOrders = computed(() => {
  return allOrders.value.filter((order) => {
    if (filter.status && order.status !== filter.status) return false;
    if (filter.date) {
      const orderDate = order.createdAt?.slice(0, 10);
      if (orderDate !== filter.date) return false;
    }
    return true;
  });
});

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getStatusLabel(status: string) {
  if (status === "PENDING") return "Chờ xác nhận";
  if (status === "CONFIRMED") return "Đang xử lý";
  if (status === "COMPLETED") return "Hoàn tất";
  if (status === "CANCELLED") return "Đã hủy";
  return status;
}

function canEditOrder(order: OrderRecord) {
  return order.status === "PENDING";
}

function canCancelOrder(order: OrderRecord) {
  return order.status === "PENDING" || order.status === "CONFIRMED";
}

function isBusy(order: OrderRecord) {
  return savingId.value === order.id || cancellingId.value === order.id;
}

function cloneItems(items: OrderItem[] = []): DraftItem[] {
  return items.map((item, i) => ({
    key: `${item.dailyMenuItemId ?? item.menuItemId ?? "item"}-${i}`,
    menuItemId: item.menuItemId ?? null,
    dailyMenuItemId: item.dailyMenuItemId ?? null,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    lineTotal: Number(item.lineTotal || 0),
  }));
}

function getDraftItems(order: OrderRecord) {
  return drafts[order.id] ?? cloneItems(order.items);
}

function hasDraftChanged(order: OrderRecord) {
  if (!drafts[order.id]) return false;
  const orig = cloneItems(order.items).map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}`).join("|");
  const curr = drafts[order.id].map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}`).join("|");
  return orig !== curr;
}

function ensureDraft(order: OrderRecord) {
  if (!drafts[order.id]) {
    drafts[order.id] = cloneItems(order.items);
  }
}

function discardDraft(orderId: number) {
  delete drafts[orderId];
  delete addSelections[orderId];
}

function changeDraftQty(order: OrderRecord, index: number, delta: number) {
  ensureDraft(order);
  const item = drafts[order.id][index];
  if (!item) return;
  const next = item.quantity + delta;
  if (next <= 0) {
    drafts[order.id] = drafts[order.id].filter((_, i) => i !== index);
  } else {
    drafts[order.id][index] = { ...item, quantity: next, lineTotal: next * item.unitPrice };
  }
}

function addDraftItem(order: OrderRecord) {
  const selectedId = Number(addSelections[order.id] || 0);
  if (!selectedId) return;
  const option = todayMenuOptions.value.find((o) => o.id === selectedId);
  if (!option) return;

  ensureDraft(order);
  const existing = drafts[order.id].findIndex((i) => i.dailyMenuItemId === option.id);
  if (existing >= 0) {
    const cur = drafts[order.id][existing];
    drafts[order.id][existing] = {
      ...cur,
      quantity: cur.quantity + 1,
      lineTotal: (cur.quantity + 1) * cur.unitPrice,
    };
  } else {
    drafts[order.id].push({
      key: `new-${option.id}`,
      menuItemId: option.menuItem.id,
      dailyMenuItemId: option.id,
      itemNameSnapshot: option.menuItem.name,
      unitPrice: Number(option.sellingPrice || 0),
      quantity: 1,
      lineTotal: Number(option.sellingPrice || 0),
    });
  }
  addSelections[order.id] = "";
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

async function saveEdit(order: OrderRecord) {
  const draft = drafts[order.id];
  if (!draft?.length) return;

  savingId.value = order.id;
  delete orderError[order.id];

  try {
    const { data } = await api.put(`/orders/my/${order.id}`, {
      items: draft.map((i) => ({
        dailyMenuItemId: i.dailyMenuItemId ?? undefined,
        menuItemId: i.menuItemId ?? undefined,
        quantity: i.quantity,
      })),
    });
    discardDraft(order.id);
    const idx = allOrders.value.findIndex((o) => o.id === order.id);
    if (idx >= 0) allOrders.value[idx] = data as OrderRecord;
  } catch (error) {
    orderError[order.id] = getErrorMessage(error, "Không lưu được thay đổi.");
  } finally {
    savingId.value = null;
  }
}

function openCancelConfirm(order: OrderRecord) {
  cancelConfirm.visible = true;
  cancelConfirm.order = order;
}

function closeCancelConfirm() {
  cancelConfirm.visible = false;
  cancelConfirm.order = null;
}

async function confirmCancel() {
  const order = cancelConfirm.order;
  if (!order) return;
  closeCancelConfirm();

  cancellingId.value = order.id;
  delete orderError[order.id];

  try {
    const { data } = await api.put(`/orders/my/${order.id}/cancel`);
    discardDraft(order.id);
    const idx = allOrders.value.findIndex((o) => o.id === order.id);
    if (idx >= 0) allOrders.value[idx] = data as OrderRecord;
  } catch (error) {
    orderError[order.id] = getErrorMessage(error, "Không hủy được đơn hàng.");
  } finally {
    cancellingId.value = null;
  }
}

async function loadOrders() {
  isLoading.value = true;
  try {
    const [ordersRes, menuRes] = await Promise.allSettled([
      api.get("/orders/my"),
      api.get("/daily-menus/public/today"),
    ]);

    if (ordersRes.status === "fulfilled") {
      allOrders.value = (ordersRes.value.data as OrderRecord[]) || [];
    }

    if (menuRes.status === "fulfilled") {
      const menuData = menuRes.value.data as { items?: MenuOption[] } | null;
      todayMenuOptions.value = (menuData?.items || []).filter((i) => i.isAvailable);
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadOrders);
</script>

<style scoped>
/* ─── Page wrapper ─────────────────────────────────── */
.cust-orders {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  margin: -24px;
}

/* ─── Filter bar ───────────────────────────────────── */
.cust-filters {
  position: sticky;
  top: -24px;
  z-index: 10;
  background: #fff;
  border-bottom: 1px solid rgba(var(--text-rgb), 0.1);
}

.cust-filter-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 0;
  border-bottom: 1px solid rgba(var(--text-rgb), 0.06);
}
.cust-filter-tabs::-webkit-scrollbar { display: none; }

.cust-tab {
  flex-shrink: 0;
  padding: 11px 16px;
  font-size: 0.85rem;
  font-weight: 500;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted, #888);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.cust-tab.is-active {
  color: #23130f;
  border-bottom-color: #23130f;
  font-weight: 600;
}

.cust-filter-date-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
}

.cust-date-input {
  flex: 1;
  height: 34px;
  border: 1px solid rgba(var(--text-rgb), 0.15);
  border-radius: 4px;
  padding: 0 8px;
  font-size: 0.85rem;
  background: #fafafa;
  color: #23130f;
}

.cust-date-clear {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 1.1rem;
  color: var(--muted, #888);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ─── State ────────────────────────────────────────── */
.cust-state {
  text-align: center;
  color: var(--muted, #888);
  padding: 48px 16px;
  font-size: 0.9rem;
}

/* ─── Card list — flat, full-bleed ─────────────────── */
.cust-list {
  flex: 1;
}

.cust-card {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(var(--text-rgb), 0.08);
  display: grid;
  gap: 10px;
  background: #fff;
}

.cust-card.is-cancelled {
  background: #fafafa;
  opacity: 0.72;
}

.cust-card.is-pending {
  border-left: 3px solid #c9a340;
}

.cust-card.is-confirmed {
  border-left: 3px solid #c77e47;
}

.cust-card.is-completed {
  border-left: 3px solid #42856840;
}

/* ─── Card head ────────────────────────────────────── */
.cust-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.cust-card-meta {
  display: grid;
  gap: 1px;
}

.cust-order-number {
  font-weight: 600;
  font-size: 0.88rem;
  letter-spacing: 0.02em;
  color: #23130f;
}

.cust-order-date {
  font-size: 0.78rem;
  color: var(--muted, #888);
}

.cust-badge {
  flex-shrink: 0;
  display: inline-block;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.cust-badge.is-pending   { background: rgba(203,165,81,0.18); color: #8b6517; }
.cust-badge.is-confirmed { background: rgba(201,126,71,0.16); color: #8a451f; }
.cust-badge.is-completed { background: rgba(66,133,104,0.15); color: #2a7550; }
.cust-badge.is-cancelled { background: rgba(148,88,88,0.14);  color: #8f2f15; }

/* ─── Item list ────────────────────────────────────── */
.cust-item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.cust-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cust-item-name {
  flex: 1;
  font-size: 0.88rem;
}

.cust-item-right {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.cust-qty-btn {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(var(--text-rgb), 0.18);
  background: none;
  border-radius: 2px;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
}

.cust-qty-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.cust-item-qty {
  min-width: 18px;
  text-align: center;
  font-weight: 600;
  font-size: 0.88rem;
}

.cust-item-qty-read {
  font-size: 0.82rem;
  color: var(--muted, #888);
}

.cust-item-price {
  font-size: 0.82rem;
  color: var(--muted, #888);
  min-width: 58px;
  text-align: right;
}

/* ─── Add item row ─────────────────────────────────── */
.cust-add-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cust-select {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid rgba(var(--text-rgb), 0.15);
  border-radius: 4px;
  background: #fafafa;
  font-size: 0.85rem;
}

.cust-add-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(var(--text-rgb), 0.25);
  background: none;
  border-radius: 4px;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cust-add-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ─── Card footer ──────────────────────────────────── */
.cust-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid rgba(var(--text-rgb), 0.06);
}

.cust-total {
  font-size: 0.88rem;
}

.cust-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ─── Buttons ──────────────────────────────────────── */
.cust-btn {
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.cust-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.cust-btn-save   { background: #23130f; color: #fff; }
.cust-btn-ghost  { background: none; border: 1px solid rgba(var(--text-rgb), 0.22); color: #23130f; }
.cust-btn-cancel { background: none; border: 1px solid rgba(180,60,40,0.35); color: #b43c28; }

/* ─── Error ────────────────────────────────────────── */
.cust-error {
  font-size: 0.78rem;
  color: #b43c28;
}

/* ─── Modal ────────────────────────────────────────── */
.cust-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 500;
}

.cust-modal {
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 24px 20px 32px;
  width: 100%;
  max-width: 480px;
  display: grid;
  gap: 12px;
}

.cust-modal-title {
  font-weight: 700;
  font-size: 1rem;
}

.cust-modal-text {
  font-size: 0.88rem;
  color: var(--muted, #666);
  margin: 0;
}

.cust-modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
}
</style>
