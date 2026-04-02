<template>
  <div class="cust-orders">
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

    <div v-if="isLoading" class="cust-state">Đang tải đơn hàng...</div>

    <div v-else-if="!filteredOrders.length" class="cust-state">
      {{ allOrders.length ? "Không có đơn phù hợp bộ lọc." : "Bạn chưa có đơn hàng nào." }}
    </div>

    <div v-else class="cust-list">
      <CustomerOrderCard
        v-for="order in filteredOrders"
        :key="order.id"
        :order="order"
        :menu-options="todayMenuOptions"
        :busy="isBusy(order)"
        :is-saving="savingId === order.id"
        :is-cancelling="cancellingId === order.id"
        :cancelling-item-id="cancellingItemOrderId === order.id ? cancellingItemId : null"
        :error-message="orderError[order.id] || ''"
        @save-items="(items, arrivalTime) => saveEdit(order, items, arrivalTime)"
        @request-cancel="openCancelConfirm(order)"
        @request-cancel-item="(itemId) => openCancelItemConfirm(order, itemId)"
      />
    </div>

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
        <div class="cust-modal-actions cust-modal-actions--icon">
          <button
            class="cust-icon-btn cust-icon-btn-ghost"
            type="button"
            aria-label="Không hủy đơn"
            title="Không hủy đơn"
            @click="closeCancelConfirm"
          >
            <i class="bi bi-x-lg"></i>
          </button>
          <button
            class="cust-icon-btn cust-icon-btn-confirm"
            type="button"
            aria-label="Xác nhận hủy đơn"
            title="Xác nhận hủy đơn"
            @click="confirmCancel"
          >
            <i class="bi bi-check-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="cancelItemConfirm.visible && cancelItemConfirm.order && cancelItemConfirm.item"
      class="cust-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="closeCancelItemConfirm"
    >
      <div class="cust-modal">
        <div class="cust-modal-title">Xác nhận hủy món?</div>
        <p class="cust-modal-text">
          <template v-if="cancelItemConfirm.reason === 'quantity-zero'">
            Giảm <strong>{{ cancelItemConfirm.item.itemNameSnapshot }}</strong> về 0 sẽ hủy món này khỏi đơn.
          </template>
          <template v-else>
            Món <strong>{{ cancelItemConfirm.item.itemNameSnapshot }}</strong> đang chờ sẽ bị hủy khỏi đơn.
          </template>
        </p>
        <div class="cust-modal-actions cust-modal-actions--icon">
          <button
            class="cust-icon-btn cust-icon-btn-ghost"
            type="button"
            aria-label="Không hủy món"
            title="Không hủy món"
            @click="closeCancelItemConfirm"
          >
            <i class="bi bi-x-lg"></i>
          </button>
          <button
            class="cust-icon-btn cust-icon-btn-confirm"
            type="button"
            aria-label="Xác nhận hủy món"
            title="Xác nhận hủy món"
            @click="confirmCancelItem"
          >
            <i class="bi bi-check-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <Transition name="cust-toast">
      <div v-if="actionToast.visible" class="cust-toast" role="status" aria-live="polite">
        <i class="bi bi-info-circle"></i>
        <span>{{ actionToast.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { socket } from "../../socket";
import CustomerOrderCard from "../../components/customer/CustomerOrderCard.vue";

type OrderItem = {
  id: number;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lineTotal: number;
  note?: string | null;
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

type MenuOption = {
  id: number;
  sellingPrice: number;
  isAvailable: boolean;
  menuItem: { id: number; name: string };
};

type SavePayload = {
  dailyMenuItemId?: number;
  menuItemId?: number;
  quantity: number;
  note?: string;
};

type OrderChangeEvent = {
  type:
    | "ADMIN_CONFIRMED_ORDER"
    | "ADMIN_COMPLETED_ORDER"
    | "ADMIN_CANCELLED_ORDER"
    | "ADMIN_ITEM_RESTORED"
    | "ADMIN_ITEM_COOKING"
    | "ADMIN_ITEM_READY";
  order: OrderRecord;
  itemId?: number;
  itemName?: string;
  quantity?: number;
  occurredAt: string;
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
const cancellingItemOrderId = ref<number | null>(null);
const cancellingItemId = ref<number | null>(null);
const updatingItemOrderId = ref<number | null>(null);
const orderError = reactive<Record<number, string>>({});
const todayMenuOptions = ref<MenuOption[]>([]);

const todayDateValue = new Date(
  Date.now() - new Date().getTimezoneOffset() * 60_000
).toISOString().slice(0, 10);

const filter = reactive({ status: "", date: "" });

const cancelConfirm = reactive<{ visible: boolean; order: OrderRecord | null }>({
  visible: false,
  order: null,
});
const cancelItemConfirm = reactive<{
  visible: boolean;
  order: OrderRecord | null;
  item: OrderItem | null;
  reason: "button" | "quantity-zero";
}>({
  visible: false,
  order: null,
  item: null,
  reason: "button",
});
const actionToast = reactive({
  visible: false,
  message: "",
});
let toastTimerId: number | null = null;

const filteredOrders = computed(() =>
  [...allOrders.value]
    .filter((order) => {
      if (filter.status && order.status !== filter.status) return false;
      if (filter.date && getOrderDateInputValue(order.createdAt) !== filter.date) return false;
      return true;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt || 0).getTime();
      const rightTime = new Date(right.createdAt || 0).getTime();
      return rightTime - leftTime;
    })
);

function getOrderDateInputValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function isBusy(order: OrderRecord) {
  return (
    savingId.value === order.id ||
    cancellingId.value === order.id ||
    cancellingItemOrderId.value === order.id
  );
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function replaceOrder(orderId: number, payload: unknown) {
  const index = allOrders.value.findIndex((entry) => entry.id === orderId);
  if (index >= 0) {
    allOrders.value[index] = payload as OrderRecord;
    return;
  }

  allOrders.value = [payload as OrderRecord, ...allOrders.value];
}

function buildArrivalAtForOrder(order: OrderRecord, time?: string) {
  if (!time) return undefined;
  const source = String(order.arrivalAt || order.createdAt || "").slice(0, 10);
  if (!source) return undefined;
  return `${source}T${time}`;
}

async function saveEdit(order: OrderRecord, items: SavePayload[], arrivalTime?: string) {
  if (!items.length) {
    orderError[order.id] = "Đơn cần ít nhất 1 món.";
    return;
  }

  savingId.value = order.id;
  delete orderError[order.id];

  try {
    const arrivalAt = buildArrivalAtForOrder(order, arrivalTime);
    const payload = arrivalAt ? { items, arrivalAt } : { items };
    const { data } = await api.put(`/orders/my/${order.id}`, payload);
    replaceOrder(order.id, data);
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

function showActionToast(message: string) {
  actionToast.message = message;
  actionToast.visible = true;
  if (typeof toastTimerId === "number") {
    window.clearTimeout(toastTimerId);
  }
  toastTimerId = window.setTimeout(() => {
    actionToast.visible = false;
    toastTimerId = null;
  }, 3200);
}

function getRestoreToastMessage(event: OrderChangeEvent) {
  const itemName = String(event.itemName || "").trim() || "món đã hủy";
  const quantity = Math.max(0, Number(event.quantity || 0));
  if (quantity > 1) {
    return `Quán vừa phục hồi ${quantity} phần ${itemName} vào đơn của bạn.`;
  }
  return `Quán vừa phục hồi ${itemName} vào đơn của bạn.`;
}

function openCancelItemConfirm(
  order: OrderRecord,
  itemId: number,
  reason: "button" | "quantity-zero" = "button"
) {
  const item = (order.items || []).find((entry) => entry.id === itemId);
  if (!item) return;
  cancelItemConfirm.visible = true;
  cancelItemConfirm.order = order;
  cancelItemConfirm.item = item;
  cancelItemConfirm.reason = reason;
}

function closeCancelItemConfirm() {
  cancelItemConfirm.visible = false;
  cancelItemConfirm.order = null;
  cancelItemConfirm.item = null;
  cancelItemConfirm.reason = "button";
}

async function confirmCancel() {
  const order = cancelConfirm.order;
  if (!order) return;
  closeCancelConfirm();

  cancellingId.value = order.id;
  delete orderError[order.id];

  try {
    const { data } = await api.put(`/orders/my/${order.id}/cancel`);
    replaceOrder(order.id, data);
  } catch (error) {
    orderError[order.id] = getErrorMessage(error, "Không hủy được đơn hàng.");
  } finally {
    cancellingId.value = null;
  }
}

async function confirmCancelItem() {
  const order = cancelItemConfirm.order;
  const item = cancelItemConfirm.item;
  if (!order || !item) return;
  closeCancelItemConfirm();

  cancellingItemOrderId.value = order.id;
  cancellingItemId.value = item.id;
  delete orderError[order.id];

  try {
    const { data } = await api.put(`/orders/my/${order.id}/items/${item.id}/cancel`);
    replaceOrder(order.id, data);
  } catch (error) {
    orderError[order.id] = getErrorMessage(error, "Không hủy được món trong đơn.");
  } finally {
    cancellingItemOrderId.value = null;
    cancellingItemId.value = null;
  }
}

async function updateConfirmedItemQuantity(order: OrderRecord, itemId: number, quantity: number) {
  delete orderError[order.id];
  const currentItem = (order.items || []).find((entry) => entry.id === itemId);
  const isIncrease = quantity > Number(currentItem?.quantity || 0);

  if (quantity <= 0) {
    openCancelItemConfirm(order, itemId, "quantity-zero");
    return;
  }

  updatingItemOrderId.value = order.id;
  try {
    const { data } = await api.put(`/orders/my/${order.id}/items/${itemId}`, { quantity });
    replaceOrder(order.id, data);
    if (isIncrease) {
      showActionToast("Đã tăng số lượng. Món thêm sẽ xuống sau hàng đợi của các đơn confirmed khác.");
    }
  } catch (error) {
    orderError[order.id] = getErrorMessage(error, "Không cập nhật được số lượng món.");
  } finally {
    updatingItemOrderId.value = null;
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
      todayMenuOptions.value = (menuData?.items || []).filter((item) => item.isAvailable);
    }
  } finally {
    isLoading.value = false;
  }
}

function handleOrderChanged(event: OrderChangeEvent) {
  replaceOrder(event.order.id, event.order);
  if (event.type === "ADMIN_ITEM_RESTORED") {
    showActionToast(getRestoreToastMessage(event));
  }
}

onMounted(() => {
  void loadOrders();
  socket.on("order:changed", handleOrderChanged);
});

onBeforeUnmount(() => {
  if (typeof toastTimerId === "number") {
    window.clearTimeout(toastTimerId);
  }
  socket.off("order:changed", handleOrderChanged);
});
</script>

<style scoped>
.cust-orders {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  margin: -24px;
  background:
    linear-gradient(180deg, rgba(var(--panel-rgb), 0.9), rgba(var(--bg-rgb, 255, 248, 241), 0.92));
}

.cust-filters {
  position: sticky;
  top: -24px;
  z-index: 10;
  background: rgba(var(--panel-rgb), 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(var(--text-rgb), 0.08);
}

.cust-filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 14px 16px 0;
  scrollbar-width: none;
}

.cust-filter-tabs::-webkit-scrollbar { display: none; }

.cust-tab {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.cust-tab.is-active {
  border-color: rgba(var(--ember-rgb), 0.2);
  background: rgba(255, 247, 241, 0.92);
  color: var(--ember-strong);
}

.cust-filter-date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 14px;
}

.cust-date-input {
  flex: 1;
  height: 38px;
  border: 1px solid rgba(var(--text-rgb), 0.14);
  border-radius: 12px;
  padding: 0 10px;
  font-size: 0.86rem;
  background: rgba(var(--panel-rgb), 0.94);
  color: var(--text);
}

.cust-date-clear {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.06);
  font-size: 1.05rem;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cust-state {
  text-align: center;
  color: var(--muted);
  padding: 56px 20px;
  font-size: 0.92rem;
}

.cust-list {
  display: grid;
  gap: 10px;
  padding: 16px;
}

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
  color: var(--muted);
  margin: 0;
}

.cust-modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
}

.cust-modal-actions--icon {
  justify-content: center;
}

.cust-btn {
  padding: 7px 14px;
  font-size: 0.84rem;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  cursor: pointer;
}

.cust-btn-ghost {
  background: transparent;
  border: 1px solid rgba(var(--text-rgb), 0.2);
  color: var(--text);
}

.cust-btn-cancel {
  background: rgba(var(--danger-rgb), 0.08);
  border: 1px solid rgba(var(--danger-rgb), 0.2);
  color: var(--danger);
}

.cust-icon-btn {
  width: 46px;
  height: 46px;
  border: none;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: transform 0.15s, background 0.15s, color 0.15s;
}

.cust-icon-btn:hover {
  transform: translateY(-1px);
}

.cust-icon-btn-ghost {
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
}

.cust-icon-btn-confirm {
  background: rgba(var(--danger-rgb), 0.1);
  color: var(--danger);
}

.cust-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 520;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: min(420px, calc(100vw - 32px));
  max-width: min(420px, calc(100vw - 32px));
  padding: 12px 16px;
  border: 1px solid rgba(var(--ember-rgb), 0.18);
  border-radius: 16px;
  background: rgba(255, 247, 241, 0.98);
  box-shadow: 0 16px 32px rgba(var(--text-rgb), 0.12);
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 600;
}

.cust-toast i {
  color: var(--ember-strong);
}

.cust-toast-enter-active,
.cust-toast-leave-active {
  transition: opacity 0.18s, transform 0.18s;
}

.cust-toast-enter-from,
.cust-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@media (max-width: 767px) {
  .cust-list {
    padding: 0;
    gap: 8px;
  }

  .cust-filter-tabs {
    padding: 12px 12px 0;
  }

  .cust-filter-date-row {
    padding: 8px 12px 12px;
  }

  .cust-toast {
    bottom: 16px;
    min-width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    padding: 11px 14px;
  }
}
</style>
