<template>
  <div class="orders-page">
    <section class="orders-toolbar">
      <div class="orders-toolbar-body">
        <div class="orders-toolbar-head">
          <span class="orders-field-label">{{ statusFieldLabel }}</span>
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

        <div class="orders-toolbar-main">
          <label class="orders-field-inline">
            <select
              v-model="filter.status"
              class="form-select orders-select"
              :disabled="isLoading"
              @change="handleImmediateFilterChange"
            >
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CONFIRMED">Đang xử lý</option>
              <option value="COMPLETED">Hoàn tất</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>

          <button
            class="btn btn-dark orders-toolbar-add-btn"
            type="button"
            :disabled="!manualMenu || createOrderSubmitting"
            aria-label="Thêm đơn thủ công"
            title="Thêm đơn thủ công"
            @click="openCreateOrderDialog"
          >
            <i class="bi bi-plus-lg"></i>
          </button>

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
              <div class="order-contact-line">
                <span class="order-customer-name">{{ getCustomerName(order) }}</span>
                <span class="order-customer-phone">{{ getCustomerPhone(order) }}</span>
              </div>
            </div>

            <div class="order-head-side">
              <button
                class="order-info-trigger"
                type="button"
                :title="getOrderInfoTooltip(order)"
                :aria-label="`Thông tin đơn ${order.orderNumber}`"
              >
                <i class="bi bi-info-circle"></i>
              </button>
              <div class="order-total">{{ formatMoney(order.totalAmount) }}</div>
            </div>
          </div>

          <div class="order-status-line">
            <span class="order-arrival-chip">
              Giờ hẹn {{ getQueueTime(order) }}
            </span>
            <span :class="['order-pill', getSimpleStatusClass(order.status)]">
              {{ getOrderStatusLabel(order.status) }}
            </span>
          </div>

          <div v-if="shouldShowPaymentMethod(order)" class="order-badges">
            <span v-if="order.paymentMethod" class="order-pill is-muted">
              {{ getPaymentMethodLabel(order.paymentMethod) }}
            </span>
          </div>

          <div v-if="order.itemProgress?.total" class="order-progress">
            <div class="order-progress-head">
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
                    <template v-for="group in groupByIngredient(getAddableOptions(order))" :key="group.label">
                      <optgroup :label="groupLabel(group)">
                        <option
                          v-for="option in group.items"
                          :key="option.id"
                          :value="String(option.id)"
                        >
                          {{ option.menuItem.name }} · {{ formatMoney(option.sellingPrice) }}
                        </option>
                      </optgroup>
                    </template>
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
              v-if="canConfirmOrder(order)"
              class="btn btn-dark"
              type="button"
              :disabled="isBusy(order)"
              @click="changeOrderStatus(order, 'CONFIRMED')"
            >
              {{ updatingOrderId === order.id ? "Đang xác nhận..." : "Xác nhận đơn" }}
            </button>
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
            <OrderDraftPanel
              title="Tạo đơn mới"
              summary=""
              :lines="createOrderDialog.lines"
              :arrival-time="createOrderDialog.arrivalTime"
              :note="createOrderDialog.note"
              :disabled="createOrderSubmitting || !manualMenu"
              :submit-disabled="createOrderSubmitting || !canSubmitCreateOrder"
              :submitting="createOrderSubmitting"
              :sticky="false"
              :compact="true"
              :framed="false"
              :show-header="false"
              :show-summary="false"
              submit-label="Tạo đơn"
              submitting-label="Đang tạo đơn..."
              empty-title="Chưa có món trong đơn"
              empty-description="Chọn món từ danh sách bên dưới để bắt đầu tạo đơn."
              @change-qty="handleCreateOrderLineChange"
              @remove-line="removeCreateOrderLine"
              @update:arrival-time="createOrderDialog.arrivalTime = $event"
              @update:note="createOrderDialog.note = $event"
              @submit="submitCreateOrder"
            >
              <template #before-lines>
                <div class="orders-create-grid">
                  <label class="orders-field">
                    <span class="orders-field-label">Tên khách</span>
                    <input
                      v-model.trim="createOrderDialog.guestName"
                      class="form-control orders-select"
                      type="text"
                      placeholder="Ví dụ: Chị Lan"
                    />
                  </label>

                  <label class="orders-field">
                    <span class="orders-field-label">Số điện thoại</span>
                    <input
                      v-model.trim="createOrderDialog.guestPhone"
                      class="form-control orders-select"
                      type="tel"
                      placeholder="0909..."
                    />
                  </label>
                </div>

                <div class="order-add-row">
                  <div class="order-add-field">
                    <span class="orders-field-label">Thêm món vào đơn</span>
                    <div class="order-add-control">
                      <select
                        v-model="createOrderDialog.selectedItemId"
                        class="form-select orders-select"
                        :disabled="createOrderSubmitting || !manualMenuOptions.length"
                      >
                        <option value="">Chọn món</option>
                        <template v-for="group in groupByIngredient(manualMenuOptions)" :key="group.label">
                          <optgroup :label="groupLabel(group)">
                            <option v-for="item in group.items" :key="item.id" :value="String(item.id)">
                              {{ item.menuItem.name }} · {{ formatMoney(item.sellingPrice) }}
                            </option>
                          </optgroup>
                        </template>
                      </select>
                      <button
                        class="btn btn-ember order-add-btn"
                        type="button"
                        :disabled="createOrderSubmitting || !createOrderDialog.selectedItemId"
                        @click="addCreateOrderItem"
                      >
                        <i class="bi bi-plus-lg"></i>
                      </button>
                    </div>
                    <div v-if="!manualMenu" class="order-add-hint">
                      Chưa có menu cho ngày đang lọc.
                    </div>
                  </div>
                </div>
              </template>
            </OrderDraftPanel>
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
import OrderDraftPanel from "../../components/common/OrderDraftPanel.vue";
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

