<template>
  <div class="orders-page">
    <details class="orders-toolbar" :open="filtersOpen" @toggle="handleFiltersToggle">
      <summary class="orders-toolbar-summary">
        <div class="orders-toolbar-summary-copy">
          <div class="orders-toolbar-heading">
            <span class="orders-toolbar-title">Bộ lọc đơn hàng</span>
            <span class="orders-toolbar-caption">
              {{ activeFilterCount ? `${activeFilterCount} điều kiện` : "Đang xem tất cả" }}
            </span>
          </div>

          <div class="orders-toolbar-meta">
            <span class="orders-toolbar-summary-text">{{ filterSummary }}</span>
            <span class="orders-meta-chip">
              {{ isLoading ? "Đang tải..." : `${orders.length} đơn` }}
            </span>
            <span v-if="!isLoading" class="orders-meta-chip">
              Tổng {{ formatMoney(totalAmount) }}
            </span>
          </div>
        </div>

        <i :class="['bi', filtersOpen ? 'bi-chevron-up' : 'bi-chevron-down', 'orders-toolbar-chevron']"></i>
      </summary>

      <div class="orders-toolbar-body">
        <div class="orders-toolbar-grid">
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
            <span class="orders-field-label">Trạng thái đơn</span>
            <select
              v-model="filter.status"
              class="form-select orders-select"
              :disabled="isLoading"
              @change="handleImmediateFilterChange"
            >
              <option value="">Tất cả trạng thái</option>
              <option v-for="status in statuses" :key="status" :value="status">
                {{ getOrderStatusLabel(status) }}
              </option>
            </select>
          </label>

          <label class="orders-field">
            <span class="orders-field-label">Thanh toán</span>
            <select
              v-model="filter.paymentStatus"
              class="form-select orders-select"
              :disabled="isLoading"
              @change="handleImmediateFilterChange"
            >
              <option value="">Tất cả thanh toán</option>
              <option v-for="status in paymentStatuses" :key="status" :value="status">
                {{ getPaymentStatusLabel(status) }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </details>

    <div v-if="errorMessage" class="orders-feedback is-error">
      <i class="bi bi-exclamation-circle"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <section class="orders-surface" :aria-busy="isLoading ? 'true' : 'false'">
      <header class="orders-surface-header">
        <div>
          <h2 class="orders-surface-title">Đơn hàng</h2>
          <p class="orders-surface-note">Danh sách đơn đang phát sinh và trạng thái phục vụ hiện tại.</p>
        </div>
        <div class="orders-surface-summary">
          <span class="orders-summary-count">{{ orders.length }} đơn</span>
          <span class="orders-summary-total">{{ formatMoney(totalAmount) }}</span>
        </div>
      </header>

      <div v-if="isLoading && !orders.length" class="orders-state">
        <div class="orders-state-title">Đang tải đơn hàng</div>
        <p>Dữ liệu đơn mới sẽ hiển thị ngay khi tải xong.</p>
      </div>

      <div v-else-if="!orders.length" class="orders-state">
        <div class="orders-state-title">Không có đơn phù hợp</div>
        <p>Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm để xem thêm đơn hàng.</p>
      </div>

      <template v-else>
        <div class="orders-mobile-list">
          <article v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-card-head">
              <div class="order-head-main">
                <div class="order-number">{{ order.orderNumber }}</div>
                <div class="order-contact-line">
                  <span class="order-customer-name">{{ getCustomerName(order) }}</span>
                  <span class="order-customer-phone">{{ getCustomerPhone(order) }}</span>
                </div>
                <div class="order-time">{{ formatDate(order.createdAt) }}</div>
              </div>

              <div class="order-head-side">
                <div class="order-total">{{ formatMoney(order.totalAmount) }}</div>
              </div>
            </div>

            <div class="order-badges">
              <span :class="['order-pill', getPaymentStatusClass(order.paymentStatus)]">
                {{ getPaymentStatusLabel(order.paymentStatus) }}
              </span>
              <span v-if="order.paymentMethod" class="order-pill is-muted">
                {{ getPaymentMethodLabel(order.paymentMethod) }}
              </span>
            </div>

            <ul class="order-item-list">
              <li v-if="!(order.items || []).length" class="order-item-row is-empty">
                <span class="order-item-name">Chưa có món</span>
              </li>
              <li
                v-for="(item, index) in order.items || []"
                :key="`${order.id}-mobile-item-${index}`"
                class="order-item-row"
              >
                <span class="order-item-name">{{ item.itemNameSnapshot }}</span>
                <span class="order-item-qty">x{{ item.quantity }}</span>
              </li>
            </ul>

            <div class="order-card-footer">
              <select
                :key="`mobile-status-${order.id}-${order.status}-${updatingOrderId === order.id}`"
                class="form-select order-status-select"
                :value="order.status"
                :disabled="isLoading || updatingOrderId === order.id"
                aria-label="Cập nhật trạng thái đơn hàng"
                @change="updateStatus(order.id, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="status in statuses" :key="status" :value="status">
                  {{ getOrderStatusLabel(status) }}
                </option>
              </select>

              <div class="order-updated">{{ formatDate(order.updatedAt) }}</div>
            </div>
          </article>
        </div>

        <div class="orders-desktop-table table-responsive">
          <table class="table orders-table align-middle mb-0">
            <thead>
              <tr>
                <th>Đơn</th>
                <th>Khách / SĐT</th>
                <th>Món gọi</th>
                <th class="text-end">Tổng</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td>
                  <div class="order-number">{{ order.orderNumber }}</div>
                  <div class="order-time">{{ formatDate(order.createdAt) }}</div>
                </td>
                <td>
                  <div class="order-contact-line">
                    <span class="order-customer-name">{{ getCustomerName(order) }}</span>
                    <span class="order-customer-phone">{{ getCustomerPhone(order) }}</span>
                  </div>
                </td>
                <td>
                  <ul class="orders-table-item-list">
                    <li v-if="!(order.items || []).length" class="orders-table-item is-empty">
                      <span class="orders-table-item-name">Chưa có món</span>
                    </li>
                    <li
                      v-for="(item, index) in order.items || []"
                      :key="`${order.id}-desktop-item-${index}`"
                      class="orders-table-item"
                    >
                      <span class="orders-table-item-qty">x{{ item.quantity }}</span>
                      <span class="orders-table-item-name">{{ item.itemNameSnapshot }}</span>
                    </li>
                  </ul>
                </td>
                <td class="text-end">
                  <div class="order-total desktop-total">{{ formatMoney(order.totalAmount) }}</div>
                </td>
                <td>
                  <div class="order-badges order-badges-desktop">
                    <span :class="['order-pill', getPaymentStatusClass(order.paymentStatus)]">
                      {{ getPaymentStatusLabel(order.paymentStatus) }}
                    </span>
                    <span v-if="order.paymentMethod" class="order-pill is-muted">
                      {{ getPaymentMethodLabel(order.paymentMethod) }}
                    </span>
                  </div>
                </td>
                <td>
                  <select
                    :key="`desktop-status-${order.id}-${order.status}-${updatingOrderId === order.id}`"
                    class="form-select form-select-sm order-status-select"
                    :value="order.status"
                    :disabled="isLoading || updatingOrderId === order.id"
                    aria-label="Cập nhật trạng thái đơn hàng"
                    @change="updateStatus(order.id, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="status in statuses" :key="status" :value="status">
                      {{ getOrderStatusLabel(status) }}
                    </option>
                  </select>
                </td>
                <td>
                  <div class="order-updated">{{ formatDate(order.updatedAt) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatDate, formatMoney } from "../../utils/format";

type OrderItem = {
  quantity: number;
  itemNameSnapshot: string;
};

type OrderRecord = {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalAmount: number;
  guestName?: string | null;
  guestPhone?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    fullName?: string | null;
    phone?: string | null;
  } | null;
  items?: OrderItem[];
};

const statuses = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
] as const;

