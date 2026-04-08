<template>
  <div class="orders-page">
    <section class="orders-toolbar">
      <div class="orders-toolbar-body">
        <div class="orders-toolbar-head">
          <span class="orders-field-label">{{ statusFieldLabel }}</span>
          <div class="orders-toolbar-head-actions">
            <button
              class="orders-toolbar-add-btn"
              type="button"
              :disabled="!manualMenu || createOrderSubmitting"
              aria-label="Thêm đơn thủ công"
              title="Thêm đơn thủ công"
              @click="openCreateOrderDialog"
            >
              <i class="bi bi-clipboard-plus orders-toolbar-add-icon"></i>
            </button>

            <button
              class="orders-toolbar-collapse"
              type="button"
              :aria-expanded="advancedFiltersOpen ? 'true' : 'false'"
              :aria-label="advancedFiltersOpen ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'"
              :title="advancedFiltersOpen ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'"
              @click="advancedFiltersOpen = !advancedFiltersOpen"
            >
              <i
                :class="['bi', advancedFiltersOpen ? 'bi-chevron-up' : 'bi-chevron-down', 'orders-toolbar-chevron']"
              ></i>
            </button>
          </div>
        </div>

        <div class="orders-toolbar-main">
          <div class="orders-status-tabs" role="tablist" aria-label="Lọc trạng thái đơn">
            <button
              v-for="tab in statusTabs"
              :key="tab.value"
              type="button"
              :class="['orders-status-tab', { 'is-active': filter.status === tab.value }]"
              :aria-pressed="filter.status === tab.value ? 'true' : 'false'"
              :disabled="isLoading"
              @click="filter.status = tab.value; handleImmediateFilterChange()"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="orders-toolbar-side">
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
              <div class="orders-date-wrap">
                <i class="bi bi-calendar3 orders-date-icon"></i>
                <input
                  v-model="filter.date"
                  class="form-control orders-select orders-date-input"
                  type="date"
                  :disabled="isLoading"
                  @change="handleImmediateFilterChange"
                />
              </div>
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

      <div v-if="scheduleBuckets.length" class="orders-schedule-wrap">
        <button v-if="scheduleBuckets.length > 2" class="orders-schedule-nav" type="button" aria-label="Cuộn trái" @click="scrollSchedule(-1)">‹</button>
        <div ref="scheduleStripRef" class="orders-schedule-strip">
          <div v-for="bucket in scheduleBuckets" :key="bucket.key" class="orders-schedule-chip">
            <strong>{{ bucket.label }}</strong>
            <span>{{ bucket.orderCount }} đơn</span>
            <span>{{ bucket.guestCount }} khách</span>
            <span>{{ bucket.waiting + bucket.cooking }} món đang chạy</span>
          </div>
        </div>
        <button v-if="scheduleBuckets.length > 2" class="orders-schedule-nav" type="button" aria-label="Cuộn phải" @click="scrollSchedule(1)">›</button>
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
        <OrderCard
          v-for="order in orders"
          :key="order.id"
          :order="order"
          :menu-options="getAddableOptions(order)"
          :stock-remaining-map="stockRemainingMap"
          :busy="isBusy(order)"
          :is-saving="savingOrderId === order.id"
          :flash-cancelled-item-id="cancelledItemFlashMap[order.id] ?? null"
          :pending-item-status-id="updatingItemStatusOrderId === order.id ? updatingItemStatusId : null"
          :pending-item-status-value="updatingItemStatusOrderId === order.id ? updatingItemStatusValue : null"
          @confirm="changeOrderStatus(order, 'CONFIRMED')"
          @open-complete="openCompleteDialog(order)"
          @open-cancel="openCancelDialog(order)"
          @delete-order="deleteOrder(order)"
          @save-items="(items, arrivalTime, guestCount) => saveOrderItems(order, items, arrivalTime, guestCount)"
          @move-item-stage="(payload) => updateItemStage(order, payload)"
        />

      </div>
    </section>

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
            <input v-model="cancelDialog.reason" type="radio" value="SPAM" />
            <span>Đơn Spam/Rác</span>
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

    <Teleport to="body">
      <div
        v-if="createOrderDialog.visible"
        class="orders-modal-backdrop orders-modal-backdrop--fullscreen"
        role="dialog"
        aria-modal="true"
        @click.self="closeCreateOrderDialog"
      >
        <div class="orders-modal orders-create-modal">
          <div class="orders-create-modal-header">
            <div class="orders-modal-title">Thêm đơn thủ công</div>
            <button
              class="orders-modal-close orders-create-close"
              type="button"
              aria-label="Đóng"
              @click="closeCreateOrderDialog"
            >
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <div class="orders-create-modal-body">
            <QuickOrderComposer
              title="Tạo đơn mới"
              :lines="createOrderDialog.lines"
              :arrival-time="createOrderDialog.arrivalTime"
              :arrival-mode="createOrderDialog.arrivalMode"
              :note="createOrderDialog.note"
              :menu-options="manualMenuOptions"
              :stock-remaining-map="stockRemainingMap"
              :disabled="createOrderSubmitting || !manualMenu"
              :submit-disabled="createOrderSubmitting || !canSubmitCreateOrder"
              :submitting="createOrderSubmitting"
              submit-label="Tạo đơn"
              submitting-label="Đang tạo đơn..."
              empty-title="Chưa có món trong đơn"
              empty-description="Chọn món từ danh sách bên dưới để bắt đầu tạo đơn."
              empty-menu-hint="Chưa có menu cho ngày đang lọc."
              @change-qty="handleCreateOrderLineChange"
              @update-line-note="updateCreateOrderLineNote"
              @remove-line="removeCreateOrderLine"
              @update:arrival-time="createOrderDialog.arrivalTime = $event"
              @update:arrival-mode="createOrderDialog.arrivalMode = $event"
              @update:note="createOrderDialog.note = $event"
              @select-item="addItemDirect"
              @submit="submitCreateOrder"
            >
              <template #before-picker>
                <div class="orders-create-guest">
                  <div class="orders-create-name">
                    <input
                      v-model.trim="createOrderDialog.guestName"
                      class="form-control orders-select"
                      type="text"
                      placeholder="Tên khách (ví dụ: Chị Lan)"
                    />
                    <div class="orders-name-chips">
                      <button
                        v-for="name in GUEST_NAME_CHIPS"
                        :key="name"
                        type="button"
                        :class="['orders-name-chip', { 'is-active': createOrderDialog.guestName === name }]"
                        @click="createOrderDialog.guestName = createOrderDialog.guestName === name ? '' : name"
                      >{{ name }}</button>
                    </div>
                  </div>
                  <div class="orders-create-grid">
                    <input
                      v-model.trim="createOrderDialog.guestPhone"
                      class="form-control orders-select"
                      type="tel"
                      placeholder="Số ĐT (tuỳ chọn)"
                    />
                    <input
                      v-model.trim="createOrderDialog.guestCount"
                      class="form-control orders-select"
                      type="number"
                      min="1"
                      inputmode="numeric"
                      placeholder="1 người"
                    />
                  </div>
                </div>
              </template>
            </QuickOrderComposer>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { socket } from "../../socket";
