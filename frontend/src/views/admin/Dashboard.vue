<template>
  <div class="d-grid gap-4">
    <section class="stat-grid">
      <StatCard label="Doanh thu ngay" :value="formatMoney(summary?.revenue?.day || 0)" />
      <StatCard label="Doanh thu thang" :value="formatMoney(summary?.revenue?.month || 0)" />
      <StatCard label="Doanh thu nam" :value="formatMoney(summary?.revenue?.year || 0)" />
      <StatCard label="Don dang xu ly" :value="summary?.orders?.active || 0" />
    </section>

    <section class="row g-4">
      <div class="col-12 col-xl-6">
        <div class="page-panel h-100">
          <div class="panel-title">Phan bo theo trang thai</div>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="(value, key) in summary?.byStatus || {}" :key="key" class="tag">
              {{ key }}: {{ value }}
            </span>
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-6">
        <div class="page-panel h-100">
          <div class="panel-title">Loai khach</div>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="(value, key) in summary?.byCustomerType || {}" :key="key" class="tag">
              {{ key }}: {{ value }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Don gan day</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Ma don</th>
              <th>Khach</th>
              <th>Loai</th>
              <th>Tong tien</th>
              <th>Trang thai</th>
              <th>Tao luc</th>
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
import { api } from "../../api";
import StatCard from "../../components/common/StatCard.vue";
import { formatDate, formatMoney } from "../../utils/format";

const summary = ref<any>(null);

async function loadSummary() {
  const { data } = await api.get("/dashboard/summary");
  summary.value = data;
}

onMounted(loadSummary);
</script>