const paymentStatuses = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;

const orderStatusLabels: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng",
  SERVED: "Đã phục vụ",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

const paymentStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  E_WALLET: "Ví điện tử",
  PAY_LATER: "Thanh toán sau",
};

const orders = ref<OrderRecord[]>([]);
const filtersOpen = ref(true);
const isLoading = ref(false);
const updatingOrderId = ref<number | null>(null);
const errorMessage = ref("");

const filter = reactive({
  status: "",
  paymentStatus: "",
  search: "",
});

let searchDebounceId: number | undefined;

const totalAmount = computed(() =>
  orders.value.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
);

const activeFilterCount = computed(() =>
  [filter.search, filter.status, filter.paymentStatus].filter(Boolean).length
);

const filterSummary = computed(() => {
  const parts: string[] = [];

  if (filter.search) {
    parts.push(`Từ khóa: ${filter.search}`);
  }

  if (filter.status) {
    parts.push(getOrderStatusLabel(filter.status));
  }

  if (filter.paymentStatus) {
    parts.push(getPaymentStatusLabel(filter.paymentStatus));
  }

  return parts.length ? parts.join(" · ") : "Không áp dụng bộ lọc";
});

function getOrderStatusLabel(status: string) {
  return orderStatusLabels[status] || status;
}

function getPaymentStatusLabel(status: string) {
  return paymentStatusLabels[status] || status;
}

function getPaymentMethodLabel(method: string) {
  return paymentMethodLabels[method] || method;
}

function getPaymentStatusClass(status: string) {
  if (status === "PAID") return "is-paid";
  if (status === "PARTIAL") return "is-partial";
  if (status === "REFUNDED") return "is-refunded";
  return "is-unpaid";
}

function getCustomerName(order: OrderRecord) {
  return order.customer?.fullName || order.guestName || "Khách lẻ";
}