import QuickOrderComposer from "../../components/common/QuickOrderComposer.vue";
import OrderCard from "../../components/admin/OrderCard.vue";
import { formatMoney } from "../../utils/format";


type OrderItem = {
  id: number;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  activeQuantity?: number;
  waitingQuantity?: number;
  cookingQuantity?: number;
  readyQuantity?: number;
  cancelledQuantity?: number;
  status: string;
  lineTotal: number;
  activeLineTotal?: number;
  note?: string | null;
};

type OrderRecord = {
  id: number;
  orderNumber: string;
  source?: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  subtotal?: number;
  serviceFee?: number;
  discountAmount?: number;
  totalAmount: number;
  tableLabel?: string | null;
  guestCount?: number | null;
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

type OrderChangeEvent = {
  type: "CUSTOMER_UPDATED" | "CUSTOMER_CANCELLED" | "CUSTOMER_ITEM_CANCELLED";
  order: OrderRecord;
  changedFields?: Array<"items" | "arrivalAt">;
  itemId?: number;
  itemName?: string;
  quantity?: number;
  orderCancelled?: boolean;
  occurredAt: string;
};

type MoveItemStagePayload = {
  itemId: number;
  action: "MOVE_STAGE";
  fromStage: "WAITING" | "COOKING" | "READY" | "CANCELLED";
  toStage: "WAITING" | "COOKING" | "READY";
  quantity: number;
};

type UpdateOrderItemStageResponse = {
  success?: boolean;
  id?: number;
  status?: string;
  quantity?: number;
  waitingQuantity?: number;
  cookingQuantity?: number;
  readyQuantity?: number;
  cancelledQuantity?: number;
  subtotal?: number;
  totalAmount?: number;
  itemProgress?: {
    total: number;
    waiting: number;
    cooking: number;
    ready: number;
    cancelled: number;
  };
};

type DailyMenuOption = {
  id: number;
  dailyMenuItemId?: number | null;
  menuItemId?: number | null;
  sellingPrice: number;
  isAvailable: boolean;
  availableQuantity?: number | null;
  stockLinks?: Array<{
    stockPool?: {
      id?: number;
      label?: string | null;
      remainingQuantity?: number;
    } | null;
  }>;
  menuItem: {
    id: number;
    name: string;
    category?: { name: string } | null;
  };
};

type DailyMenuRecord = {
  id: number;
  items: DailyMenuOption[];
};

type ManualOrderLine = {
  key: string;
  dailyMenuItemId?: number;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

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

function buildArrivalAt(serviceDate?: string, time?: string) {
  if (!serviceDate || !time) {
    return undefined;
  }

  return `${serviceDate.slice(0, 10)}T${time}`;
}

function getOrderDateValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const orders = ref<OrderRecord[]>([]);
const dailyMenus = ref<DailyMenuRecord[]>([]);
const advancedFiltersOpen = ref(false);
const isLoading = ref(false);
const updatingOrderId = ref<number | null>(null);
const updatingItemStatusOrderId = ref<number | null>(null);
const updatingItemStatusId = ref<number | null>(null);
const updatingItemStatusValue = ref<string | null>(null);
const savingOrderId = ref<number | null>(null);
const errorMessage = ref("");
const scheduleStripRef = ref<HTMLElement | null>(null);
const cancelledItemFlashMap = reactive<Record<number, number | null>>({});
const cancelledItemFlashTimers = new Map<number, number>();

function scrollSchedule(dir: -1 | 1) {
  scheduleStripRef.value?.scrollBy({ left: dir * 180, behavior: "smooth" });
}

function flashCancelledItem(orderId: number, itemId: number) {
  const existingTimer = cancelledItemFlashTimers.get(orderId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  cancelledItemFlashMap[orderId] = itemId;
  const timerId = window.setTimeout(() => {
    if (cancelledItemFlashMap[orderId] === itemId) {
      delete cancelledItemFlashMap[orderId];
    }
    cancelledItemFlashTimers.delete(orderId);
  }, 4200);
  cancelledItemFlashTimers.set(orderId, timerId);
}

const filter = reactive({
  date: getTodayInputValue(),
  status: "PENDING",
  search: "",
});

const manualMenu = computed(() => dailyMenus.value[0] || null);
const manualMenuOptions = computed(() =>
  (manualMenu.value?.items || []).filter((item) => item.isAvailable && item.menuItem)
);
const canSubmitCreateOrder = computed(
  () => Boolean(
    manualMenu.value &&
    createOrderDialog.lines.length &&
    createOrderDialog.guestName.trim()
  )
);


function normalizeDraftLineNote(value?: string | null) {
  return String(value || "").trim();
}

const createOrderDraftKeySeed = ref(0);

function buildCreateOrderDraftKey(seed: number) {
  createOrderDraftKeySeed.value += 1;
  return `manual-${seed}-${createOrderDraftKeySeed.value}`;
}

function getOptionMenuItemId(option: DailyMenuOption) {
  return Number(option.menuItemId ?? option.menuItem?.id ?? 0);
}

function getOptionOfferKey(option: DailyMenuOption) {
  const dailyMenuItemId = Number(option.dailyMenuItemId ?? 0);
  if (dailyMenuItemId > 0) {
    return `offer:${dailyMenuItemId}`;
  }
  return `menu:${getOptionMenuItemId(option)}`;
}

function addItemDirect(option: DailyMenuOption) {
  const existing = createOrderDialog.lines.find(
    (line) =>
      line.dailyMenuItemId === (option.dailyMenuItemId ?? undefined) &&
      line.menuItemId === getOptionMenuItemId(option) &&
      normalizeDraftLineNote(line.note) === ""
  );
  if (existing) {
    existing.quantity += 1;
  } else {
    createOrderDialog.lines.push({
      key: `${getOptionOfferKey(option)}:${buildCreateOrderDraftKey(getOptionMenuItemId(option))}`,
      dailyMenuItemId: option.dailyMenuItemId ?? undefined,
      menuItemId: getOptionMenuItemId(option),
      name: option.menuItem.name,
      price: Number(option.sellingPrice || 0),
      quantity: 1,
      note: "",
    });
  }
}

// poolId → remainingQuantity, updated from API load + socket events
const stockRemainingMap = reactive<Record<number, number>>({});

const completeDialog = reactive<{
  visible: boolean;
  order: OrderRecord | null;
}>({
  visible: false,
  order: null,
});

const GUEST_NAME_CHIPS = ["Khách bàn 1", "Khách bàn 2", "Khách bàn 3", "Khách đem về"];

const createOrderDialog = reactive<{
  visible: boolean;
  guestName: string;
  guestPhone: string;
  guestCount: string;
  arrivalTime: string;
  arrivalMode: "scheduled" | "unknown" | "arrived";
  note: string;
  selectedItemId: string;
  lines: ManualOrderLine[];
}>({
  visible: false,
  guestName: "",
  guestPhone: "",
  guestCount: "",
  arrivalTime: "",
  arrivalMode: "unknown",
  note: "",
  selectedItemId: "",
  lines: [],
});

const createOrderSubmitting = ref(false);

const cancelDialog = reactive<{
  visible: boolean;
  order: OrderRecord | null;
  reason: "CUSTOMER_REQUEST" | "STAFF_MISTAKE" | "SPAM" | "OTHER";
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
const statusTabs = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đang xử lý" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

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

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function alertApiError(error: any, fallback: string) {
  alert(getErrorMessage(error, fallback));
}

function isBusy(order: OrderRecord) {
  return isLoading.value || updatingOrderId.value === order.id || savingOrderId.value === order.id;
}

function clearSearchDebounce() {
  if (typeof searchDebounceId === "number") {
    window.clearTimeout(searchDebounceId);
    searchDebounceId = undefined;
  }
}

function closeCompleteDialog() {
  completeDialog.visible = false;
  completeDialog.order = null;
}

function resetCreateOrderDialog() {
  createOrderDialog.guestName = "";
  createOrderDialog.guestPhone = "";
  createOrderDialog.guestCount = "";
  createOrderDialog.arrivalTime = "";
  createOrderDialog.arrivalMode = "unknown";
  createOrderDialog.note = "";
  createOrderDialog.selectedItemId = "";
  createOrderDialog.lines = [];
  createOrderDraftKeySeed.value = 0;
}

function closeCreateOrderDialog() {
  createOrderDialog.visible = false;
  resetCreateOrderDialog();
}

function openCreateOrderDialog() {
  if (!manualMenu.value) {
    errorMessage.value = "Chưa có menu cho ngày đang lọc để tạo đơn thủ công.";
    return;
  }

  errorMessage.value = "";
  resetCreateOrderDialog();
  createOrderDialog.visible = true;
}


function handleCreateOrderLineChange(payload: { key: string | number; delta: number }) {
  const line = createOrderDialog.lines.find((entry) => entry.key === String(payload.key));
  if (!line) {
    return;
  }

  const nextQuantity = line.quantity + payload.delta;
  if (nextQuantity <= 0) {
    createOrderDialog.lines = createOrderDialog.lines.filter((entry) => entry.key !== line.key);
    return;
  }

  line.quantity = nextQuantity;
}

function updateCreateOrderLineNote(payload: { key: string | number; note: string }) {
  const line = createOrderDialog.lines.find((entry) => entry.key === String(payload.key));
  if (!line) {
    return;
  }

  line.note = payload.note;
}

function removeCreateOrderLine(key: string | number) {
  createOrderDialog.lines = createOrderDialog.lines.filter((entry) => entry.key !== String(key));
}

function parseGuestCount(value: string) {
  const next = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

function getCreateOrderGuestCount() {
  return parseGuestCount(createOrderDialog.guestCount) || 1;
}

async function submitCreateOrder() {
  if (!manualMenu.value || !canSubmitCreateOrder.value) {
    return;
  }

  createOrderSubmitting.value = true;
  errorMessage.value = "";

  try {
    await api.post("/orders", {
      dailyMenuId: manualMenu.value.id,
      guestName: createOrderDialog.guestName.trim(),
      guestPhone: createOrderDialog.guestPhone.trim() || undefined,
      guestCount: getCreateOrderGuestCount(),
      arrivalAt: createOrderDialog.arrivalMode === "scheduled"
        ? buildArrivalAt(filter.date, createOrderDialog.arrivalTime)
        : createOrderDialog.arrivalMode === "arrived"
          ? new Date().toISOString()
          : undefined,
      note: createOrderDialog.note.trim() || undefined,
      items: createOrderDialog.lines.map((line) => ({
        dailyMenuItemId: line.dailyMenuItemId,
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        note: line.note?.trim() || undefined,
      })),
    });

    closeCreateOrderDialog();
    await loadOrders();
  } catch (error) {
    alertApiError(error, "Không tạo được đơn thủ công.");
  } finally {
    createOrderSubmitting.value = false;
  }
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

  if (cancelDialog.reason === "SPAM") {
    return "Lý do hủy: Đơn Spam/Rác";
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

function getMenuForOrder(order: OrderRecord) {
  return dailyMenus.value.find((menu) => menu.id === order.dailyMenuId) || dailyMenus.value[0] || null;
}

function getAddableOptions(order: OrderRecord) {
  const menu = getMenuForOrder(order);
  return (menu?.items || []).filter((item) => item.isAvailable && item.menuItem);
}


function syncStockFromMenus(menus: DailyMenuRecord[]) {
  for (const menu of menus) {
    for (const item of menu.items || []) {
      for (const link of item.stockLinks || []) {
        const pool = link.stockPool;
        if (pool?.id != null && pool.remainingQuantity != null) {
          stockRemainingMap[pool.id] = pool.remainingQuantity;
        }
      }
    }
  }
}

function handleStockUpdate(pools: Array<{ id: number; remainingQuantity: number }>) {
  for (const pool of pools) {
    stockRemainingMap[pool.id] = pool.remainingQuantity;
  }
}

function orderMatchesCurrentFilter(order: OrderRecord): boolean {
  if (filter.date) {
    const orderDate = new Date(order.createdAt);
    const localDate = new Date(orderDate.getTime() - orderDate.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    if (localDate !== filter.date) return false;
  }
  if (filter.status && order.status !== filter.status) return false;
  if (filter.search.trim()) return false;
  return true;
}

function handleNewOrder(order: OrderRecord) {
  if (order.source !== "CUSTOMER_APP") return;
  if (!orderMatchesCurrentFilter(order)) return;
  if (orders.value.some((o) => o.id === order.id)) return;
  orders.value = [order, ...orders.value];
}

function handleOrderChanged(event: OrderChangeEvent) {
  if (event.order.source !== "CUSTOMER_APP") return;
  if (event.type === "CUSTOMER_ITEM_CANCELLED" && typeof event.itemId === "number") {
    flashCancelledItem(event.order.id, event.itemId);
  }
  void loadOrders();
}

function sortOrdersByQueue(a: OrderRecord, b: OrderRecord) {
  const aTime = getOrderDateValue(a.arrivalAt || a.createdAt)?.getTime() ?? 0;
  const bTime = getOrderDateValue(b.arrivalAt || b.createdAt)?.getTime() ?? 0;
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return String(a.orderNumber).localeCompare(String(b.orderNumber));
}

function replaceOrderLocally(nextOrder: OrderRecord) {
  const index = orders.value.findIndex((entry) => entry.id === nextOrder.id);
  if (index >= 0) {
    orders.value[index] = nextOrder;
    orders.value = [...orders.value].sort(sortOrdersByQueue);
    return;
  }

  if (orderMatchesCurrentFilter(nextOrder)) {
    orders.value = [...orders.value, nextOrder].sort(sortOrdersByQueue);
  }
}

async function refreshOrderById(orderId: number) {
  const { data } = await api.get(`/orders/${orderId}`);
  replaceOrderLocally(data as OrderRecord);
}

async function loadOrders() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const params = {
      date: filter.date || undefined,
      search: filter.search || undefined,
      status: filter.status || undefined,
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
    syncStockFromMenus(dailyMenus.value);

    const nextOrders = ordersResponse.data as OrderRecord[];
    orders.value = [...nextOrders].sort(sortOrdersByQueue);
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được danh sách đơn hàng.");
  } finally {
    isLoading.value = false;
  }
}

async function saveOrderItems(
  order: OrderRecord,
  items: Array<{ dailyMenuItemId?: number; menuItemId?: number; quantity: number; note?: string }>,
  arrivalTime: string | null,
  guestCount?: number | null
) {
  if (!items.length) {
    errorMessage.value = "Nếu muốn bỏ hết món, hãy hủy đơn thay vì lưu đơn rỗng.";
    return;
  }

  savingOrderId.value = order.id;
  errorMessage.value = "";

  const arrivalAt = arrivalTime === "ARRIVED"
    ? new Date().toISOString()
    : arrivalTime
      ? buildArrivalAt(filter.date, arrivalTime)
      : undefined;

  try {
    await api.put(`/orders/${order.id}`, {
      items,
      ...(arrivalAt ? { arrivalAt } : {}),
      ...(guestCount != null ? { guestCount } : {}),
    });
    await refreshOrderById(order.id);
  } catch (error) {
    alertApiError(error, "Không lưu được thay đổi món.");
  } finally {
    savingOrderId.value = null;
  }
}

async function deleteOrder(order: OrderRecord) {
  if (!confirm(`Xóa vĩnh viễn đơn ${order.orderNumber}? Không thể hoàn tác.`)) return;
  updatingOrderId.value = order.id;
  try {
    await api.delete(`/orders/${order.id}`);
    orders.value = orders.value.filter((o) => o.id !== order.id);
  } catch (error) {
    alertApiError(error, "Không xóa được đơn hàng.");
  } finally {
    updatingOrderId.value = null;
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
    await loadOrders();
  } catch (error) {
    alertApiError(error, "Không cập nhật được trạng thái đơn hàng.");
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

function patchOrderItemStageLocally(orderId: number, payload: UpdateOrderItemStageResponse) {
  const targetOrder = orders.value.find((entry) => entry.id === orderId);
  const targetItem = targetOrder?.items?.find((entry) => entry.id === payload.id);
  if (!targetOrder || !targetItem) return;

  targetItem.status = String(payload.status || targetItem.status || "WAITING");
  targetItem.quantity = Number(payload.quantity ?? targetItem.quantity ?? 0);
  targetItem.waitingQuantity = Number(payload.waitingQuantity ?? targetItem.waitingQuantity ?? 0);
  targetItem.cookingQuantity = Number(payload.cookingQuantity ?? targetItem.cookingQuantity ?? 0);
  targetItem.readyQuantity = Number(payload.readyQuantity ?? targetItem.readyQuantity ?? 0);
  targetItem.cancelledQuantity = Number(payload.cancelledQuantity ?? targetItem.cancelledQuantity ?? 0);
  targetItem.activeQuantity =
    Number(targetItem.waitingQuantity || 0) +
    Number(targetItem.cookingQuantity || 0) +
    Number(targetItem.readyQuantity || 0);
  targetItem.activeLineTotal =
    Number(targetItem.unitPrice || 0) * Number(targetItem.activeQuantity || 0);

  targetOrder.subtotal = Number(payload.subtotal ?? targetOrder.subtotal ?? 0);
  targetOrder.totalAmount = Number(payload.totalAmount ?? targetOrder.totalAmount ?? 0);
  if (payload.itemProgress) {
    targetOrder.itemProgress = payload.itemProgress;
  }
}

async function updateItemStage(order: OrderRecord, payload: MoveItemStagePayload) {
  errorMessage.value = "";
  updatingItemStatusOrderId.value = order.id;
  updatingItemStatusId.value = payload.itemId;
  updatingItemStatusValue.value = `${payload.fromStage}->${payload.toStage}`;

  try {
    const { itemId, ...body } = payload;
    const { data } = await api.put(`/orders/${order.id}/items/${itemId}/status`, body);
    const nextState = data as UpdateOrderItemStageResponse;
    if (nextState.success && typeof nextState.id === "number") {
      patchOrderItemStageLocally(order.id, nextState);
    }
  } catch (error) {
    alertApiError(error, "KhÃ´ng cáº­p nháº­t Ä‘Æ°á»£c tráº¡ng thÃ¡i mÃ³n.");
  } finally {
    updatingItemStatusOrderId.value = null;
    updatingItemStatusId.value = null;
    updatingItemStatusValue.value = null;
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
  socket.on("stock:update", handleStockUpdate);
  socket.on("order:new", handleNewOrder);
  socket.on("order:changed", handleOrderChanged);
});

onBeforeUnmount(() => {
  clearSearchDebounce();
  for (const timerId of cancelledItemFlashTimers.values()) {
    window.clearTimeout(timerId);
  }
  cancelledItemFlashTimers.clear();
  socket.off("stock:update", handleStockUpdate);
  socket.off("order:new", handleNewOrder);
  socket.off("order:changed", handleOrderChanged);
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
  background: rgba(var(--panel-rgb), 0.94);
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.orders-toolbar {
  border: 0;
  overflow: visible;
  display: grid;
}

.orders-surface {
  border: 1px solid rgba(var(--line-rgb), 0.9);
}

.orders-toolbar-body {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.orders-toolbar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.orders-toolbar-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 20px;
  flex: 0 0 auto;
}

.orders-toolbar-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.orders-status-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.orders-status-tabs::-webkit-scrollbar {
  display: none;
}

.orders-status-tab {
  flex: 0 0 auto;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.orders-status-tab:hover,
.orders-status-tab:focus-visible {
  outline: none;
  border-color: rgba(var(--ember-rgb), 0.16);
  background: rgba(var(--ember-rgb), 0.06);
  color: var(--ember-strong);
}

.orders-status-tab.is-active {
  border-color: rgba(var(--ember-rgb), 0.18);
  background: rgba(255, 247, 241, 0.94);
  color: var(--ember-strong);
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

.orders-toolbar-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  flex: 0 0 auto;
  border-radius: 14px;
  line-height: 1;
  align-self: center;
  margin: 0;
  background: rgba(var(--ember-rgb), 0.12);
  color: var(--ember-strong);
  border: 1px solid rgba(var(--ember-rgb), 0.18);
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.orders-toolbar-add-btn:hover,
.orders-toolbar-add-btn:focus-visible {
  background: rgba(var(--ember-rgb), 0.18);
  border-color: rgba(var(--ember-rgb), 0.26);
  transform: translateY(-1px);
}

.orders-toolbar-add-btn i,
.orders-toolbar-add-icon {
  display: block;
  font-size: 1rem;
}

/* ── Bell ─────────────────────────────────────────────────────── */
.orders-bell-wrap {
  position: relative;
  flex: 0 0 auto;
}

.orders-bell-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  transition: color 0.18s, background 0.18s;
}
.orders-bell-btn:hover,
.orders-bell-btn:focus-visible {
  color: var(--ember-strong);
  background: rgba(201, 88, 44, 0.08);
  outline: none;
}
.orders-bell-btn i { font-size: 1rem; }

.orders-bell-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #e03e2d;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
}

.orders-bell-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, calc(100vw - 32px));
  z-index: 9000;
  border-radius: 20px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 16px 40px rgba(var(--text-rgb), 0.18);
  overflow: hidden;
}

.orders-bell-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(var(--line-rgb), 0.7);
}

.orders-bell-panel-title {
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.orders-bell-clear-btn {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ember-strong);
  cursor: pointer;
}
.orders-bell-clear-btn:hover { text-decoration: underline; }

.orders-bell-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
}

.orders-bell-item {
  display: grid;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px dashed rgba(var(--line-rgb), 0.6);
}
.orders-bell-item:last-child { border-bottom: none; }

.orders-bell-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.orders-bell-item-name {
  font-weight: 700;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orders-bell-item-name--notify {
  flex: 1 1 auto;
}

.orders-bell-item-row > .orders-bell-item-name:not(.orders-bell-item-name--notify) {
  display: none;
}

.orders-bell-item-time {
  font-size: 0.8rem;
  color: var(--muted);
  flex-shrink: 0;
}

.orders-bell-item-note {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ember-strong);
}

.orders-bell-item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0 10px;
  font-size: 0.82rem;
  color: var(--muted);
}

.orders-bell-item-total {
  font-weight: 700;
  color: var(--ember-strong);
}

.orders-bell-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 16px;
  color: var(--muted);
  font-size: 0.85rem;
}

/* ── End Bell ─────────────────────────────────────────────────── */

.orders-toolbar-collapse {
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 0;
  display: inline-flex;
  align-items: center;
}

.orders-toolbar-collapse:hover,
.orders-toolbar-collapse:focus-visible {
  color: var(--text);
  outline: none;
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
  display: flex;
  align-items: center;
  height: 46px;
  margin: 0;
  max-width: 260px;
}

.orders-field-inline > .orders-select {
  height: 100%;
}

.orders-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.orders-name-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.orders-name-chip {
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.2);
  background: rgba(var(--panel-rgb), 0.8);
  color: var(--text);
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.orders-name-chip:hover:not(.is-active) {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.3);
  color: var(--ember-strong);
}

.orders-name-chip.is-active {
  background: rgba(var(--ember-rgb), 0.15);
  border-color: rgba(var(--ember-rgb), 0.5);
  color: var(--ember-strong);
  font-weight: 700;
}

.orders-name-chip.is-active:hover {
  background: rgba(var(--ember-rgb), 0.08);
  border-color: rgba(var(--ember-rgb), 0.3);
}

.orders-note-field { display: grid; gap: 6px; }

.orders-note-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.orders-note-chip {
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.25);
  background: transparent;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.orders-note-chip:hover:not(:disabled) {
  border-color: rgba(var(--ember-rgb), 0.4);
  color: var(--ember-strong);
}

.orders-note-chip.is-active {
  background: rgba(var(--ember-rgb), 0.13);
  border-color: rgba(var(--ember-rgb), 0.45);
  color: var(--ember-strong);
  font-weight: 700;
}

.orders-note-sep {
  width: 1px;
  height: 16px;
  background: rgba(var(--muted-rgb), 0.22);
  flex-shrink: 0;
}

/* ── item picker ── */
.order-picker {
  display: grid;
  gap: 6px;
}

.order-picker-fieldset {
  border: 1px solid rgba(var(--muted-rgb), 0.15);
  border-radius: 10px;
  padding: 0;
  margin: 0;
}

.order-picker-fieldset--methods {
  border-color: rgba(var(--ember-rgb), 0.25);
  background: rgba(var(--ember-rgb), 0.03);
}

.order-picker-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
  width: 100%;
}

.order-picker-legend:hover {
  color: var(--text);
}

.order-picker-legend--methods {
  color: var(--ember-strong);
  cursor: default;
}

.order-picker-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
}

.order-picker-ing {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.2);
  background: rgba(var(--panel-rgb), 0.8);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.12s, border-color 0.12s;
}

.order-picker-ing:hover:not(:disabled):not(.is-active) {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.3);
  color: var(--ember-strong);
}

