<template>
  <div ref="bellWrapRef" class="topbar-bell-wrap">
    <button
      class="btn topbar-icon-button topbar-bell-button"
      type="button"
      aria-label="Thông báo đơn hàng"
      title="Thông báo đơn hàng"
      @click="toggleBellPanel"
    >
      <i class="bi bi-bell-fill"></i>
      <span v-if="unreadOrders.length && !bellOpen" class="topbar-bell-badge">
        {{ unreadOrders.length > 99 ? "99+" : unreadOrders.length }}
      </span>
    </button>

    <div v-if="bellOpen" class="topbar-bell-panel" @click.stop>
      <div class="topbar-bell-panel-head">
        <span class="topbar-bell-panel-title">
          {{ unreadOrders.length ? `${unreadOrders.length} thông báo mới` : "Không có thông báo mới" }}
        </span>
        <div class="topbar-bell-panel-actions">
          <button
            v-if="unreadOrders.length"
            class="topbar-bell-clear-btn"
            type="button"
            @click="clearUnread"
          >
            Đã xem
          </button>
          <button class="topbar-bell-open-btn" type="button" @click="openOrdersPage">
            Đơn
          </button>
        </div>
      </div>

      <ul v-if="unreadOrders.length" class="topbar-bell-list">
        <li v-for="notification in unreadOrders" :key="notification.key">
          <button class="topbar-bell-item" type="button" @click="openOrdersPage">
            <div class="topbar-bell-item-row">
              <span class="topbar-bell-item-name">{{ notification.subject }}</span>
              <span class="topbar-bell-item-time">{{ formatHM(notification.occurredAt) }}</span>
            </div>
            <div class="topbar-bell-item-title">{{ notification.title }}</div>
            <div class="topbar-bell-item-detail">{{ notification.detail }}</div>
            <div class="topbar-bell-item-meta">
              <span v-if="notification.phone">{{ notification.phone }}</span>
              <span>{{ notification.itemCount }} món</span>
              <span class="topbar-bell-item-total">{{ formatMoney(notification.totalAmount) }}</span>
            </div>
          </button>
        </li>
      </ul>

      <div v-else class="topbar-bell-empty">
        <i class="bi bi-bell-slash"></i>
        <span>{{ isCustomerBell ? "Chưa có cập nhật mới cho đơn của bạn" : "Chưa có thay đổi mới từ khách" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { socket } from "../socket";
import { formatMoney } from "../utils/format";

const props = defineProps<{
  ordersPath: string;
  role: string;
}>();

type OrderRecord = {
  id: number;
  source?: string;
  totalAmount: number;
  createdAt: string;
  arrivalAt?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  customer?: {
    fullName?: string | null;
    phone?: string | null;
  } | null;
  items?: Array<unknown>;
};

type OrderChangeEvent = {
  type:
    | "CUSTOMER_UPDATED"
    | "CUSTOMER_CANCELLED"
    | "CUSTOMER_ITEM_CANCELLED"
    | "ADMIN_CONFIRMED_ORDER"
    | "ADMIN_COMPLETED_ORDER"
    | "ADMIN_CANCELLED_ORDER"
    | "ADMIN_ITEM_RESTORED"
    | "ADMIN_ITEM_COOKING"
    | "ADMIN_ITEM_READY";
  order: OrderRecord;
  changedFields?: Array<"items" | "arrivalAt">;
  itemName?: string;
  quantity?: number;
  orderCancelled?: boolean;
  occurredAt: string;
};

type OrderNotification = {
  key: string;
  subject: string;
  phone: string;
  itemCount: number;
  totalAmount: number;
  title: string;
  detail: string;
  occurredAt: string;
};

const router = useRouter();
const bellWrapRef = ref<HTMLElement | null>(null);
const bellOpen = ref(false);
const unreadOrders = ref<OrderNotification[]>([]);
const normalizedRole = computed(() => String(props.role || "").toUpperCase());
const isCustomerBell = computed(() => normalizedRole.value === "CUSTOMER");
const isStaffBell = computed(() => normalizedRole.value === "ADMIN" || normalizedRole.value === "STAFF");

function formatHM(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCustomerName(order: OrderRecord) {
  return order.customer?.fullName || order.guestName || "Khách lẻ";
}

function getCustomerPhone(order: OrderRecord) {
  return order.guestPhone || order.customer?.phone || "";
}

function buildOrderNotification(
  order: OrderRecord,
  title: string,
  detail: string,
  occurredAt: string
): OrderNotification {
  return {
    key: `${order.id}-${occurredAt}-${title}`,
    subject: isCustomerBell.value ? `Đơn ${order.orderNumber}` : getCustomerName(order),
    phone: isCustomerBell.value ? "" : getCustomerPhone(order),
    itemCount: order.items?.length ?? 0,
    totalAmount: Number(order.totalAmount || 0),
    title,
    detail,
    occurredAt,
  };
}

function buildNotificationFromNewOrder(order: OrderRecord) {
  const detail = order.arrivalAt
    ? `Đơn mới, giờ hẹn ${formatHM(order.arrivalAt)}`
    : "Đơn mới từ khách";
  return buildOrderNotification(order, "Khách vừa tạo đơn", detail, order.createdAt);
}

function buildNotificationFromCustomerChange(event: OrderChangeEvent) {
  if (event.type === "CUSTOMER_CANCELLED") {
    return buildOrderNotification(
      event.order,
      "Khách vừa hủy đơn",
      "Đơn đã được khách hủy",
      event.occurredAt
    );
  }

  if (event.type === "CUSTOMER_ITEM_CANCELLED") {
    const itemName = event.itemName?.trim() || "một món";
    const detail = event.orderCancelled
      ? `Khách hủy ${itemName}, đơn đã đóng`
      : `Khách vừa hủy ${itemName} khỏi đơn`;
    return buildOrderNotification(
      event.order,
      "Khách vừa hủy món",
      detail,
      event.occurredAt
    );
  }

  const fields = new Set(event.changedFields || []);
  let detail = "Khách vừa cập nhật đơn";
  if (fields.has("items") && fields.has("arrivalAt")) {
    detail = "Khách đổi món và sửa giờ hẹn";
  } else if (fields.has("items")) {
    detail = "Khách vừa thay đổi món trong đơn";
  } else if (fields.has("arrivalAt")) {
    detail = `Khách đổi giờ hẹn sang ${
      event.order.arrivalAt ? formatHM(event.order.arrivalAt) : "chưa xác định"
    }`;
  }

  return buildOrderNotification(
    event.order,
    "Khách vừa cập nhật đơn",
    detail,
    event.occurredAt
  );
}

function buildNotificationFromAdminChange(event: OrderChangeEvent) {
  if (event.type === "ADMIN_CONFIRMED_ORDER") {
    const detail = event.order.arrivalAt
      ? `Quán đã xác nhận đơn, giờ hẹn ${formatHM(event.order.arrivalAt)}`
      : "Quán đã xác nhận và bắt đầu xử lý đơn của bạn";
    return buildOrderNotification(event.order, "Quán đã xác nhận đơn", detail, event.occurredAt);
  }

  if (event.type === "ADMIN_COMPLETED_ORDER") {
    return buildOrderNotification(
      event.order,
      "Đơn đã hoàn tất",
      "Quán đã hoàn tất đơn của bạn",
      event.occurredAt
    );
  }

  if (event.type === "ADMIN_CANCELLED_ORDER") {
    return buildOrderNotification(
      event.order,
      "Đơn đã bị hủy",
      "Quán đã hủy đơn của bạn",
      event.occurredAt
    );
  }

  if (event.type === "ADMIN_ITEM_RESTORED") {
    const itemName = event.itemName?.trim() || "một món đã hủy";
    const quantity = Math.max(0, Number(event.quantity || 0));
    const detail = quantity > 1
      ? `${itemName} đã được phục hồi ${quantity} phần vào đơn của bạn`
      : `${itemName} đã được phục hồi vào đơn của bạn`;
    return buildOrderNotification(
      event.order,
      "Món đã được phục hồi",
      detail,
      event.occurredAt
    );
  }

  if (event.type === "ADMIN_ITEM_COOKING") {
    const itemName = event.itemName?.trim() || "Món của bạn";
    return buildOrderNotification(
      event.order,
      "Món đang được làm",
      `${itemName} đang được bếp chuẩn bị`,
      event.occurredAt
    );
  }

  if (event.type === "ADMIN_ITEM_READY") {
    const itemName = event.itemName?.trim() || "Món của bạn";
    return buildOrderNotification(
      event.order,
      "Món đã lên",
      `${itemName} đã sẵn sàng`,
      event.occurredAt
    );
  }

  return null;
}

function playNewOrderSound() {
  try {
    const ctx = new AudioContext();
    const times = [0, 0.18, 0.36];
    for (const time of times) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + time);
      gain.gain.setValueAtTime(0.28, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.14);
      oscillator.start(ctx.currentTime + time);
      oscillator.stop(ctx.currentTime + time + 0.14);
    }
  } catch (_) {
    // Browser blocked audio.
  }
}

function pushUnreadOrder(notification: OrderNotification) {
  if (unreadOrders.value.some((entry) => entry.key === notification.key)) {
    return;
  }
  unreadOrders.value = [notification, ...unreadOrders.value].slice(0, 50);
  playNewOrderSound();
}

function toggleBellPanel() {
  bellOpen.value = !bellOpen.value;
}

function clearUnread() {
  unreadOrders.value = [];
  bellOpen.value = false;
}

function closeBellOnOutsideClick(event: MouseEvent) {
  if (bellWrapRef.value && !bellWrapRef.value.contains(event.target as Node)) {
    bellOpen.value = false;
  }
}

function openOrdersPage() {
  bellOpen.value = false;
  void router.push(props.ordersPath);
}

function handleNewOrder(order: OrderRecord) {
  if (!isStaffBell.value) return;
  if (order.source !== "CUSTOMER_APP") return;
  pushUnreadOrder(buildNotificationFromNewOrder(order));
}

function handleOrderChanged(event: OrderChangeEvent) {
  if (isCustomerBell.value) {
    const notification = buildNotificationFromAdminChange(event);
    if (notification) {
      pushUnreadOrder(notification);
    }
    return;
  }

  if (!isStaffBell.value || event.order.source !== "CUSTOMER_APP") return;
  pushUnreadOrder(buildNotificationFromCustomerChange(event));
}

onMounted(() => {
  socket.on("order:new", handleNewOrder);
  socket.on("order:changed", handleOrderChanged);
  document.addEventListener("click", closeBellOnOutsideClick);
});

onBeforeUnmount(() => {
  socket.off("order:new", handleNewOrder);
  socket.off("order:changed", handleOrderChanged);
  document.removeEventListener("click", closeBellOnOutsideClick);
});
</script>

<style scoped>
.topbar-bell-wrap {
  position: relative;
  display: inline-flex;
}

.topbar-bell-button {
  position: relative;
}

.topbar-bell-button i {
  font-size: 1rem;
}

.topbar-bell-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
}

