<template>
  <div class="orders-page">
    <section class="orders-toolbar">
      <div class="orders-toolbar-body">
        <div class="orders-toolbar-main">
          <label class="orders-field orders-field-inline">
            <span class="orders-field-label">{{ statusFieldLabel }}</span>
            <select
              v-model="filter.status"
              class="form-select orders-select"
              :disabled="isLoading"
              @change="handleImmediateFilterChange"
            >
              <option value="">Đơn cần xử lý</option>
              <option value="CONFIRMED">Đang xử lý</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>

          <div class="orders-toolbar-side">
            <button
              class="orders-advanced-toggle"
              type="button"
              :aria-expanded="advancedFiltersOpen ? 'true' : 'false'"
              @click="advancedFiltersOpen = !advancedFiltersOpen"
            >
              <span>Bộ lọc nâng cao</span>
              <i
                :class="['bi', advancedFiltersOpen ? 'bi-chevron-up' : 'bi-chevron-down', 'orders-toolbar-chevron']"
              ></i>
            </button>

            <div class="orders-toolbar-summary">
              <span class="orders-meta-chip">
                {{ isLoading ? "Đang tải..." : `${orders.length} đơn` }}
              </span>
              <span v-if="!isLoading" class="orders-meta-chip">Tổng {{ formatMoney(totalAmount) }}</span>
            </div>
          </div>
        </div>

        <div v-if="advancedFiltersOpen" class="orders-advanced">
          <div class="orders-advanced-body">
            <label class="orders-field orders-search-field">
              <span class="orders-field-label">Tìm nhanh</span>
              <div class="orders-search-control">
                <i class="bi bi-search"></i>
                <input
                  v-model.trim="filter.search"
                  class="form-control orders-search-input"
                  type="search"
                  placeholder="Mã đơn, khách, SĐT"
                  autocomplete="off"
                  @input="scheduleSearch"
                  @search="handleImmediateFilterChange"
                />
              </div>
            </label>

            <label class="orders-field">
              <span class="orders-field-label">Ngày đặt</span>
              <input
                v-model="filter.date"
                class="form-control orders-select"
                type="date"
                :disabled="isLoading"
                @change="handleImmediateFilterChange"
              />
            </label>
          </div>
        </div>
      </div>
    </section>

    <div v-if="errorMessage" class="orders-feedback is-error">
      <i class="bi bi-exclamation-circle"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <section class="orders-surface" :aria-busy="isLoading ? 'true' : 'false'">
      <header class="orders-surface-header">
        <div>
          <h2 class="orders-surface-title">Đơn hàng</h2>
          <p class="orders-surface-note">
            Luồng gọn cho quán nhỏ: đơn mở để sửa món, hoàn tất là chốt tiền luôn, còn lại chỉ cần hủy đơn.
          </p>
        </div>
        <div class="orders-surface-summary">
          <span class="orders-summary-count">{{ orders.length }} đơn</span>
          <span class="orders-summary-total">{{ formatMoney(totalAmount) }}</span>
        </div>
      </header>

      <div v-if="scheduleBuckets.length" class="orders-schedule-strip">
        <div v-for="bucket in scheduleBuckets" :key="bucket.key" class="orders-schedule-chip">
          <strong>{{ bucket.label }}</strong>
          <span>{{ bucket.orderCount }} đơn</span>
          <span>{{ bucket.guestCount }} khách</span>
          <span>{{ bucket.waiting + bucket.cooking }} món đang chạy</span>
        </div>
      </div>

      <div v-if="isLoading && !orders.length" class="orders-state">
        <div class="orders-state-title">Đang tải đơn hàng</div>
        <p>Dữ liệu sẽ hiển thị ngay khi hệ thống lấy xong.</p>
      </div>

      <div v-else-if="!orders.length" class="orders-state">
        <div class="orders-state-title">Không có đơn phù hợp</div>
        <p>Thử đổi ngày hoặc nới bộ lọc để xem thêm đơn hàng.</p>
      </div>

      <div v-else class="orders-list">
        <article
          v-for="order in orders"
          :key="order.id"
          :class="['order-card', getOrderSurfaceClass(order.status)]"
        >
          <div class="order-card-head">
            <div class="order-head-main">
              <div class="order-identity">
                <span class="order-number">{{ order.orderNumber }}</span>
                <span class="order-time">{{ formatOrderTime(order.createdAt) }}</span>
              </div>
              <div class="order-contact-line">
                <span class="order-customer-name">{{ getCustomerName(order) }}</span>
                <span class="order-customer-phone">{{ getCustomerPhone(order) }}</span>
                <span v-if="order.tableLabel" class="order-table">{{ order.tableLabel }}</span>
                <span class="order-arrival-chip">
                  {{ getQueueLabel(order) }} {{ getQueueTime(order) }}
                </span>
              </div>
            </div>

            <div class="order-head-side">
              <div class="order-total">{{ formatMoney(order.totalAmount) }}</div>
            </div>
          </div>

          <div class="order-badges">
            <span :class="['order-pill', getSimpleStatusClass(order.status)]">
              {{ getOrderStatusLabel(order.status) }}
            </span>
            <span v-if="order.paymentMethod" class="order-pill is-muted">
              {{ getPaymentMethodLabel(order.paymentMethod) }}
            </span>
          </div>

          <div v-if="order.itemProgress?.total" class="order-progress">
            <div class="order-progress-head">
              <span class="orders-field-label">Hàng đợi món</span>
              <strong>{{ getProgressText(order) }}</strong>
            </div>
            <div class="order-progress-track">
              <span
                class="order-progress-segment is-waiting"
                :style="{ width: `${getProgressPercent(order, 'waiting')}%` }"
              ></span>
              <span
                class="order-progress-segment is-cooking"
                :style="{ width: `${getProgressPercent(order, 'cooking')}%` }"
              ></span>
              <span
                class="order-progress-segment is-ready"
                :style="{ width: `${getProgressPercent(order, 'ready')}%` }"
              ></span>
            </div>
            <div class="order-progress-legend">
              <span>Chờ {{ order.itemProgress.waiting }}</span>
              <span>Đang làm {{ order.itemProgress.cooking }}</span>
              <span>Lên món {{ order.itemProgress.ready }}</span>
            </div>
          </div>

          <ul class="order-item-list">
            <li v-if="!getEditableItems(order).length" class="order-item-row is-empty">
              <span class="order-item-name">Chưa có món</span>
            </li>
            <li
              v-for="(item, index) in getEditableItems(order)"
              :key="item.key"
              class="order-item-row"
            >
              <div class="order-item-main">
                <div class="order-item-copy">
                  <span class="order-item-name">{{ item.itemNameSnapshot }}</span>
                  <span class="order-item-meta">{{ formatMoney(item.unitPrice) }} / món</span>
                  <div class="order-item-statuses">
                    <template v-if="canUpdateItemStatus(order, item)">
                      <button
                        v-for="status in itemStatusActions"
                        :key="status.value"
                        type="button"
                        :class="['order-item-status', getItemStatusClass(status.value), { 'is-active': item.status === status.value }]"
                        @click="updateItemStatus(order, item, status.value)"
                      >
                        {{ status.label }}
                      </button>
                    </template>
                    <span
                      v-else
                      :class="['order-item-status', getItemStatusClass(item.id ? item.status : 'WAITING'), 'is-active']"
                    >
                      {{ item.id ? getItemStatusLabel(item.status) : "Chờ lưu món" }}
                    </span>
                  </div>
                </div>
                <span class="order-item-total">
                  {{ formatMoney(item.lineTotal) }}
                </span>
              </div>

              <div v-if="canEditItems(order)" class="order-item-editor">
                <button
                  class="btn btn-sm order-qty-btn"
                  type="button"
                  :disabled="isBusy(order)"
                  @click="changeDraftQuantity(order, index, -1)"
                >
                  -
                </button>
                <span class="order-item-qty">{{ item.quantity }}</span>
                <button
                  class="btn btn-sm order-qty-btn"
                  type="button"
                  :disabled="isBusy(order)"
                  @click="changeDraftQuantity(order, index, 1)"
                >
                  +
                </button>
              </div>

              <span v-else class="order-item-qty-read">{{ item.quantity }}</span>
            </li>
          </ul>

          <div v-if="canEditItems(order)" class="order-editor-panel">
            <div v-if="getAddableOptions(order).length" class="order-add-row">
              <div class="order-add-field">
                <span class="orders-field-label">Thêm món vào đơn</span>
                <div class="order-add-control">
                  <select
                    :value="getItemAddSelection(order.id)"
                    class="form-select orders-select"
                    :disabled="isBusy(order)"
                    @change="handleItemAddSelection(order.id, $event)"
                  >
                    <option value="">Chọn món để thêm</option>
                    <option
                      v-for="option in getAddableOptions(order)"
                      :key="option.id"
                      :value="String(option.id)"
                    >
                      {{ option.menuItem.name }} · {{ formatMoney(option.sellingPrice) }}
                    </option>
                  </select>
                  <button
                    class="btn btn-outline-dark order-add-btn"
                    type="button"
                    :disabled="isBusy(order) || !itemAddSelections[order.id]"
                    @click="addDraftItem(order)"
                    aria-label="Thêm món"
                    title="Thêm món"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="order-add-hint">
              Hôm nay không còn món khả dụng để thêm vào đơn này.
            </div>

            <div v-if="hasDraftChanged(order)" class="order-editor-actions">
              <div class="order-editor-note">
                Lưu thay đổi món trước khi hoàn tất hoặc hủy đơn.
              </div>
              <button
                class="btn btn-dark"
                type="button"
                :disabled="isBusy(order)"
                @click="saveOrderItems(order)"
              >
                {{ savingOrderId === order.id ? "Đang lưu..." : "Lưu món" }}
              </button>
              <button
                class="btn btn-outline-dark"
                type="button"
                :disabled="isBusy(order)"
                @click="discardDraft(order.id)"
              >
                Bỏ thay đổi
              </button>
            </div>
          </div>

          <div class="order-actions">
            <button
              v-if="canCompleteOrder(order)"
              class="btn btn-ember"
              type="button"
              :disabled="isBusy(order) || hasDraftChanged(order) || !isReadyToComplete(order)"
              @click="openCompleteDialog(order)"
            >
              Hoàn tất
            </button>
            <button
              v-if="canCancelOrder(order)"
              class="btn btn-outline-danger"
              type="button"
              :disabled="isBusy(order) || hasDraftChanged(order)"
              @click="openCancelDialog(order)"
            >
              Hủy đơn
            </button>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="removeItemDialog.visible"
      class="orders-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="closeRemoveItemDialog"
    >
      <div class="orders-modal">
        <div class="orders-modal-title">Xóa món khỏi đơn?</div>
        <p class="orders-modal-text">
          Giảm về 0 sẽ xóa <strong>{{ removeItemDialog.itemName }}</strong> khỏi đơn.
        </p>
        <div class="orders-modal-actions">
          <button class="btn btn-outline-dark" type="button" @click="closeRemoveItemDialog">
            Giữ lại
          </button>
          <button class="btn btn-danger" type="button" @click="confirmRemoveItem">
            Xóa món
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="completeDialog.visible && completeDialog.order"
      class="orders-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="closeCompleteDialog"
    >
      <div class="orders-modal">
        <button
          class="orders-modal-close"
          type="button"
          aria-label="Đóng"
          @click="closeCompleteDialog"
        >
          <i class="bi bi-x-lg"></i>
        </button>
        <div class="orders-modal-title">Xác nhận hoàn tất đơn</div>
        <p class="orders-modal-text">Khách thanh toán bằng cách nào?</p>
        <div class="orders-modal-actions">
          <button class="btn btn-ember" type="button" @click="confirmComplete('CASH')">
            Tiền mặt
          </button>
          <button class="btn btn-outline-dark" type="button" @click="confirmComplete('TRANSFER')">
            Chuyển khoản
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="cancelDialog.visible && cancelDialog.order"
      class="orders-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="closeCancelDialog"
    >
      <div class="orders-modal">
        <div class="orders-modal-title">Xác nhận hủy đơn</div>
        <p class="orders-modal-text">Chọn lý do hủy để ghi nhận nội bộ.</p>

        <div class="orders-radio-list">
          <label class="orders-radio-option">
            <input v-model="cancelDialog.reason" type="radio" value="CUSTOMER_REQUEST" />
            <span>Khách nhờ hủy</span>
          </label>
          <label class="orders-radio-option">
            <input v-model="cancelDialog.reason" type="radio" value="STAFF_MISTAKE" />
            <span>Admin/staff hủy do thao tác sai</span>
          </label>
          <label class="orders-radio-option">
            <input v-model="cancelDialog.reason" type="radio" value="OTHER" />
            <span>Lý do khác</span>
          </label>
        </div>

        <textarea
          v-if="cancelDialog.reason === 'OTHER'"
          v-model.trim="cancelDialog.otherReason"
          class="form-control orders-modal-textarea"
          rows="3"
          placeholder="Nhập lý do hủy"
        ></textarea>

        <div class="orders-modal-actions">
          <button class="btn btn-outline-dark" type="button" @click="closeCancelDialog">
            Quay lại
          </button>
          <button
            class="btn btn-outline-danger"
            type="button"
            :disabled="cancelDialog.reason === 'OTHER' && !cancelDialog.otherReason"
            @click="confirmCancelOrder"
          >
            Xác nhận hủy
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatMoney } from "../../utils/format";

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
  paymentMethod?: string | null;
  totalAmount: number;
  tableLabel?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  createdAt: string;
  arrivalAt?: string | null;
  dailyMenuId?: number | null;
  itemProgress?: {
    total: number;
    waiting: number;
    cooking: number;
    ready: number;
    cancelled: number;
  };
  customer?: {
    fullName?: string | null;
    phone?: string | null;
  } | null;
  items?: OrderItem[];
};