.order-picker-ing.is-active {
  background: rgba(var(--ember-rgb), 0.15);
  border-color: rgba(var(--ember-rgb), 0.5);
  color: var(--ember-strong);
}

.order-picker-ing.is-active:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.08);
}

.order-picker-rem {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.12);
  color: var(--ember-strong);
}

.order-picker-ing.is-active .order-picker-rem {
  background: rgba(255, 255, 255, 0.25);
  color: inherit;
}

.order-picker-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
}

.order-picker-method {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.9);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
}

.order-picker-method:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.4);
  color: var(--ember-strong);
  transform: translateY(-1px);
}

.order-picker-method:active:not(:disabled) {
  transform: translateY(0);
}

.order-picker-price {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(var(--muted-rgb), 0.08);
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
  border: 1px solid rgba(var(--text-rgb), 0.12);
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
  border-color: rgba(var(--text-rgb), 0.12);
  box-shadow: none;
}

.orders-date-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.orders-date-icon { display: none; }
.orders-date-input { width: 100%; }
@media (pointer: coarse) {
  .orders-date-icon {
    display: block;
    position: absolute;
    left: 14px;
    font-size: 0.88rem;
    color: var(--muted);
    pointer-events: none;
    z-index: 1;
  }
  .orders-date-input { padding-left: 36px; }
  .orders-date-input::-webkit-calendar-picker-indicator { opacity: 0; }
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
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.96);
  color: var(--text);
}

