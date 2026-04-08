<template>
  <div class="order-card-item-statuses">
    <div
      v-if="chips.length || actions.length"
      :class="[
        'order-item-stage-actions',
        {
          'is-three-cols': !chips.length && actions.length === 3,
          'has-chips': chips.length > 0,
        },
      ]"
    >
      <template v-if="renderActionsFirst">
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          :class="[
            'order-item-stage-action',
            action.toneClass,
            {
              'is-active': action.active,
              'is-actionable': !action.disabled,
              'is-pending': action.pending,
              'is-icon-end': action.iconSide === 'end',
              'is-icon-only': action.iconOnly,
            },
          ]"
          :disabled="action.disabled"
          :aria-busy="action.pending ? 'true' : 'false'"
          :aria-label="action.ariaLabel || action.title || action.label"
          :title="action.title"
          @click="$emit('triggerAction', action.key)"
        >
          <i
            v-if="action.iconClass && action.iconSide !== 'end'"
            class="bi order-item-action-icon"
            :class="action.iconClass"
          ></i>
          <span v-if="action.label" class="order-item-action-label">{{ action.label }}</span>
          <span v-if="action.showCount && action.count != null" class="order-item-action-count">{{ action.count }}</span>
          <i
            v-if="action.iconClass && action.iconSide === 'end'"
            class="bi order-item-action-icon is-trailing"
            :class="action.iconClass"
          ></i>
          <span v-if="action.pending" class="order-item-action-spinner" aria-hidden="true"></span>
        </button>
        <span
          v-for="chip in chips"
          :key="chip.key"
          :class="['order-item-stage-chip', chip.toneClass, { 'is-active': chip.active }]"
        >
          <i v-if="chip.iconClass" class="bi" :class="chip.iconClass"></i>
          <span class="order-item-action-label">{{ chip.label }}</span>
          <strong v-if="chip.showCount && chip.count != null">{{ chip.count }}</strong>
        </span>
      </template>
      <template v-else>
        <span
          v-for="chip in chips"
          :key="chip.key"
          :class="['order-item-stage-chip', chip.toneClass, { 'is-active': chip.active }]"
        >
          <i v-if="chip.iconClass" class="bi" :class="chip.iconClass"></i>
          <span class="order-item-action-label">{{ chip.label }}</span>
          <strong v-if="chip.showCount && chip.count != null">{{ chip.count }}</strong>
        </span>
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          :class="[
            'order-item-stage-action',
            action.toneClass,
            {
              'is-active': action.active,
              'is-actionable': !action.disabled,
              'is-pending': action.pending,
              'is-icon-end': action.iconSide === 'end',
              'is-icon-only': action.iconOnly,
            },
          ]"
          :disabled="action.disabled"
          :aria-busy="action.pending ? 'true' : 'false'"
          :aria-label="action.ariaLabel || action.title || action.label"
          :title="action.title"
          @click="$emit('triggerAction', action.key)"
        >
          <i
            v-if="action.iconClass && action.iconSide !== 'end'"
            class="bi order-item-action-icon"
            :class="action.iconClass"
          ></i>
          <span v-if="action.label" class="order-item-action-label">{{ action.label }}</span>
          <span v-if="action.showCount && action.count != null" class="order-item-action-count">{{ action.count }}</span>
          <i
            v-if="action.iconClass && action.iconSide === 'end'"
            class="bi order-item-action-icon is-trailing"
            :class="action.iconClass"
          ></i>
          <span v-if="action.pending" class="order-item-action-spinner" aria-hidden="true"></span>
        </button>
      </template>
    </div>

    <div v-if="showPicker" class="order-item-stage-picker">
      <div class="order-item-stage-picker-copy">
        <strong>{{ pickerLabel }}</strong>
        <span>{{ pickerHint }}</span>
      </div>
      <div class="order-item-stage-picker-controls">
        <button type="button" class="order-item-picker-btn" @click="$emit('nudgePicker', -1)">-</button>
        <span class="order-item-picker-value">{{ pickerQuantity }}</span>
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
export type OrderCardStatusChipView = {
  key: string;
  label: string;
  toneClass: string;
  count?: number | null;
  showCount?: boolean;
  active?: boolean;
  iconClass?: string;
};

export type OrderCardStatusActionView = {
  key: string;
  label: string;
  toneClass: string;
  count?: number | null;
  showCount?: boolean;
  active?: boolean;
  pending?: boolean;
  disabled?: boolean;
  title?: string;
  iconClass?: string;
  iconSide?: "start" | "end";
  iconOnly?: boolean;
  ariaLabel?: string;
};

