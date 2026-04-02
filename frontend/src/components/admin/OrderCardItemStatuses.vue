<template>
  <div class="admin-order-item-statuses">
    <div v-if="showCancelled" class="order-item-status-block is-action">
      <div class="order-item-stage-actions">
        <span class="order-item-stage-chip is-cancelled">
          <span class="order-item-action-label">Đã hủy</span>
          <strong v-if="showCancelledCount">{{ cancelledCount }}</strong>
        </span>
        <button
          type="button"
          :class="[
            'order-item-stage-action',
            'is-ready',
            {
              'is-actionable': !restoreDisabled,
              'is-pending': restorePending,
            },
          ]"
          :disabled="restoreDisabled"
          :aria-busy="restorePending ? 'true' : 'false'"
          :title="restoreTitle"
          @click="$emit('restoreCancelled')"
        >
          <span class="order-item-action-label">Phục hồi</span>
          <span
            v-if="restorePending"
            class="order-item-action-spinner"
            aria-hidden="true"
          ></span>
        </button>
      </div>
    </div>

    <div v-else-if="stageControls.length" class="order-item-status-block is-action">
      <div class="order-item-stage-actions">
        <button
          v-for="control in stageControls"
          :key="control.key"
          type="button"
          :class="[
            'order-item-stage-action',
            control.toneClass,
            {
              'is-active': control.activeCount > 0,
              'is-actionable': !control.disabled,
              'is-pending': control.pending,
            },
          ]"
          :disabled="control.disabled"
          :aria-busy="control.pending ? 'true' : 'false'"
          :title="control.title"
          @click="$emit('openControl', control.key)"
        >
          <span class="order-item-action-label">{{ control.label }}</span>
          <span v-if="control.showCount" class="order-item-action-count">{{ control.activeCount }}</span>
          <span
            v-if="control.pending"
            class="order-item-action-spinner"
            aria-hidden="true"
          ></span>
        </button>
      </div>
    </div>

    <div v-if="showStagePicker" class="order-item-stage-picker">
      <div class="order-item-stage-picker-copy">
        <strong>{{ stagePickerLabel }}</strong>
        <span>{{ stagePickerHint }}</span>
      </div>
      <div class="order-item-stage-picker-controls">
        <button type="button" class="order-item-picker-btn" @click="$emit('nudgePicker', -1)">-</button>
        <span class="order-item-picker-value">{{ stagePickerQuantity }}</span>
        <button type="button" class="order-item-picker-btn" @click="$emit('nudgePicker', 1)">+</button>
      </div>
      <div class="order-item-stage-picker-actions">
        <button type="button" class="btn btn-dark btn-sm" @click="$emit('confirmPicker')">Xác nhận</button>
        <button type="button" class="btn btn-outline-dark btn-sm" @click="$emit('closePicker')">Bỏ qua</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type StageControlView = {
  key: string;
  label: string;
  toneClass: string;
  activeCount: number;
  pending: boolean;
  disabled: boolean;
  title: string;
  showCount: boolean;
};

defineProps<{
  showCancelled: boolean;
  cancelledCount: number;
  showCancelledCount: boolean;
  restorePending: boolean;
  restoreDisabled: boolean;
  restoreTitle: string;
  stageControls: StageControlView[];
  showStagePicker: boolean;
  stagePickerLabel: string;
  stagePickerHint: string;
  stagePickerQuantity: number;
}>();

defineEmits<{
  restoreCancelled: [];
  openControl: [controlKey: string];
  nudgePicker: [delta: number];
  confirmPicker: [];
  closePicker: [];
}>();
</script>

<style scoped>
.admin-order-item-statuses {
  display: grid;
  gap: 8px;
  width: 100%;
}

.order-item-status-block {
  display: grid;
  gap: 6px;
}

.order-item-stage-actions,
.order-item-stage-picker-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.order-item-stage-chip,
.order-item-stage-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.order-item-stage-chip {
  background: rgba(var(--text-rgb), 0.035);
  color: var(--muted);
  border-style: dashed;
}

.order-item-stage-chip strong,
.order-item-action-count {
  min-width: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.order-item-stage-action {
  position: relative;
  min-width: 86px;
  cursor: pointer;
  background: rgba(var(--muted-rgb), 0.06);
  color: rgba(var(--text-rgb), 0.7);
  border-color: rgba(var(--muted-rgb), 0.14);
  box-shadow: inset 0 2px 4px rgba(var(--text-rgb), 0.08);
  transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s, box-shadow 0.18s;
}

.order-item-stage-action:hover,
.order-item-stage-action:focus-visible,
.order-item-picker-btn:hover,
.order-item-picker-btn:focus-visible {
  transform: translateY(-1px);
  outline: none;
}

.order-item-stage-action:disabled {
  opacity: 1;
  cursor: default;
  box-shadow: none;
}

.order-item-stage-action.is-pending .order-item-action-label,
.order-item-stage-action.is-pending .order-item-action-count {
  opacity: 0.28;
}

.order-item-stage-action.is-actionable {
  border-style: solid;
}

.order-item-stage-action.is-active {
  border-color: currentColor;
  overflow: hidden;
}

.order-item-stage-action.is-active::after {
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

.order-item-stage-action.is-waiting,
.order-item-stage-chip.is-waiting {
  background: rgba(203, 165, 81, 0.12);
  border-color: rgba(203, 165, 81, 0.2);
  color: #8b6517;
}

.order-item-stage-action.is-cooking,
.order-item-stage-chip.is-cooking {
  background: rgba(201, 126, 71, 0.13);
  border-color: rgba(201, 126, 71, 0.2);
  color: #8a451f;
}

.order-item-stage-action.is-ready,
.order-item-stage-chip.is-ready {
  background: rgba(66, 133, 104, 0.14);
  border-color: rgba(66, 133, 104, 0.2);
  color: var(--green);
}

.order-item-stage-action.is-cancelled,
.order-item-stage-chip.is-cancelled {
  background: rgba(148, 88, 88, 0.14);
  border-color: rgba(148, 88, 88, 0.2);
  color: #8f2f15;
}

.order-item-stage-action.is-muted {
  background: rgba(var(--text-rgb), 0.06);
  border-color: rgba(var(--text-rgb), 0.12);
  color: var(--muted);
}

.order-item-stage-picker {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid rgba(var(--line-rgb), 0.8);
  background: rgba(255, 255, 255, 0.84);
}

.order-item-stage-picker-copy {
  display: grid;
  gap: 2px;
}

.order-item-stage-picker-copy strong {
  font-size: 0.82rem;
}

.order-item-stage-picker-copy span {
  color: var(--muted);
  font-size: 0.78rem;
}

.order-item-stage-picker-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.order-item-picker-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  border-radius: 999px;
  background: #fff;
  color: var(--text);
}

.order-item-picker-value {
  min-width: 32px;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.order-item-stage-picker-actions .btn {
  min-height: 32px;
}

.order-item-action-label,
.order-item-action-count {
  transition: opacity 0.18s ease;
}

.order-item-action-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-top: -7px;
  margin-left: -7px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: order-item-spin 0.7s linear infinite;
  pointer-events: none;
}

@keyframes order-item-spin {
  to { transform: rotate(360deg); }
}

@keyframes glass-shine {
  from { transform: skewX(-18deg) translateX(-150%); }
  to { transform: skewX(-18deg) translateX(280%); }
}

@media (max-width: 767px) {
  .order-item-stage-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .order-item-stage-action {
    min-width: 0;
    width: 100%;
  }
}
</style>