.orders-feedback.is-error {
  border-color: rgba(143, 47, 21, 0.18);
  background: rgba(255, 244, 241, 0.96);
  color: var(--ember-strong);
}

.orders-schedule-wrap {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.orders-schedule-nav {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(var(--text-rgb), 0.1);
  color: var(--text);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  z-index: 1;
}

.orders-schedule-nav:first-child { margin-right: -6px; }
.orders-schedule-nav:last-child  { margin-left: -6px; }

.orders-schedule-strip {
  display: flex;
  gap: 10px;
  padding: 0 8px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
  min-width: 0;
}

.orders-schedule-strip::-webkit-scrollbar { display: none; }

.orders-schedule-chip {
  min-width: 150px;
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(var(--line-rgb), 0.9);
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
  border-bottom: 1px solid rgba(var(--line-rgb), 0.45);
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
  margin-top: 2px;
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

.orders-modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(var(--text-rgb), 0.38);
  backdrop-filter: blur(3px);
  z-index: 2100;
}

.orders-modal {
  width: min(100%, 520px);
  position: relative;
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(var(--line-rgb), 0.98);
  background: #fff;
  box-shadow:
    0 18px 40px rgba(var(--text-rgb), 0.22),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
  min-width: 0;
  justify-items: center;
  text-align: center;
}

.orders-modal-backdrop--fullscreen {
  place-items: center;
  padding: 24px;
}

.orders-create-modal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(1180px, calc(100vw - 48px));
  height: min(900px, calc(100vh - 48px));
  max-width: none;
  max-height: none;
  min-height: 0;
  overflow: hidden;
  gap: 0;
  padding: 0;
  border-radius: 28px;
  border: 1px solid rgba(var(--line-rgb), 0.98);
  box-shadow: none;
  justify-items: stretch;
  text-align: left;
}

