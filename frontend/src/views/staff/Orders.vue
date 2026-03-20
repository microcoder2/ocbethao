<template>
  <div class="table-card">
    <div class="p-3 border-bottom fw-semibold">Bang don staff</div>
    <div class="table-responsive">
      <table class="table align-middle mb-0">
        <thead>
          <tr>
            <th>Ma don</th>
            <th>Khach</th>
            <th>Ban</th>
            <th>Tong tien</th>
            <th>Trang thai</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>{{ order.orderNumber }}</td>
            <td>{{ order.customer?.fullName || order.guestName || "--" }}</td>
            <td>{{ order.tableLabel || "--" }}</td>
            <td>{{ formatMoney(order.totalAmount) }}</td>
            <td>{{ order.status }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../api";
import { formatMoney } from "../../utils/format";

const orders = ref<any[]>([]);

async function loadOrders() {
  const { data } = await api.get("/orders");
  orders.value = data;
}

onMounted(loadOrders);
</script>
