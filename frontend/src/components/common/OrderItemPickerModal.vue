<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="orders-modal-backdrop orders-modal-backdrop--fullscreen"
      role="dialog"
      aria-modal="true"
      @click.self="$emit('close')"
    >
      <div class="orders-modal order-picker-modal">
        <div class="order-picker-modal__header">
          <div class="order-picker-modal__heading">
            <div class="orders-modal-title">{{ title }}</div>
            <div v-if="showMultiToggle" class="order-picker-modal__toggle-row">
              <button
                type="button"
                class="order-picker-modal__multi-toggle"
                :class="{ 'is-active': multiSelectMode }"
                :aria-pressed="multiSelectMode ? 'true' : 'false'"
                :title="multiSelectMode ? 'Tắt chọn nhiều món' : 'Bật chọn nhiều món'"
                @click="$emit('update:multiSelectMode', !multiSelectMode)"
              >
                <i class="bi" :class="multiSelectMode ? 'bi-check2-square' : 'bi-square'"></i>
                <span>Chọn nhiều món</span>
              </button>
            </div>
          </div>
          <button
            class="orders-modal-close order-picker-modal__close"
            type="button"
            aria-label="Đóng"
            @click="$emit('close')"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="order-picker-modal__body">
          <MenuIngredientFilterCard
            :buckets="buckets"
            :open-bucket-names="openBucketNames"
            :selected-key="selectedKey"
            @toggle-bucket="$emit('toggleBucket', $event)"
            @select-group="$emit('selectGroup', $event)"
          />

          <fieldset
            v-if="selectedGroupLabel"
            class="quick-order-picker__fieldset quick-order-picker__fieldset--methods"
          >
            <legend class="quick-order-picker__legend quick-order-picker__legend--methods">
              Cách nấu
            </legend>
            <div class="quick-order-picker__methods">
              <button
                v-for="item in methodItems"
                :key="item.id"
                type="button"
                class="quick-order-picker__method"
                :disabled="isItemDisabled(item)"
                @click="$emit('selectItem', item)"
              >
                <span>{{ resolveMethodLabel(item) }}</span>
                <span class="quick-order-picker__price">{{ formatMoneyShort(Number(item.sellingPrice || 0)) }}</span>
              </button>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import MenuIngredientFilterCard from "./MenuIngredientFilterCard.vue";
import { formatMoneyShort } from "../../utils/format";

type PickerMethodItem = {
  id: number | string;
  sellingPrice?: number | null;
  menuItem?: { name?: string | null } | null;
  [key: string]: unknown;
};

type PickerBucket = {
  name: string;
  groups: Array<{
    key: string;
    label: string;
    badge?: number | null;
    items: PickerMethodItem[];
  }>;
};

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    busy?: boolean;
    buckets: PickerBucket[];
    openBucketNames: string[];
    selectedKey: string | null;
    selectedGroupLabel?: string | null;
    methodItems: PickerMethodItem[];
    showMultiToggle?: boolean;
    multiSelectMode?: boolean;
    canSelectItem?: (item: PickerMethodItem) => boolean;
    getMethodLabel?: (item: PickerMethodItem, ingredientLabel: string) => string;
  }>(),
  {
    title: "Thêm món",
    busy: false,
    selectedGroupLabel: null,
    showMultiToggle: true,
    multiSelectMode: false,
  }
);

defineEmits<{
  close: [];
  toggleBucket: [bucketName: string];
  selectGroup: [key: string];
  selectItem: [item: PickerMethodItem];
  "update:multiSelectMode": [value: boolean];
}>();

function isItemDisabled(item: PickerMethodItem) {
  if (props.busy) return true;
  if (!props.canSelectItem) return false;
  return !props.canSelectItem(item);
}

function resolveMethodLabel(item: PickerMethodItem) {
  if (props.getMethodLabel && props.selectedGroupLabel) {
    return props.getMethodLabel(item, props.selectedGroupLabel);
  }

  return String(item.menuItem?.name || "");
}
</script>

<style scoped>
.orders-modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(var(--text-rgb), 0.38);
  backdrop-filter: blur(3px);
  z-index: 2100;
}

.order-picker-modal {
  width: min(1040px, calc(100vw - 32px));
  max-height: min(900px, calc(100dvh - 32px));
  overflow: hidden;
  padding: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: stretch;
  text-align: left;
}

.orders-modal {
  width: min(100%, 440px);
  position: relative;
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 24px 48px rgba(var(--text-rgb), 0.24);
}

.orders-modal-title {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0;
}

.order-picker-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
}

.order-picker-modal__heading {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.order-picker-modal__toggle-row {
  display: flex;
  align-items: flex-start;
  margin-top: 2px;
}

.order-picker-modal__multi-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 5px 10px;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.04);
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
}

.order-picker-modal__multi-toggle i {
  font-size: 0.9rem;
}

.order-picker-modal__multi-toggle.is-active {
  border-color: rgba(var(--ember-rgb), 0.25);
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember-strong);
}

.order-picker-modal__body {
  display: grid;
  gap: 10px;
  min-height: 0;
  padding: 14px 18px 18px;
  overflow: auto;
  overscroll-behavior: contain;
}

.order-picker-modal__close {
  position: static;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
}

.order-picker-modal__close:hover,
.order-picker-modal__close:focus-visible {
  background: rgba(var(--text-rgb), 0.1);
  color: var(--text);
  outline: none;
}

.quick-order-picker__fieldset--methods {
  display: grid;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(var(--ember-rgb), 0.25);
  border-radius: 10px;
  background: rgba(var(--ember-rgb), 0.03);
}

.quick-order-picker__legend--methods {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ember-strong);
  cursor: default;
  user-select: none;
}

.quick-order-picker__methods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
}

.quick-order-picker__method {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  border-radius: 10px;
  background: rgba(var(--panel-rgb), 0.9);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
}

.quick-order-picker__price {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(var(--muted-rgb), 0.08);
}

.quick-order-picker__method:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.4);
  color: var(--ember-strong);
  transform: translateY(-1px);
}

.quick-order-picker__method:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (max-width: 767px) {
  .orders-modal {
    padding: 18px;
  }
}
</style>