.topbar-bell-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(360px, calc(100vw - 32px));
  max-height: min(70vh, 520px);
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(var(--line-rgb), 0.94);
  border-radius: 20px;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 20px 40px rgba(var(--text-rgb), 0.14);
}

.topbar-bell-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.topbar-bell-panel-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--text);
}

.topbar-bell-panel-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.topbar-bell-clear-btn,
.topbar-bell-open-btn {
  border: none;
  background: transparent;
  color: var(--ember-strong);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0;
}

.topbar-bell-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.topbar-bell-item {
  width: 100%;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--line-rgb), 0.72);
  border-radius: 14px;
  background: rgba(var(--panel-rgb), 0.76);
  text-align: left;
}

.topbar-bell-item:hover,
.topbar-bell-item:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.26);
  background: rgba(var(--ember-rgb), 0.06);
  outline: none;
}

.topbar-bell-item-row,
.topbar-bell-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.topbar-bell-item-name,
.topbar-bell-item-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.topbar-bell-item-time,
.topbar-bell-item-detail,
.topbar-bell-item-meta {
  font-size: 0.76rem;
  color: var(--muted);
}

.topbar-bell-item-total {
  color: var(--ember-strong);
  font-weight: 800;
}

.topbar-bell-empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  gap: 8px;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 767px) {
  .topbar-bell-panel {
    right: -48px;
  }
}
</style>