type DailyMenuOption = {
  id: number;
  sellingPrice: number;
  isAvailable: boolean;
  availableQuantity?: number | null;
  menuItem: {
    id: number;
    name: string;
  };
};

type DailyMenuRecord = {
  id: number;
  items: DailyMenuOption[];
};

type EditableOrderItem = {
  id?: number | null;
  key: string;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lineTotal: number;
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  E_WALLET: "Ví điện tử",
  PAY_LATER: "Trả sau",
};

const itemStatusActions = [
  { value: "WAITING", label: "Chờ" },
  { value: "COOKING", label: "Đang làm" },
  { value: "READY", label: "Lên món" },
] as const;

function getTodayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatFilterDate(value: string) {
  if (!value) {
    return "Tất cả ngày";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatOrderTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getOrderDateValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function simplifyStatus(status: string) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";
  return "CONFIRMED";
}

function cloneOrderItems(items: OrderItem[] = []) {
  return items.map((item, index) => ({
    id: item.id,
    key: `${item.dailyMenuItemId ?? item.menuItemId ?? "item"}-${index}`,
    menuItemId: item.menuItemId ?? null,
    dailyMenuItemId: item.dailyMenuItemId ?? null,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    status: item.status || "WAITING",
    lineTotal: Number(item.lineTotal || 0),
  }));
}

function normalizeDraftItems(items: Array<Pick<EditableOrderItem, "dailyMenuItemId" | "menuItemId" | "quantity">>) {
  return items.map((item) => ({
    dailyMenuItemId: item.dailyMenuItemId ?? null,
    menuItemId: item.menuItemId ?? null,
    quantity: item.quantity,
  }));
}

const orders = ref<OrderRecord[]>([]);
const dailyMenus = ref<DailyMenuRecord[]>([]);
const advancedFiltersOpen = ref(false);
const isLoading = ref(false);
const updatingOrderId = ref<number | null>(null);
const savingOrderId = ref<number | null>(null);
const errorMessage = ref("");

const filter = reactive({
  date: getTodayInputValue(),
  status: "",
  search: "",
});

const itemDrafts = reactive<Record<number, EditableOrderItem[]>>({});
const itemAddSelections = reactive<Record<number, string>>({});

const removeItemDialog = reactive({
  visible: false,
  orderId: 0,
  itemIndex: -1,
  itemName: "",
});

const completeDialog = reactive<{
  visible: boolean;
  order: OrderRecord | null;
}>({
  visible: false,
  order: null,
});

const cancelDialog = reactive<{
  visible: boolean;
  order: OrderRecord | null;
  reason: "CUSTOMER_REQUEST" | "STAFF_MISTAKE" | "OTHER";
  otherReason: string;
}>({
  visible: false,
  order: null,
  reason: "CUSTOMER_REQUEST",
  otherReason: "",
});

let searchDebounceId: number | undefined;

const totalAmount = computed(() =>
  orders.value.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
);

const statusFieldLabel = computed(() => `Trạng thái đơn (${formatFilterDate(filter.date)})`);

const scheduleBuckets = computed(() => {
  const buckets = new Map<
    string,
    {
      key: string;
      label: string;
      orderCount: number;
      guestCount: number;
      waiting: number;
      cooking: number;
      ready: number;
    }
  >();

  for (const order of orders.value) {
    const sourceDate = getOrderDateValue(order.arrivalAt || order.createdAt);
    if (!sourceDate) {
      continue;
    }

    const slotMinutes = sourceDate.getMinutes() < 30 ? "00" : "30";
    const key = `${String(sourceDate.getHours()).padStart(2, "0")}:${slotMinutes}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: key,
        orderCount: 0,
        guestCount: 0,
        waiting: 0,
        cooking: 0,
        ready: 0,
      });
    }

    const bucket = buckets.get(key)!;
    bucket.orderCount += 1;
    bucket.guestCount += Number(order.guestCount || 0);
    bucket.waiting += Number(order.itemProgress?.waiting || 0);
    bucket.cooking += Number(order.itemProgress?.cooking || 0);
    bucket.ready += Number(order.itemProgress?.ready || 0);
  }

  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
});

function getOrderStatusLabel(status: string) {
  const simpleStatus = simplifyStatus(status);
  if (simpleStatus === "CONFIRMED") return "Đang xử lý";
  if (simpleStatus === "COMPLETED") return "Hoàn tất";
  return "Hủy";
}

function getItemStatusLabel(status?: string | null) {
  if (status === "READY") return "Lên món";
  if (status === "COOKING") return "Đang làm";
  if (status === "CANCELLED") return "Đã hủy";
  return "Chờ";
}

function getSimpleStatusClass(status: string) {
  return `is-${simplifyStatus(status).toLowerCase()}`;
}

function getItemStatusClass(status?: string | null) {
  return `is-${String(status || "WAITING").toLowerCase()}`;
}

function getOrderSurfaceClass(status: string) {
  return `is-status-${simplifyStatus(status).toLowerCase()}`;
}

function getPaymentMethodLabel(method: string) {
  return paymentMethodLabels[method] || method;
}

function getCustomerName(order: OrderRecord) {
  return order.customer?.fullName || order.guestName || "Khách lẻ";
}

function getCustomerPhone(order: OrderRecord) {
  return order.guestPhone || order.customer?.phone || "Không có SĐT";
}

function getQueueTime(order: OrderRecord) {
  return formatOrderTime(order.arrivalAt || order.createdAt);
}

function getQueueLabel(order: OrderRecord) {
  return order.arrivalAt ? "Giờ hẹn" : "Tạo lúc";
}

function getProgressText(order: OrderRecord) {
  const progress = order.itemProgress;
  if (!progress?.total) {
    return "Chưa có món";
  }

  return `${progress.ready}/${progress.total} món sẵn sàng`;
}

function getProgressPercent(order: OrderRecord, key: "waiting" | "cooking" | "ready") {
  const total = Number(order.itemProgress?.total || 0);
  if (!total) {
    return 0;
  }

  return (Number(order.itemProgress?.[key] || 0) / total) * 100;
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function isAttentionOrder(order: OrderRecord) {
  return simplifyStatus(order.status) === "CONFIRMED";
}

function isBusy(order: OrderRecord) {
  return isLoading.value || updatingOrderId.value === order.id || savingOrderId.value === order.id;
}

function canEditItems(order: OrderRecord) {
  return simplifyStatus(order.status) === "CONFIRMED";
}

function canCompleteOrder(order: OrderRecord) {
  return simplifyStatus(order.status) === "CONFIRMED";
}

function canCancelOrder(order: OrderRecord) {
  return simplifyStatus(order.status) === "CONFIRMED";
}

function canUpdateItemStatus(order: OrderRecord, item: EditableOrderItem) {
  return (
    canEditItems(order) &&
    !hasDraftChanged(order) &&
    !isBusy(order) &&
    typeof item.id === "number" &&
    item.id > 0
  );
}

function isReadyToComplete(order: OrderRecord) {
  const progress = order.itemProgress;
  if (!progress?.total) {
    return false;
  }

  return progress.waiting === 0 && progress.cooking === 0;
}

function clearSearchDebounce() {
  if (typeof searchDebounceId === "number") {
    window.clearTimeout(searchDebounceId);
    searchDebounceId = undefined;
  }
}

function closeRemoveItemDialog() {
  removeItemDialog.visible = false;
  removeItemDialog.orderId = 0;
  removeItemDialog.itemIndex = -1;
  removeItemDialog.itemName = "";
}

function openRemoveItemDialog(order: OrderRecord, index: number) {
  const current = getEditableItems(order)[index];
  if (!current) {
    return;
  }

  removeItemDialog.visible = true;
  removeItemDialog.orderId = order.id;
  removeItemDialog.itemIndex = index;
  removeItemDialog.itemName = current.itemNameSnapshot;
}

function confirmRemoveItem() {
  if (!removeItemDialog.visible) {
    return;
  }

  const order = orders.value.find((item) => item.id === removeItemDialog.orderId);
  if (order) {
    removeDraftItem(order, removeItemDialog.itemIndex);
  }

  closeRemoveItemDialog();
}

function closeCompleteDialog() {
  completeDialog.visible = false;
  completeDialog.order = null;
}

function openCompleteDialog(order: OrderRecord) {
  completeDialog.visible = true;
  completeDialog.order = order;
}

async function confirmComplete(paymentMethod: string) {
  const order = completeDialog.order;
  if (!order) {
    return;
  }

  closeCompleteDialog();
  await completeOrder(order, paymentMethod);
}

function closeCancelDialog() {
  cancelDialog.visible = false;
  cancelDialog.order = null;
  cancelDialog.reason = "CUSTOMER_REQUEST";
  cancelDialog.otherReason = "";
}

function openCancelDialog(order: OrderRecord) {
  cancelDialog.visible = true;
  cancelDialog.order = order;
  cancelDialog.reason = "CUSTOMER_REQUEST";
  cancelDialog.otherReason = "";
}

function buildCancelReason() {
  if (cancelDialog.reason === "CUSTOMER_REQUEST") {
    return "Lý do hủy: Khách nhờ hủy";
  }

  if (cancelDialog.reason === "STAFF_MISTAKE") {
    return "Lý do hủy: Admin/staff thao tác sai";
  }

  return `Lý do hủy: ${cancelDialog.otherReason.trim()}`;
}

async function confirmCancelOrder() {
  const order = cancelDialog.order;
  if (!order) {
    return;
  }

  const internalNote = buildCancelReason();
  closeCancelDialog();
  await changeOrderStatus(order, "CANCELLED", { internalNote });
}

function discardDraft(orderId: number) {
  delete itemDrafts[orderId];
  delete itemAddSelections[orderId];
}

function ensureDraft(order: OrderRecord) {
  if (!itemDrafts[order.id]) {
    itemDrafts[order.id] = cloneOrderItems(order.items || []);
  }
}

function getEditableItems(order: OrderRecord) {
  return itemDrafts[order.id] || cloneOrderItems(order.items || []);
}

function hasDraftChanged(order: OrderRecord) {
  if (!itemDrafts[order.id]) {
    return false;
  }

  return (
    JSON.stringify(normalizeDraftItems(itemDrafts[order.id])) !==
    JSON.stringify(normalizeDraftItems(cloneOrderItems(order.items || [])))
  );
}

function getMenuForOrder(order: OrderRecord) {
  return dailyMenus.value.find((menu) => menu.id === order.dailyMenuId) || dailyMenus.value[0] || null;
}

function getAddableOptions(order: OrderRecord) {
  const menu = getMenuForOrder(order);
  return (menu?.items || []).filter((item) => item.isAvailable && item.menuItem);
}

function getItemAddSelection(orderId: number) {
  if (typeof itemAddSelections[orderId] !== "string") {
    itemAddSelections[orderId] = "";
  }

  return itemAddSelections[orderId];
}

function handleItemAddSelection(orderId: number, event: Event) {
  itemAddSelections[orderId] = (event.target as HTMLSelectElement)?.value || "";
}

function changeDraftQuantity(order: OrderRecord, index: number, delta: number) {
  ensureDraft(order);
  const current = itemDrafts[order.id][index];
  if (!current) {
    return;
  }

  const nextQuantity = current.quantity + delta;
  if (nextQuantity <= 0) {
    openRemoveItemDialog(order, index);
    return;
  }

  itemDrafts[order.id][index] = {
    ...current,
    quantity: nextQuantity,
    lineTotal: nextQuantity * current.unitPrice,
  };
}

function removeDraftItem(order: OrderRecord, index: number) {
  ensureDraft(order);
  itemDrafts[order.id] = itemDrafts[order.id].filter((_, currentIndex) => currentIndex !== index);
}

function addDraftItem(order: OrderRecord) {
  ensureDraft(order);
  const selectedId = Number(itemAddSelections[order.id] || 0);
  if (!selectedId) {
    return;
  }

  const option = getAddableOptions(order).find((item) => item.id === selectedId);
  if (!option) {
    return;
  }

  const draft = [...itemDrafts[order.id]];
  const existingIndex = draft.findIndex((item) => item.dailyMenuItemId === option.id);

  if (existingIndex >= 0) {
    const current = draft[existingIndex];
    draft[existingIndex] = {
      ...current,
      quantity: current.quantity + 1,
      lineTotal: (current.quantity + 1) * current.unitPrice,
    };
  } else {
    draft.push({
      id: null,
      key: `new-${option.id}`,
      menuItemId: option.menuItem.id,
      dailyMenuItemId: option.id,
      itemNameSnapshot: option.menuItem.name,
      unitPrice: option.sellingPrice,
      quantity: 1,
      status: "WAITING",
      lineTotal: option.sellingPrice,
    });
  }

  itemDrafts[order.id] = draft;
  itemAddSelections[order.id] = "";
}

function sortOrdersByQueue(a: OrderRecord, b: OrderRecord) {
  const aTime = getOrderDateValue(a.arrivalAt || a.createdAt)?.getTime() ?? 0;
  const bTime = getOrderDateValue(b.arrivalAt || b.createdAt)?.getTime() ?? 0;
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return String(a.orderNumber).localeCompare(String(b.orderNumber));
}

async function loadOrders() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const params = {
      date: filter.date || undefined,
      search: filter.search || undefined,
      scope: filter.status ? undefined : "attention",
    };

    const [ordersResponse, dailyMenusResponse] = await Promise.all([
      api.get("/orders", { params }),
      api.get("/daily-menus", {
        params: {
          date: filter.date || undefined,
        },
      }),
    ]);

    dailyMenus.value = dailyMenusResponse.data || [];

    let nextOrders = ordersResponse.data as OrderRecord[];
    if (filter.status) {
      nextOrders = nextOrders.filter((order) => simplifyStatus(order.status) === filter.status);
    } else {
      nextOrders = nextOrders.filter(isAttentionOrder);
    }

    orders.value = [...nextOrders].sort(sortOrdersByQueue);

    Object.keys(itemDrafts).forEach((key) => delete itemDrafts[Number(key)]);
    Object.keys(itemAddSelections).forEach((key) => delete itemAddSelections[Number(key)]);
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được danh sách đơn hàng.");
  } finally {
    isLoading.value = false;
  }
}

async function saveOrderItems(order: OrderRecord) {
  const draft = itemDrafts[order.id];
  if (!draft || !hasDraftChanged(order)) {
    return;
  }

  if (!draft.length) {
    errorMessage.value = "Nếu muốn bỏ hết món, hãy hủy đơn thay vì lưu đơn rỗng.";
    return;
  }

  savingOrderId.value = order.id;
  errorMessage.value = "";

  try {
    await api.put(`/orders/${order.id}`, {
      items: draft.map((item) => ({
        menuItemId: item.menuItemId ?? undefined,
        dailyMenuItemId: item.dailyMenuItemId ?? undefined,
        quantity: item.quantity,
      })),
    });
    discardDraft(order.id);
    await loadOrders();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không lưu được thay đổi món.");
  } finally {
    savingOrderId.value = null;
  }
}

async function changeOrderStatus(
  order: OrderRecord,
  status: string,
  extraData: Record<string, unknown> = {}
) {
  updatingOrderId.value = order.id;
  errorMessage.value = "";

  try {
    await api.put(`/orders/${order.id}/status`, { status, ...extraData });
    discardDraft(order.id);
    await loadOrders();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không cập nhật được trạng thái đơn hàng.");
  } finally {
    updatingOrderId.value = null;
  }
}

async function completeOrder(order: OrderRecord, paymentMethod: string) {
  await changeOrderStatus(order, "COMPLETED", {
    paymentMethod,
    paymentStatus: "PAID",
  });
}

async function updateItemStatus(order: OrderRecord, item: EditableOrderItem, status: string) {
  if (!canUpdateItemStatus(order, item) || !item.id) {
    return;
  }

  updatingOrderId.value = order.id;
  errorMessage.value = "";

  try {
    const { data } = await api.put(`/orders/${order.id}/items/${item.id}/status`, { status });
    const nextOrder = data as OrderRecord;
    orders.value = orders.value
      .map((entry) => (entry.id === order.id ? nextOrder : entry))
      .sort(sortOrdersByQueue);
    discardDraft(order.id);
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không cập nhật được trạng thái món.");
  } finally {
    updatingOrderId.value = null;
  }
}

function scheduleSearch() {
  clearSearchDebounce();
  searchDebounceId = window.setTimeout(() => {
    void loadOrders();
  }, 300);
}

function handleImmediateFilterChange() {
  clearSearchDebounce();
  void loadOrders();
}

onMounted(() => {
  void loadOrders();
});

onBeforeUnmount(() => {
  clearSearchDebounce();
});
</script>

<style scoped>
.orders-page {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.orders-toolbar,
.orders-surface {
  background: rgba(255, 253, 249, 0.94);
  border: 1px solid rgba(230, 209, 192, 0.9);
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.orders-toolbar {
  overflow: hidden;
  display: grid;
}

.orders-toolbar-body {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.orders-toolbar-main {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 14px 16px;
  align-items: end;
}

.orders-toolbar-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.orders-toolbar-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.orders-advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
}

.orders-toolbar-chevron {
  color: var(--muted);
  font-size: 0.95rem;
}

.orders-meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  color: var(--ember-strong);
  font-size: 0.83rem;
  font-weight: 800;
}

.orders-field-inline {
  max-width: 260px;
}

.orders-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.orders-field-label {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.orders-search-control {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1px solid rgba(35, 19, 15, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
}

.orders-search-control i {
  color: var(--muted);
  font-size: 0.95rem;
}

.orders-search-input,
.orders-select {
  min-height: 46px;
  border-radius: 16px;
  border-color: rgba(35, 19, 15, 0.12);
  box-shadow: none;
}

.orders-search-input {
  border: none;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}

.orders-search-input:focus {
  box-shadow: none;
}

.orders-advanced {
  display: grid;
  gap: 10px;
  padding-top: 2px;
}

.orders-advanced-body {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(220px, 0.8fr);
  gap: 14px;
  padding: 0;
}

.orders-feedback {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(230, 209, 192, 0.9);
  background: rgba(255, 253, 249, 0.96);
  color: var(--text);
}

.orders-feedback.is-error {
  border-color: rgba(143, 47, 21, 0.18);
  background: rgba(255, 244, 241, 0.96);
  color: var(--ember-strong);
}

.orders-schedule-strip {
  display: flex;
  gap: 10px;
  padding: 0 20px 16px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(230, 209, 192, 0.85);
}

.orders-schedule-chip {
  min-width: 150px;
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(230, 209, 192, 0.9);
  color: var(--muted);
  font-size: 0.82rem;
}

.orders-schedule-chip strong {
  color: var(--text);
  font-size: 0.88rem;
}

.orders-surface {
  overflow: hidden;
}

.orders-surface-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(230, 209, 192, 0.9);
}

.orders-surface-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
}

.orders-surface-note {
  margin: 6px 0 0;
  color: var(--muted);
}

.orders-surface-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  white-space: nowrap;
}

.orders-summary-count,
.orders-summary-total {
  font-weight: 800;
}

.orders-summary-total {
  color: var(--ember-strong);
}

.orders-state {
  padding: 40px 20px;
  text-align: center;
}

.orders-state-title {
  margin-bottom: 6px;
  font-size: 1rem;
  font-weight: 800;
}

.orders-state p {
  margin: 0;
  color: var(--muted);
}

.orders-list {
  display: grid;
}

.order-card {
  --order-status-surface: rgba(255, 253, 249, 0.96);
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border-top: 1px solid rgba(230, 209, 192, 0.9);
  background: var(--order-status-surface);
}

.order-card:first-child {
  border-top: none;
}

.order-card.is-status-pending {
  --order-status-surface: rgba(203, 165, 81, 0.12);
}

.order-card.is-status-confirmed {
  --order-status-surface: rgba(201, 126, 71, 0.1);
}

.order-card.is-status-completed {
  --order-status-surface: rgba(66, 133, 104, 0.11);
}

.order-card.is-status-cancelled {
  --order-status-surface: rgba(148, 88, 88, 0.1);
}

.order-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-head-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.order-head-side {
  flex-shrink: 0;
  text-align: right;
}

.order-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.order-number {
  font-weight: 800;
}

.order-time {
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--muted);
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
}

.order-contact-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.order-customer-name {
  font-weight: 700;
}

.order-customer-phone,
.order-table {
  color: var(--muted);
  font-size: 0.9rem;
}

.order-arrival-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  color: var(--ember-strong);
  font-size: 0.8rem;
  font-weight: 700;
}

.order-total {
  font-weight: 800;
  color: var(--ember-strong);
}

.order-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.order-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.order-pill.is-pending {
  background: rgba(203, 165, 81, 0.18);
  color: #8b6517;
}

.order-pill.is-confirmed {
  background: rgba(201, 126, 71, 0.16);
  color: #8a451f;
}

.order-pill.is-completed {
  background: rgba(66, 133, 104, 0.15);
  color: var(--green);
}

.order-pill.is-cancelled {
  background: rgba(148, 88, 88, 0.14);
  color: #8f2f15;
}

.order-pill.is-unpaid {
  background: rgba(201, 87, 43, 0.12);
  color: var(--ember-strong);
}

.order-pill.is-partial {
  background: rgba(185, 139, 47, 0.16);
  color: #8b6517;
}

.order-pill.is-paid {
  background: rgba(34, 105, 85, 0.14);
  color: var(--green);
}

.order-pill.is-refunded {
  background: rgba(35, 19, 15, 0.08);
  color: var(--text);
}

.order-pill.is-muted {
  background: rgba(35, 19, 15, 0.06);
  color: var(--muted);
}

.order-progress {
  display: grid;
  gap: 8px;
}

.order-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-progress-track {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(35, 19, 15, 0.08);
}

.order-progress-segment {
  height: 100%;
}

.order-progress-segment.is-waiting {
  background: rgba(203, 165, 81, 0.7);
}

.order-progress-segment.is-cooking {
  background: rgba(201, 126, 71, 0.7);
}

.order-progress-segment.is-ready {
  background: rgba(66, 133, 104, 0.78);
}

.order-progress-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--muted);
  font-size: 0.82rem;
}

.order-item-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid rgba(230, 209, 192, 0.72);
}

.order-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(230, 209, 192, 0.72);
}

.order-item-row:last-child {
  border-bottom: none;
}

.order-item-row.is-empty {
  justify-content: flex-start;
}

.order-item-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
}

.order-item-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.order-item-name {
  font-weight: 600;
}

.order-item-meta {
  color: var(--muted);
  font-size: 0.84rem;
}

.order-item-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.order-item-status {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(35, 19, 15, 0.06);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.order-item-status.is-waiting {
  background: rgba(203, 165, 81, 0.12);
  color: #8b6517;
}

.order-item-status.is-cooking {
  background: rgba(201, 126, 71, 0.13);
  color: #8a451f;
}

.order-item-status.is-ready {
  background: rgba(66, 133, 104, 0.14);
  color: var(--green);
}

.order-item-status.is-cancelled {
  background: rgba(148, 88, 88, 0.14);
  color: #8f2f15;
}

.order-item-status.is-active {
  border-color: currentColor;
}

.order-item-total {
  font-weight: 800;
  color: var(--ember-strong);
  white-space: nowrap;
  text-align: right;
}

.order-item-editor {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  justify-content: flex-end;
}

.order-item-qty {
  min-width: 40px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
  text-align: center;
  font-weight: 800;
  line-height: 38px;
  font-variant-numeric: tabular-nums;
}

.order-qty-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(35, 19, 15, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(243, 234, 226, 0.94));
  box-shadow:
    0 10px 18px rgba(35, 19, 15, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  color: var(--text);
}

.order-qty-btn:hover {
  transform: translateY(-1px);
}

.order-qty-btn:active {
  transform: translateY(1px);
  box-shadow:
    0 5px 10px rgba(35, 19, 15, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.order-editor-panel {
  display: grid;
  gap: 12px;
}

.order-add-row,
.order-editor-actions,
.order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.order-add-row {
  display: grid;
  gap: 10px;
}

.order-add-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.order-add-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.order-add-hint {
  color: var(--muted);
  font-size: 0.85rem;
}

.order-add-btn {
  width: 46px;
  min-width: 46px;
  height: 46px;
  padding: 0;
  border-radius: 16px;
  font-size: 1.2rem;
  line-height: 1;
}

.order-item-qty-read {
  min-width: 40px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  flex: 0 0 auto;
  text-align: center;
  font-weight: 800;
  line-height: 38px;
  font-variant-numeric: tabular-nums;
}

.order-editor-note {
  width: 100%;
  color: var(--muted);
  font-size: 0.85rem;
}

.orders-modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(35, 19, 15, 0.38);
  backdrop-filter: blur(3px);
  z-index: 1200;
}

.orders-modal {
  width: min(100%, 440px);
  position: relative;
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(230, 209, 192, 0.9);
  background: rgba(255, 253, 249, 0.98);
  box-shadow: 0 24px 48px rgba(35, 19, 15, 0.24);
}

.orders-modal-title {
  font-size: 1.05rem;
  font-weight: 800;
  padding-right: 36px;
}

.orders-modal-text {
  margin: 0;
  color: var(--muted);
}

.orders-modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: rgba(35, 19, 15, 0.06);
  color: var(--muted);
}

.orders-modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.orders-radio-list {
  display: grid;
  gap: 10px;
}

.orders-radio-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(230, 209, 192, 0.9);
  background: rgba(255, 255, 255, 0.72);
}

.orders-radio-option input {
  margin-top: 3px;
}

.orders-modal-textarea {
  min-height: 96px;
  border-radius: 16px;
  border-color: rgba(35, 19, 15, 0.12);
  box-shadow: none;
}

@media (max-width: 1199px) {
  .orders-advanced-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .orders-page {
    gap: 0;
    margin: -24px;
  }

  .orders-toolbar,
  .orders-surface,
  .orders-feedback {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    box-shadow: none;
  }

  .orders-toolbar {
    border-top: 0;
  }

  .orders-toolbar-body {
    gap: 12px;
    padding: 14px 16px 16px;
  }

  .orders-toolbar-main {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .orders-toolbar-side,
  .orders-field-inline {
    max-width: none;
  }

  .orders-toolbar-side {
    justify-content: space-between;
  }

  .orders-field-inline {
    max-width: none;
  }

  .orders-toolbar-summary {
    justify-content: flex-start;
  }

  .orders-advanced-toggle {
    width: 100%;
    justify-content: space-between;
  }

  .orders-advanced-body {
    padding: 0;
  }

  .orders-feedback {
    border-top: 0;
    margin-top: 0;
  }

  .orders-schedule-strip {
    padding: 0 16px 14px;
    border-top: 1px solid rgba(230, 209, 192, 0.9);
    border-bottom: 1px solid rgba(230, 209, 192, 0.9);
    background: rgba(255, 253, 249, 0.96);
  }

  .orders-surface {
    border-top: 0;
    background: transparent;
  }

  .orders-surface-header {
    display: none;
  }

  .orders-state {
    padding: 28px 16px;
    background: rgba(255, 253, 249, 0.96);
    border-top: 1px solid rgba(230, 209, 192, 0.9);
    border-bottom: 1px solid rgba(230, 209, 192, 0.9);
  }

  .order-card {
    padding: 16px;
  }

  .order-card-head {
    gap: 12px;
  }

  .order-head-side {
    min-width: 96px;
  }

  .order-progress-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .order-item-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
  }

  .order-item-main {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .order-item-total {
    text-align: left;
  }

  .order-item-editor {
    width: auto;
    align-self: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .order-qty-btn,
  .order-item-qty,
  .order-item-qty-read {
    min-width: 36px;
    height: 36px;
    line-height: 36px;
  }

  .order-add-control {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .orders-modal {
    padding: 18px;
  }
}
</style>
