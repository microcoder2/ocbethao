<template>
  <div
    v-if="props.open"
    class="inventory-summary-modal"
    role="presentation"
    @click.self="emit('close')"
  >
    <div
      class="inventory-summary-modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-summary-title"
    >
      <div class="inventory-summary-modal__head">
        <div>
          <div class="inventory-summary-modal__eyebrow">TỔN KHO NGUYÊN LIỆU</div>
          <h3 id="inventory-summary-title" class="inventory-summary-modal__title">
          {{ props.selectedIngredientName || "Nguyên liệu" }}
          </h3>
          <div class="inventory-summary-modal__meta">
            {{ props.rangeLabel }}
          </div>
        </div>

        <button
          type="button"
          class="inventory-summary-modal__close"
          aria-label="Đóng"
          @click="emit('close')"
        >
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div v-if="props.loading" class="inventory-summary-modal__loading">
        Đang tải số liệu...
      </div>

      <div v-else-if="props.errorMessage" class="alert alert-danger py-2 mb-0">
        {{ props.errorMessage }}
      </div>

      <template v-else-if="props.summary">
        <div class="inventory-summary-modal__stats">
          <article class="inventory-summary-stat">
            <span class="inventory-summary-stat__label">Tổng kho đầu ngày</span>
            <strong class="inventory-summary-stat__value">
              {{
                props.summary.openingSnapshot.totalRemainingQuantity != null
                  ? formatQuantity(props.summary.openingSnapshot.totalRemainingQuantity)
                  : "Không có log"
              }}
            </strong>
          </article>

          <article class="inventory-summary-stat">
            <span class="inventory-summary-stat__label">Tồn đầu của nguyên liệu</span>
            <strong class="inventory-summary-stat__value">
              {{ formatQuantity(props.summary.openingSnapshot.remainingQuantity) }}
            </strong>
          </article>

          <article class="inventory-summary-stat">
            <span class="inventory-summary-stat__label">Tổng tăng</span>
            <strong class="inventory-summary-stat__value is-positive">
              {{ formatDelta(props.summary.totalIncrease) }}
            </strong>
          </article>

          <article class="inventory-summary-stat">
            <span class="inventory-summary-stat__label">Tổng giảm</span>
            <strong class="inventory-summary-stat__value is-negative">
              {{ formatDelta(-props.summary.totalDecrease) }}
            </strong>
          </article>

          <article class="inventory-summary-stat inventory-summary-stat--wide">
            <span class="inventory-summary-stat__label">Dự kiến cuối kỳ theo log</span>
            <strong class="inventory-summary-stat__value">
              {{ formatQuantity(props.summary.expectedClosingQuantity) }}
            </strong>
            <span class="inventory-summary-stat__hint">
              {{ props.summary.movementCount }} phát sinh trong khoảng này
            </span>
          </article>

          <article class="inventory-summary-stat">
            <span class="inventory-summary-stat__label">Tồn hiện tại hệ thống</span>
            <strong class="inventory-summary-stat__value">
              {{ formatQuantity(props.summary.currentStock?.remainingQuantity ?? 0) }}
            </strong>
          </article>

          <article class="inventory-summary-stat">
            <span class="inventory-summary-stat__label">Chênh lệch kiểm toán</span>
            <strong
              class="inventory-summary-stat__value"
              :class="{
                'is-positive': props.summary.discrepancy > 0,
                'is-negative': props.summary.discrepancy < 0,
              }"
            >
              {{ formatDelta(props.summary.discrepancy) }}
            </strong>
          </article>
        </div>

        <div class="inventory-summary-modal__note">
          <div>
            Nguồn log đầu ngày:
            <strong>{{ props.summary.openingSnapshot.source === "audit-log" ? "đã ghi nhận" : "ước tính" }}</strong>
            <span v-if="props.summary.openingSnapshot.capturedAt">
              lúc {{ formatDateTime(props.summary.openingSnapshot.capturedAt) }}
            </span>
          </div>
          <div>
            Nếu chênh lệch khác 0, hệ thống và log đang lệch nhau so với số tồn hiện tại.
          </div>
        </div>
      </template>

      <div v-else class="inventory-summary-modal__empty">
        Chưa có dữ liệu để hiển thị.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type InventorySummaryData = {
  currentStock: {
    quantity: number;
    soldQuantity: number;
    remainingQuantity: number;
    updatedAt: string;
  } | null;
  openingSnapshot: {
    day: string;
    capturedAt: string | null;
    totalRemainingQuantity: number | null;
    remainingQuantity: number;
    source: "audit-log" | "derived";
  };
  movementCount: number;
  totalIncrease: number;
  totalDecrease: number;
  netChange: number;
  expectedClosingQuantity: number;
  discrepancy: number;
};

const props = defineProps<{
  open: boolean;
  loading: boolean;
  errorMessage: string;
  summary: InventorySummaryData | null;
  selectedIngredientName: string;
  rangeLabel: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

function formatQuantity(value: number) {
  const amount = Number(value || 0);
  return amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatDelta(value: number) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
</script>

<style scoped>
.inventory-summary-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(18, 16, 14, 0.58);
  backdrop-filter: blur(4px);
}

.inventory-summary-modal__panel {
  width: min(100%, 720px);
  max-height: min(86dvh, 820px);
  display: grid;
  gap: 16px;
  overflow: auto;
  padding: 18px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.99);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
}

.inventory-summary-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.inventory-summary-modal__eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.inventory-summary-modal__title {
  margin: 4px 0 0;
  font-size: 1.06rem;
  font-weight: 800;
  color: var(--text);
}

.inventory-summary-modal__meta {
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--muted);
}

.inventory-summary-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.8);
  color: var(--muted);
  flex-shrink: 0;
}

.inventory-summary-modal__close:hover,
.inventory-summary-modal__close:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(var(--orange-rgb), 0.7);
  background: rgba(var(--orange-rgb), 0.08);
  outline: none;
}

.inventory-summary-modal__loading,
.inventory-summary-modal__empty {
  padding: 4px 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.inventory-summary-modal__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.inventory-summary-stat {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.84);
}

.inventory-summary-stat--wide {
  grid-column: 1 / -1;
}

.inventory-summary-stat__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.inventory-summary-stat__value {
  font-size: 1.06rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.inventory-summary-stat__value.is-positive {
  color: var(--green);
}

.inventory-summary-stat__value.is-negative {
  color: var(--danger);
}

.inventory-summary-stat__hint {
  font-size: 0.78rem;
  color: var(--muted);
}

.inventory-summary-modal__note {
  display: grid;
  gap: 8px;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--muted);
}

@media (max-width: 767px) {
  .inventory-summary-modal {
    align-items: flex-end;
    padding: 12px;
  }

  .inventory-summary-modal__panel {
    width: 100%;
    max-height: 92dvh;
    padding: 14px;
  }

  .inventory-summary-modal__stats {
    grid-template-columns: 1fr;
  }
}
</style>
