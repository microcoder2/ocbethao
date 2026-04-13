<template>
  <div class="d-grid gap-4">
    <section v-if="loadError" class="alert alert-warning mb-0">
      {{ loadError }}
    </section>

    <section class="stat-grid">
      <StatCard label="Doanh thu ngày" :value="formatMoney(summary?.revenue?.day || 0)" />
      <StatCard label="Doanh thu tháng" :value="formatMoney(summary?.revenue?.month || 0)" />
      <StatCard label="Doanh thu năm" :value="formatMoney(summary?.revenue?.year || 0)" />
      <StatCard label="Đơn đang xử lý" :value="summary?.orders?.active || 0" />
    </section>

    <section class="row g-4">
      <div class="col-12 col-xl-6">
        <div class="page-panel h-100">
          <div class="panel-title">Phân bố theo trạng thái</div>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="(value, key) in summary?.byStatus || {}" :key="key" class="tag">
              {{ key }}: {{ value }}
            </span>
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-6">
        <div class="page-panel h-100">
          <div class="panel-title">Loại khách</div>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="(value, key) in summary?.byCustomerType || {}" :key="key" class="tag">
              {{ key }}: {{ value }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Đơn gần đây</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách</th>
              <th>Loại</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Tạo lúc</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in summary?.recentOrders || []" :key="order.id">
              <td class="fw-semibold">{{ order.orderNumber }}</td>
              <td>{{ order.customerName || order.guestName || "--" }}</td>
              <td>{{ order.customerType || "WALK_IN" }}</td>
              <td>{{ formatMoney(order.totalAmount) }}</td>
              <td>{{ order.status }} / {{ order.paymentStatus }}</td>
              <td>{{ formatDate(order.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { isAxiosError } from "axios";
import { api } from "../../api";
import StatCard from "../../components/common/StatCard.vue";
import { formatDate, formatMoney } from "../../utils/format";

const summary = ref<any>(null);
const loadError = ref("");
const router = useRouter();

async function loadSummary() {
  loadError.value = "";
  try {
    const { data } = await api.get("/dashboard/summary");
    summary.value = data;
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401) {
      await router.replace("/login");
      return;
    }

    loadError.value = "Không tải được dữ liệu tổng quan.";
    console.error("Failed to load dashboard summary", error);
  }
}

onMounted(() => {
  void loadSummary();
});
</script>
