<template>
  <div class="customer-order-item-statuses">
    <span :class="['order-item-status', statusClass, 'is-active']">
      {{ statusLabel }}
    </span>
    <button
      v-if="showCancel"
      class="order-item-cancel-btn"
      type="button"
      :disabled="cancelDisabled"
      :title="cancelTitle"
      @click="$emit('requestCancel')"
    >
      <i class="bi" :class="cancelIconClass"></i>
      <span>{{ cancelLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  status?: string | null;
  showCancel?: boolean;
  cancelDisabled?: boolean;
  cancelTitle?: string;
  cancelLabel?: string;
  cancelIconClass?: string;
}>(), {
  status: "WAITING",
  showCancel: false,
  cancelDisabled: false,
  cancelTitle: "",
  cancelLabel: "Hủy món",
  cancelIconClass: "bi-x-circle",
});

defineEmits<{
  requestCancel: [];
}>();

const statusLabel = computed(() => {
  if (props.status === "READY") return "Lên món";
  if (props.status === "COOKING") return "Đang làm";
  if (props.status === "CANCELLED") return "Đã hủy";
  return "Chờ";
});

const statusClass = computed(() => `is-${String(props.status || "WAITING").toLowerCase()}`);
</script>

<style scoped>
.customer-order-item-statuses {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-self: start;
  gap: 6px;
  margin-top: 4px;
  width: fit-content;
  max-width: 100%;
}

.order-item-cancel-btn {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  width: fit-content;
  max-width: 100%;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(148, 88, 88, 0.24);
  border-radius: 999px;
  background: rgba(148, 88, 88, 0.08);
  color: #8f2f15;
  font-size: 0.76rem;
  font-weight: 700;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}

.order-item-cancel-btn:hover,
.order-item-cancel-btn:focus-visible {
  background: rgba(148, 88, 88, 0.12);
  border-color: rgba(148, 88, 88, 0.34);
  outline: none;
}

.order-item-cancel-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.order-item-status {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  width: fit-content;
  max-width: 100%;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.order-item-status.is-waiting { background: rgba(203, 165, 81, 0.12); color: #8b6517; }
.order-item-status.is-cooking { background: rgba(201, 126, 71, 0.13); color: #8a451f; }
.order-item-status.is-ready { background: rgba(66, 133, 104, 0.14); color: var(--green); }
.order-item-status.is-cancelled { background: rgba(148, 88, 88, 0.14); color: #8f2f15; }

.order-item-status.is-active {
  border-color: currentColor;
  position: relative;
  overflow: hidden;
}

.order-item-status.is-active::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 80%;
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.55), transparent);
  animation: glass-shine 1.2s linear infinite;
  pointer-events: none;
}

@keyframes glass-shine {
  from { transform: skewX(-18deg) translateX(-150%); }
  to { transform: skewX(-18deg) translateX(280%); }
}
</style>
