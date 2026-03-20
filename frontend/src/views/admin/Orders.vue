<template>
  <div class="d-grid gap-4">
    <div class="page-panel">
      <div class="row g-3 align-items-center">
        <div class="col-md-4">
          <select v-model="filter.status" class="form-select" @change="loadOrders">
            <option value="">Tat ca trang thai</option>
            <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
          </select>
        </div>
        <div class="col-md-6">
          <input v-model="filter.search" class="form-control" placeholder="Tim theo ma don / ten / sdt / ban" />
        </div>
        <div class="col-md-2 d-grid">
          <button class="btn btn-outline-dark" @click="loadOrders">Loc</button>
        </div>
      </div>
    </div>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Theo doi don hang</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Don</th>
              <th>Khach / Ban</th>
              <th>Tong</th>
              <th>Thanh toan</th>
              <th>Trang thai</th>
              <th>Cap nhat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>
                <div class="fw-semibold">{{ order.orderNumber }}</div>
                <div class="small text-muted">{{ formatDate(order.createdAt) }}</div>
              </td>
              <td>{{ order.customer?.fullName || order.guestName || "--" }} / {{ order.tableLabel || "--" }}</td>
              <td>{{ formatMoney(order.totalAmount) }}</td>
              <td>{{ order.paymentStatus }}</td>
              <td>
                <select class="form-select form-select-sm" :value="order.status" @change="updateStatus(order.id, ($event.target as HTMLSelectElement).value)">
                  <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
                </select>
              </td>
              <td>{{ formatDate(order.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatDate, formatMoney } from "../../utils/format";

const orders = ref<any[]>([]);
const statuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"];
const filter = reactive({
  status: "",
  search: "",
});

async function loadOrders() {
  const { data } = await api.get("/orders", {
    params: {
      status: filter.status || undefined,
      search: filter.search || undefined,
    },
  });
  orders.value = data;
}

async function updateStatus(id: number, status: string) {
  await api.put(`/orders/${id}/status`, { status });
  await loadOrders();
}

onMounted(loadOrders);
</script>
