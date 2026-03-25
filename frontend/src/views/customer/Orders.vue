<template>
  <div class="d-grid gap-4">
    <section v-for="order in orders" :key="order.id" class="page-panel">
      <div class="d-flex flex-wrap justify-content-between gap-3">
        <div>
          <div class="panel-title mb-1">{{ order.orderNumber }}</div>
          <div class="text-muted">{{ formatDate(order.createdAt) }}</div>
          <div v-if="order.arrivalAt" class="text-muted small mt-1">
            Giờ hẹn: {{ formatTime(order.arrivalAt) }}
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <span class="tag">{{ order.status }}</span>
          <span class="tag">{{ order.paymentStatus }}</span>
          <span v-if="order.itemProgress?.total" class="tag">
            {{ order.itemProgress.ready }}/{{ order.itemProgress.total }} món sẵn sàng
          </span>
        </div>
      </div>
      <div class="mt-3 d-grid gap-2">
        <div v-for="item in order.items" :key="item.id" class="d-flex justify-content-between">
          <span>{{ item.itemNameSnapshot }} x{{ item.quantity }} · {{ getItemStatusLabel(item.status) }}</span>
          <span>{{ formatMoney(item.lineTotal) }}</span>
        </div>
      </div>
      <div class="fw-semibold mt-3">Tong: {{ formatMoney(order.totalAmount) }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../api";
import { formatDate, formatMoney } from "../../utils/format";

const orders = ref<any[]>([]);

async function loadOrders() {
  const { data } = await api.get("/orders/my");
  orders.value = data;
}

function formatTime(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getItemStatusLabel(status?: string | null) {
  if (status === "READY") return "lên món";
  if (status === "COOKING") return "đang làm";
  if (status === "CANCELLED") return "đã hủy";
  return "đang chờ";
}

onMounted(loadOrders);
</script>