type ManualOrderLine = {
  key: string;
  dailyMenuItemId: number;
  name: string;
  price: number;
  quantity: number;
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  E_WALLET: "Ví điện tử",
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

function simplifyStatus(status: string) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "PENDING") return "PENDING";
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
  status: "CONFIRMED",
  search: "",
});

const manualMenu = computed(() => dailyMenus.value[0] || null);
const manualMenuOptions = computed(() =>
  (manualMenu.value?.items || []).filter((item) => item.isAvailable && item.menuItem)
);
const canSubmitCreateOrder = computed(
  () => Boolean(manualMenu.value && createOrderDialog.lines.length && createOrderDialog.guestName.trim())
);

const itemDrafts = reactive<Record<number, EditableOrderItem[]>>({});
const itemAddSelections = reactive<Record<number, string>>({});
// poolId → remainingQuantity, updated from API load + socket events
const stockRemainingMap = reactive<Record<number, number>>({});

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

const createOrderDialog = reactive<{
  visible: boolean;
  guestName: string;
  guestPhone: string;
  arrivalTime: string;
  note: string;
  selectedItemId: string;
  lines: ManualOrderLine[];
}>({
  visible: false,
  guestName: "",
  guestPhone: "",
  arrivalTime: "",
  note: "",
  selectedItemId: "",
  lines: [],
});

const createOrderSubmitting = ref(false);

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
  if (simpleStatus === "PENDING") return "Chờ xác nhận";
  if (simpleStatus === "CONFIRMED") return "Đang xử lý";
  if (simpleStatus === "COMPLETED") return "Hoàn tất";
  return "Đã hủy";
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

function shouldShowPaymentMethod(order: OrderRecord) {
  return simplifyStatus(order.status) === "COMPLETED" && order.paymentStatus === "PAID" && !!order.paymentMethod;
}

function getCustomerName(order: OrderRecord) {
  return order.customer?.fullName || order.guestName || "Khách lẻ";
}

function getCustomerPhone(order: OrderRecord) {
  return order.guestPhone || order.customer?.phone || "Không có SĐT";
}

function getOrderInfoTooltip(order: OrderRecord) {
  return `ID đơn: ${order.orderNumber}\nGiờ đặt: ${formatOrderTime(order.createdAt)}`;
}