.orders-create-modal-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: max(10px, env(safe-area-inset-top)) 12px 10px;
  border-bottom: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
  width: 100%;
}

.orders-create-modal-body {
  display: grid;
  gap: 10px;
  min-height: 0;
  width: 100%;
  padding: 0 20px calc(24px + env(safe-area-inset-bottom));
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.orders-create-guest {
  display: grid;
  gap: 8px;
  margin-top: 6px;
}

.orders-create-name {
  display: grid;
  gap: 8px;
}

.orders-create-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.orders-modal-title {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0;
  padding-right: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: var(--text);
}

.orders-modal-text {
  margin: 0;
  color: rgba(var(--text-rgb), 0.76);
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.orders-modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
}

.orders-create-close {
  position: static;
  flex: 0 0 auto;
}

.orders-modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 4px;
}

.orders-radio-list {
  display: grid;
  gap: 10px;
  width: 100%;
  text-align: left;
}

.orders-radio-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(255, 255, 255, 0.72);
}

.orders-radio-option input {
  margin-top: 3px;
}

.orders-modal-textarea {
  min-height: 96px;
  border-radius: 16px;
  border-color: rgba(var(--text-rgb), 0.12);
  box-shadow: none;
}

@media (max-width: 1199px) {
  .orders-advanced-body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .orders-modal-backdrop--fullscreen {
    place-items: stretch;
    padding: 0;
  }

  .orders-create-modal {
    align-self: stretch;
    justify-self: stretch;
  }

  .orders-modal {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    padding: 16px;
  }

  .orders-modal-actions {
    justify-content: center;
    margin-bottom: 8px;
  }

  .orders-modal-actions > * {
    flex: 0 0 auto;
    width: auto;
    min-width: 0;
    padding-left: 14px;
    padding-right: 14px;
  }

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

  .orders-toolbar-head-actions {
    gap: 14px;
  }

  .orders-toolbar-main {
    gap: 10px;
  }

  .orders-toolbar-side {
    justify-content: flex-start;
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

  .orders-schedule-wrap {
    margin-top: 10px;
  }

  .orders-schedule-strip {
    padding: 0 6px 14px;
    border-top: 0;
    border-bottom: 0;
    background: transparent;
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
    background: rgba(var(--panel-rgb), 0.96);
    border-top: 1px solid rgba(var(--line-rgb), 0.9);
    border-bottom: 1px solid rgba(var(--line-rgb), 0.9);
  }

  .order-add-control {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .orders-modal {
    padding: 0;
  }

  .orders-modal.orders-create-modal {
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    border-radius: 0;
    border: 0;
  }

  .orders-create-modal-body {
    padding: 0 12px calc(40px + env(safe-area-inset-bottom));
  }
}
</style>
