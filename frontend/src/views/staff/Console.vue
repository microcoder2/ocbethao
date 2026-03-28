<template>
  <div class="row g-4">
    <div class="col-12 col-xl-8">
      <div class="page-panel">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div class="panel-title mb-1">{{ menu?.title || "Thực đơn hôm nay" }}</div>
            <div class="text-muted">{{ menu?.bannerText || "Nhân viên có thể tạo đơn tại bàn từ đây." }}</div>
          </div>
          <button class="btn btn-outline-dark" @click="loadData">Reload</button>
        </div>
        <div class="menu-grid">
          <article v-for="item in menu?.items || []" :key="item.id" class="menu-card">
            <div class="menu-image"></div>
            <div class="menu-body">
              <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <div class="fw-semibold">{{ item.menuItem?.name }}</div>
                  <div class="small text-muted">{{ item.highlightLabel || item.menuItem?.category?.name }}</div>
                </div>
                <span class="tag">{{ formatMoney(item.sellingPrice) }}</span>
              </div>
              <div class="small text-muted mt-3">Còn lại: {{ item.availableQuantity ?? "không giới hạn" }}</div>
              <button class="btn btn-ember btn-sm mt-3" @click="addToCart(item)">Thêm vào đơn</button>
            </div>
          </article>
        </div>
      </div>
    </div>

    <div class="col-12 col-xl-4">
      <div class="page-panel sticky-panel">
        <div class="panel-title">Tạo đơn tại bàn</div>
        <div class="form-grid mb-3">
          <input v-model="form.tableLabel" class="form-control" placeholder="Bàn số 02" />
          <input v-model="form.guestName" class="form-control" placeholder="Tên khách" />
          <input v-model="form.guestPhone" class="form-control" placeholder="Số điện thoại" />
          <input v-model.number="form.guestCount" type="number" class="form-control" placeholder="Số khách" />
          <input v-model="form.arrivalAt" type="datetime-local" class="form-control" placeholder="Giờ hẹn đến" />
          <textarea v-model="form.note" class="form-control" rows="2" placeholder="Ghi chú đơn hàng"></textarea>
        </div>

        <div v-if="cart.length === 0" class="text-muted small">Chưa có món nào trong đơn.</div>
        <div v-else class="d-grid gap-2 mb-3">
          <div v-for="line in cart" :key="line.dailyMenuItemId" class="d-flex justify-content-between gap-2 align-items-center">
            <div>
              <div class="fw-semibold small">{{ line.name }}</div>
              <div class="small text-muted">{{ formatMoney(line.price) }}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-dark" @click="changeQty(line, -1)">-</button>
              <span>{{ line.quantity }}</span>
              <button class="btn btn-sm btn-outline-dark" @click="changeQty(line, 1)">+</button>
            </div>
          </div>
        </div>

        <div class="fw-semibold mb-3">Tổng tạm tính: {{ formatMoney(cartTotal) }}</div>
        <button class="btn btn-ember w-100" :disabled="cart.length === 0 || submitting" @click="submitOrder">
          {{ submitting ? "Đang tạo đơn..." : "Tạo đơn" }}
        </button>
      </div>
    </div>

    <div class="col-12">
      <div class="table-card">
        <div class="p-3 border-bottom fw-semibold">Đơn đang xử lý</div>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Bàn / Khách</th>
                <th>Giờ hẹn</th>
                <th>Tổng</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in activeOrders" :key="order.id">
                <td>{{ order.orderNumber }}</td>
                <td>{{ order.tableLabel || "--" }} / {{ order.customer?.fullName || order.guestName || "--" }}</td>
                <td>{{ formatArrivalTime(order.arrivalAt) }}</td>
                <td>{{ formatMoney(order.totalAmount) }}</td>
                <td>{{ order.status }}</td>
                <td class="text-end d-flex justify-content-end gap-2">
                  <button class="btn btn-sm btn-outline-dark" @click="updateStatus(order.id, 'COMPLETED', 'CASH')">Tiền mặt</button>
                  <button class="btn btn-sm btn-ember" @click="updateStatus(order.id, 'COMPLETED', 'TRANSFER')">Chuyển khoản</button>
                  <button class="btn btn-sm btn-outline-danger" @click="updateStatus(order.id, 'CANCELLED')">Hủy</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatMoney } from "../../utils/format";

const menu = ref<any>(null);
const orders = ref<any[]>([]);
const cart = ref<any[]>([]);
const submitting = ref(false);
const form = reactive({
  tableLabel: "",
  guestName: "",
  guestPhone: "",
  guestCount: 2,
  arrivalAt: "",
  note: "",
});

const activeOrders = computed(() =>
  orders.value.filter((order) => !["COMPLETED", "CANCELLED"].includes(order.status))
);

const cartTotal = computed(() =>
  cart.value.reduce((sum, line) => sum + line.price * line.quantity, 0)
);

async function loadData() {
  const [menuRes, orderRes] = await Promise.all([
    api.get("/daily-menus/public/today"),
    api.get("/orders"),
  ]);
  menu.value = menuRes.data;
  orders.value = orderRes.data;
}

function addToCart(item: any) {
  const existing = cart.value.find((line) => line.dailyMenuItemId === item.id);
  if (existing) {
    existing.quantity += 1;
    return;
  }
  cart.value.push({
    dailyMenuItemId: item.id,
    name: item.menuItem?.name,
    price: item.sellingPrice,
    quantity: 1,
  });
}

function changeQty(line: any, delta: number) {
  line.quantity = Math.max(1, line.quantity + delta);
}

function formatArrivalTime(value?: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

async function submitOrder() {
  submitting.value = true;
  try {
    await api.post("/orders", {
      dailyMenuId: menu.value?.id,
      tableLabel: form.tableLabel,
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      guestCount: form.guestCount,
      arrivalAt: form.arrivalAt || undefined,
      note: form.note,
      items: cart.value.map((line) => ({
        dailyMenuItemId: line.dailyMenuItemId,
        quantity: line.quantity,
      })),
    });
    cart.value = [];
    Object.assign(form, {
      tableLabel: "",
      guestName: "",
      guestPhone: "",
      guestCount: 2,
      arrivalAt: "",
      note: "",
    });
    await loadData();
  } finally {
    submitting.value = false;
  }
}

async function updateStatus(id: number, status: string, paymentMethod?: string) {
  await api.put(`/orders/${id}/status`, { status, paymentMethod });
  await loadData();
}

onMounted(loadData);
</script>