function getQueueTime(order: OrderRecord) {
  return order.arrivalAt ? formatOrderTime(order.arrivalAt) : "Chưa hẹn";
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

function isBusy(order: OrderRecord) {
  return isLoading.value || updatingOrderId.value === order.id || savingOrderId.value === order.id;
}

function canConfirmOrder(order: OrderRecord) {
  return simplifyStatus(order.status) === "PENDING";
}

function canEditItems(order: OrderRecord) {
  return simplifyStatus(order.status) === "CONFIRMED";
}

function canCompleteOrder(order: OrderRecord) {
  return simplifyStatus(order.status) === "CONFIRMED";
}

function canCancelOrder(order: OrderRecord) {
  const s = simplifyStatus(order.status);
  return s === "PENDING" || s === "CONFIRMED";
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

function resetCreateOrderDialog() {
  createOrderDialog.guestName = "";
  createOrderDialog.guestPhone = "";
  createOrderDialog.arrivalTime = "";
  createOrderDialog.note = "";
  createOrderDialog.selectedItemId = "";
  createOrderDialog.lines = [];
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

function addCreateOrderItem() {
  const selectedId = Number(createOrderDialog.selectedItemId || 0);
  if (!selectedId) {
    return;
  }

  const option = manualMenuOptions.value.find((item) => item.id === selectedId);
  if (!option) {
    return;
  }

  const existing = createOrderDialog.lines.find((line) => line.dailyMenuItemId === option.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    createOrderDialog.lines.push({
      key: `manual-${option.id}`,
      dailyMenuItemId: option.id,
      name: option.menuItem.name,
      price: Number(option.sellingPrice || 0),
      quantity: 1,
    });
  }

  createOrderDialog.selectedItemId = "";
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

function removeCreateOrderLine(key: string | number) {
  createOrderDialog.lines = createOrderDialog.lines.filter((entry) => entry.key !== String(key));
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
      arrivalAt: buildArrivalAt(filter.date, createOrderDialog.arrivalTime),
      note: createOrderDialog.note.trim() || undefined,
      items: createOrderDialog.lines.map((line) => ({
        dailyMenuItemId: line.dailyMenuItemId,
        quantity: line.quantity,
      })),
    });

    closeCreateOrderDialog();
    await loadOrders();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tạo được đơn thủ công.");
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

function groupByIngredient(options: DailyMenuOption[]) {
  const groups = new Map<string, { label: string; poolId: number | null; items: DailyMenuOption[] }>();
  for (const option of options) {
    const pool = option.stockLinks?.[0]?.stockPool;
    const label = pool?.label || "Khác";
    const poolId = pool?.id ?? null;
    const key = poolId != null ? `pool-${poolId}` : `label-${label}`;
    if (!groups.has(key)) {
      groups.set(key, { label, poolId, items: [] });
    }
    groups.get(key)!.items.push(option);
  }
  return Array.from(groups.values());
}

function groupLabel(group: { label: string; poolId: number | null }) {
  const rem = group.poolId != null ? stockRemainingMap[group.poolId] : undefined;
  return rem != null ? `${group.label} — còn ${rem}` : group.label;
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
  socket.on("stock:update", handleStockUpdate);
});

onBeforeUnmount(() => {
  clearSearchDebounce();
  socket.off("stock:update", handleStockUpdate);
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
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.orders-toolbar {
  border: 0;
  overflow: hidden;
  display: grid;
}

.orders-surface {
  border: 1px solid rgba(230, 209, 192, 0.9);
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

.orders-toolbar-main {
  display: grid;
  grid-template-columns: minmax(220px, 260px) 46px minmax(0, 1fr);
  gap: 12px 16px;
  align-items: center;
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
  width: 46px;
  height: 46px;
  min-width: 46px;
  min-height: 46px;
  padding: 0;
  flex: 0 0 auto;
  border-radius: 50%;
  line-height: 1;
  align-self: center;
  margin: 0;
}

.orders-toolbar-add-btn i {
  display: block;
}

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
  margin-top: 12px;
  padding: 0 20px 16px;
  overflow-x: auto;
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
  border-bottom: 1px solid rgba(230, 209, 192, 0.45);
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
  margin-bottom: 6px;
  background: var(--order-status-surface);
}

.order-card:last-child {
  margin-bottom: 0;
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
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  text-align: right;
}

.order-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(126, 86, 65, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.order-info-trigger:hover,
.order-info-trigger:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}

.order-info-trigger i {
  font-size: 0.95rem;
}

.order-contact-line {
  display: flex;
  align-items: center;
  min-width: 0;
  flex-wrap: wrap;
}

.order-contact-line {
  gap: 6px 10px;
}

.order-status-line {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.order-customer-name {
  font-weight: 700;
}

.order-customer-phone {
  color: var(--muted);
  font-size: 0.9rem;
}

.order-arrival-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px 0 0;
  color: var(--ember-strong);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  justify-self: start;
  z-index: 0;
}

.order-arrival-chip::before {
  content: "";
  position: absolute;
  inset: 0;
  left: -10px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  z-index: -1;
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
  flex-shrink: 0;
  justify-self: end;
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
  z-index: 2100;
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

.orders-modal-backdrop--fullscreen {
  place-items: stretch;
  padding: 0;
}

.orders-create-modal {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100vw;
  height: 100vh;
  max-height: none;
  overflow: hidden;
  gap: 0;
  padding: 0;
  border-radius: 0;
  border: 0;
  box-shadow: none;
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
  border-bottom: 1px solid rgba(230, 209, 192, 0.9);
  background: rgba(255, 253, 249, 0.98);
}

.orders-create-modal-body {
  display: grid;
  gap: 10px;
  padding: 0;
  overflow: auto;
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

.orders-create-close {
  position: static;
  flex: 0 0 auto;
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

  .orders-create-grid {
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
    grid-template-columns: minmax(0, 1fr) 46px;
    align-items: center;
  }

  .orders-toolbar-side,
  .orders-field-inline {
    max-width: none;
  }

  .orders-toolbar-side {
    grid-column: 1 / -1;
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
    margin-top: 10px;
    padding: 0 16px 14px;
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