withDefaults(defineProps<{
  chips?: OrderCardStatusChipView[];
  actions?: OrderCardStatusActionView[];
  renderActionsFirst?: boolean;
  showPicker?: boolean;
  pickerLabel?: string;
  pickerHint?: string;
  pickerQuantity?: number;
}>(), {
  chips: () => [],
  actions: () => [],
  renderActionsFirst: false,
  showPicker: false,
  pickerLabel: "",
  pickerHint: "",
  pickerQuantity: 1,
});

defineEmits<{
  triggerAction: [key: string];
  nudgePicker: [delta: number];
  confirmPicker: [];
  closePicker: [];
}>();
</script>

<style scoped>
.order-card-item-statuses {
  display: grid;
  gap: 8px;
  width: 100%;
  justify-items: stretch;
}

.order-item-stage-actions,
.order-item-stage-picker-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.order-item-stage-actions {
  width: 100%;
}

.order-item-stage-actions.is-three-cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.order-item-stage-actions.is-three-cols .order-item-stage-action {
  width: 100%;
  min-width: 0;
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
  white-space: nowrap;
}

.order-item-stage-action {
  position: relative;
  min-width: 0;
  cursor: pointer;
  border-radius: 16px;
  min-height: 36px;
  padding: 0 12px;
  background: rgba(var(--muted-rgb), 0.06);
  color: rgba(var(--text-rgb), 0.7);
  border-color: rgba(var(--muted-rgb), 0.14);
  box-shadow: inset 0 2px 4px rgba(var(--text-rgb), 0.08);
  transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s, box-shadow 0.18s;
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

.order-item-stage-chip.is-active {
  border-style: solid;
  border-color: currentColor;
  position: relative;
  overflow: hidden;
}

.order-item-stage-chip.is-active::after {
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

.order-item-stage-action:hover,
.order-item-stage-action:focus-visible,
.order-item-picker-btn:hover,
.order-item-picker-btn:focus-visible {
  transform: translateY(-1px);
  outline: none;
}

.order-item-stage-action:disabled {
  opacity: 0.65;
  cursor: default;
  box-shadow: none;
}

.order-item-stage-action.is-pending .order-item-action-label,
.order-item-stage-action.is-pending .order-item-action-count,
.order-item-stage-action.is-pending .order-item-action-icon {
  opacity: 0.28;
}

.order-item-stage-action.is-actionable {
  border-style: solid;
}

.order-item-stage-action.is-icon-end {
  padding-right: 8px;
}

.order-item-stage-action.is-icon-only {
  min-width: 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: auto;
  justify-content: center;
  gap: 0;
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
  background: rgba(203, 165, 81, 0.18);
  border-color: rgba(203, 165, 81, 0.2);
  color: #8b6517;
}

.order-item-stage-action.is-cooking,
.order-item-stage-chip.is-cooking {
  background: rgba(201, 126, 71, 0.5);
  border-color: rgba(201, 126, 71, 0.2);
  color: #8a451f;
}

.order-item-stage-action.is-ready,
.order-item-stage-chip.is-ready {
  background: rgba(66, 133, 104, 0.5);
  border-color: rgba(66, 133, 104, 0.2);
  color: var(--green);
}

.order-item-stage-action.is-cancelled,
.order-item-stage-chip.is-cancelled {
  background: rgba(148, 88, 88, 0.5);
  border-color: rgba(148, 88, 88, 0.2);
  color: #8f2f15;
}

.order-item-stage-action.is-muted,
.order-item-stage-chip.is-muted {
  background: rgba(var(--text-rgb), 0.5);
  border-color: rgba(var(--text-rgb), 0.12);
  color: var(--muted);
}

.order-item-action-icon {
  font-size: 0.82rem;
  line-height: 1;
}

.order-item-action-icon.is-trailing {
  margin-left: 2px;
}

.order-item-stage-action.is-icon-only .order-item-action-icon.is-trailing {
  margin-left: 0;
}

.order-item-action-icon.bi-arrow-repeat {
  animation: spin 0.9s linear infinite;
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
  font-size: 0.76rem;
}

.order-item-stage-picker-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.order-item-picker-btn,
.order-item-picker-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
}

.order-item-picker-btn {
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: #fff;
  color: var(--text);
}

.order-item-picker-value {
  padding: 0 10px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.95);
}

.order-item-action-spinner {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: spin 0.75s linear infinite;
}

@keyframes glass-shine {
  from { transform: skewX(-18deg) translateX(-150%); }
  to { transform: skewX(-18deg) translateX(280%); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