function getCustomerPhone(order: OrderRecord) {
  return order.guestPhone || order.customer?.phone || "Không có SĐT";
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function clearSearchDebounce() {
  if (typeof searchDebounceId === "number") {
    window.clearTimeout(searchDebounceId);
    searchDebounceId = undefined;
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

function handleFiltersToggle(event: Event) {
  filtersOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

async function loadOrders() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const { data } = await api.get("/orders", {
      params: {
        status: filter.status || undefined,
        paymentStatus: filter.paymentStatus || undefined,
        search: filter.search || undefined,
      },
    });

    orders.value = data;
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được danh sách đơn hàng.");
  } finally {
    isLoading.value = false;
  }
}

async function updateStatus(id: number, status: string) {
  updatingOrderId.value = id;
  errorMessage.value = "";

  try {
    await api.put(`/orders/${id}/status`, { status });
    await loadOrders();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không cập nhật được trạng thái đơn hàng.");
  } finally {
    updatingOrderId.value = null;
  }
}

onMounted(() => {
  filtersOpen.value = !window.matchMedia("(max-width: 767px)").matches;
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
}

.orders-toolbar-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  cursor: pointer;
  list-style: none;
}

.orders-toolbar-summary::-webkit-details-marker {
  display: none;
}

.orders-toolbar-summary-copy {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.orders-toolbar-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.orders-toolbar-title {
  font-size: 1rem;
  font-weight: 800;
}

.orders-toolbar-caption {
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 600;
}

.orders-toolbar-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.orders-toolbar-summary-text {
  color: var(--muted);
  font-size: 0.92rem;
}

.orders-meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  color: var(--ember-strong);
  font-size: 0.83rem;
  font-weight: 800;
}

.orders-toolbar-chevron {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.orders-toolbar-body {
  padding: 0 20px 20px;
  border-top: 1px solid rgba(230, 209, 192, 0.8);
}

.orders-toolbar-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) repeat(2, minmax(180px, 0.8fr));
  gap: 14px;
  padding-top: 16px;
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
.orders-select,
.order-status-select {
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

.orders-mobile-list {
  display: none;
}

.order-card {
  padding: 16px 18px;
  border-top: 1px solid rgba(230, 209, 192, 0.9);
}

.order-card:first-child {
  border-top: none;
}

.order-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-head-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.order-head-side {
  flex-shrink: 0;
  text-align: right;
}

.order-number {
  font-weight: 800;
  line-height: 1.3;
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
.order-time,
.order-updated {
  color: var(--muted);
  font-size: 0.88rem;
}

.order-total {
  font-weight: 800;
  color: var(--ember-strong);
  text-align: right;
}

.desktop-total {
  white-space: nowrap;
}

.order-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
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

.order-item-list,
.orders-table-item-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid rgba(230, 209, 192, 0.72);
}

.order-item-row,
.orders-table-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px dashed rgba(230, 209, 192, 0.72);
}

.order-item-row:last-child,
.orders-table-item:last-child {
  border-bottom: none;
}

.order-item-name,
.orders-table-item-name {
  min-width: 0;
  font-weight: 600;
}

.order-item-qty,
.orders-table-item-qty {
  flex-shrink: 0;
  font-weight: 800;
  color: var(--ember-strong);
}

.order-item-row.is-empty,
.orders-table-item.is-empty {
  justify-content: flex-start;
}

.order-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.order-card-footer .order-status-select {
  min-width: 172px;
  max-width: 220px;
}

.orders-desktop-table {
  display: block;
}

.orders-table {
  margin: 0;
}

.orders-table thead th {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(230, 209, 192, 0.9);
  background: rgba(246, 233, 220, 0.52);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.orders-table tbody td {
  padding: 16px 18px;
  border-bottom-color: rgba(230, 209, 192, 0.72);
  vertical-align: top;
}

.orders-table tbody tr:hover {
  background: rgba(255, 248, 241, 0.58);
}

.orders-table-item-list {
  min-width: 260px;
  margin-top: 0;
  border-top: none;
}

.order-badges-desktop {
  margin-top: 0;
}

.orders-table .order-status-select {
  min-width: 176px;
  min-height: 38px;
}

@media (max-width: 1199px) {
  .orders-toolbar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .orders-search-field {
    grid-column: 1 / -1;
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

  .orders-toolbar-summary {
    padding: 14px 16px;
  }

  .orders-toolbar-heading,
  .orders-toolbar-meta {
    gap: 8px;
  }

  .orders-toolbar-summary-text {
    width: 100%;
  }

  .orders-toolbar-body {
    padding: 0 16px 16px;
  }

  .orders-toolbar-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding-top: 14px;
  }

  .orders-feedback {
    border-top: 0;
    margin-top: 0;
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

  .orders-mobile-list {
    display: block;
  }

  .order-card {
    padding: 14px 16px;
    background: rgba(255, 253, 249, 0.96);
  }

  .order-card-head {
    gap: 12px;
  }

  .order-head-side {
    min-width: 104px;
  }

  .order-card-footer {
    align-items: flex-end;
  }

  .order-card-footer .order-status-select {
    min-width: 0;
    max-width: none;
    flex: 1;
  }

  .orders-desktop-table {
    display: none;
  }
}
</style>
