<template>
  <div :class="['order-card-items-section', { 'is-order-cancelled': cancelledOrder }]">
    <div v-if="showProgress && progressSegments.length" class="order-progress">
      <div class="order-progress-head">
        <strong>{{ progressText }}</strong>
      </div>
      <div class="order-progress-track">
        <span
          v-for="segment in progressSegments"
          :key="segment.key"
          :class="['order-progress-segment', `is-${segment.tone}`]"
          :style="{ width: `${segment.width}%` }"
        ></span>
      </div>
      <div v-if="progressLegend.length" class="order-progress-legend">
        <span v-for="label in progressLegend" :key="label">{{ label }}</span>
      </div>
    </div>

    <ul class="order-item-list">
      <li v-if="!items.length" class="order-item-row is-empty">
        <span class="order-item-name">{{ emptyLabel }}</span>
      </li>
      <li
        v-for="(item, index) in items"
        :key="item.key"
        :class="[
          'order-item-row',
          {
            'is-highlighted': highlightedKey === item.key,
            'is-cancelled': item.status === 'CANCELLED',
          },
          getExtraRowClasses(item, index),
        ]"
      >
        <div class="order-item-main">
          <div class="order-item-copy">
            <div class="order-item-headline">
              <span class="order-item-name">{{ index + 1 }}. {{ item.itemNameSnapshot }}</span>
              <button
                v-if="canEditNote(item) && !hasItemNote(item)"
                :class="[
                  'order-item-note-toggle',
                  {
                    'has-note': hasItemNote(item),
                    'is-open': isNoteEditorOpen(item.key),
                  },
                ]"
                type="button"
                :disabled="busy"
                :aria-label="hasItemNote(item) ? 'Sửa ghi chú món' : 'Thêm ghi chú món'"
                :aria-expanded="isNoteEditorOpen(item.key) ? 'true' : 'false'"
                :title="hasItemNote(item) ? 'Sửa ghi chú món' : 'Thêm ghi chú món'"
                @click="$emit('toggleItemNoteEditor', item.key)"
              >
                <i class="bi bi-chat-left-text"></i>
              </button>
              <span v-if="!hasItemNote(item)" class="order-item-meta-chip">{{ formatMoney(item.unitPrice) }} / món</span>
            </div>
          </div>
          <div class="order-item-side">
            <span class="order-item-total">{{ formatMoney(getDisplayedTotalValue(item)) }}</span>
            <div v-if="canAdjust(item)" class="order-item-editor">
              <button class="btn btn-sm order-qty-btn" type="button" :disabled="busy" @click="$emit('changeQty', index, -1)">-</button>
              <span class="order-item-qty">{{ item.quantity }}</span>
              <button class="btn btn-sm order-qty-btn" type="button" :disabled="busy" @click="$emit('changeQty', index, 1)">+</button>
            </div>
            <span v-else class="order-item-qty-read">{{ getQuantityLabelValue(item) }}</span>
          </div>
        </div>

        <div v-if="hasItemNote(item)" class="order-item-note-list">
          <span class="order-item-meta-chip">{{ formatMoney(item.unitPrice) }} / món</span>
          <span
            v-for="noteChip in getItemNoteChips(item.note)"
            :key="`${item.key}-${noteChip.text}`"
            :class="['order-item-note-chip', `is-${noteChip.tone}`]"
          >{{ noteChip.text }}</span>
          <button
            v-if="canEditNote(item)"
            :class="[
              'order-item-note-toggle',
              {
                'has-note': hasItemNote(item),
                'is-open': isNoteEditorOpen(item.key),
              },
            ]"
            type="button"
            :disabled="busy"
            :aria-label="hasItemNote(item) ? 'Sửa ghi chú món' : 'Thêm ghi chú món'"
            :aria-expanded="isNoteEditorOpen(item.key) ? 'true' : 'false'"
            :title="hasItemNote(item) ? 'Sửa ghi chú món' : 'Thêm ghi chú món'"
            @click="$emit('toggleItemNoteEditor', item.key)"
          >
            <i class="bi bi-chat-left-text"></i>
          </button>
        </div>

        <div v-if="canEditNote(item) && isNoteEditorOpen(item.key)" class="order-item-note-editor">
          <template v-for="(group, groupIndex) in NOTE_CHIP_GROUPS" :key="group.key">
            <span v-if="groupIndex > 0" class="order-item-note-sep" aria-hidden="true"></span>
            <button
              v-for="chip in group.chips"
              :key="chip"
              type="button"
              :class="['order-item-note-picker-chip', { 'is-active': isNoteChipActive(item.note || '', chip) }]"
              :disabled="busy"
              @click="$emit('toggleItemNoteChip', index, chip)"
            >{{ chip }}</button>
          </template>
        </div>

        <div v-if="showItemStatuses" class="order-item-statuses">
          <slot name="item-statuses" :item="item" :index="index"></slot>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { formatMoney } from "../../utils/format";
import { NOTE_CHIP_GROUPS, isNoteChipActive, parseNoteChips } from "../../utils/noteChips";

type OrderCardItem = {
  id?: number | null;
  key: string;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  note?: string | null;
  lineTotal: number;
};

type ProgressSegment = {
  key: string;
  tone: string;
  width: number;
};

const props = withDefaults(defineProps<{
  items: OrderCardItem[];
  busy?: boolean;
  highlightedKey?: string | number | null;
  emptyLabel?: string;
  showProgress?: boolean;
  progressText?: string;
  progressSegments?: ProgressSegment[];
  progressLegend?: string[];
  showItemStatuses?: boolean;
  cancelledOrder?: boolean;
  extraRowClasses?: (item: OrderCardItem, index: number) => unknown;
  canEditItemNote?: (item: OrderCardItem) => boolean;
  isItemNoteEditorOpen?: (key: string) => boolean;
  canAdjustItem?: (item: OrderCardItem) => boolean;
  getDisplayedTotal?: (item: OrderCardItem) => number;
  getQuantityLabel?: (item: OrderCardItem) => string;
}>(), {
  busy: false,
  highlightedKey: null,
  emptyLabel: "Chưa có món",
  showProgress: false,
  progressText: "",
  progressSegments: () => [],
  progressLegend: () => [],
  showItemStatuses: false,
  cancelledOrder: false,
  extraRowClasses: undefined,
  canEditItemNote: undefined,
  isItemNoteEditorOpen: undefined,
  canAdjustItem: undefined,
  getDisplayedTotal: undefined,
  getQuantityLabel: undefined,
});

defineEmits<{
  changeQty: [index: number, delta: number];
  toggleItemNoteEditor: [key: string];
  toggleItemNoteChip: [index: number, chip: string];
}>();

function hasItemNote(item: OrderCardItem) {
  return Boolean(String(item.note || "").trim());
}

function getItemNoteChips(note?: string | null) {
  return parseNoteChips(note);
}

function canEditNote(item: OrderCardItem) {
  return props.canEditItemNote?.(item) ?? false;
}

function isNoteEditorOpen(key: string) {
  return props.isItemNoteEditorOpen?.(key) ?? false;
}

function canAdjust(item: OrderCardItem) {
  return props.canAdjustItem?.(item) ?? false;
}

function getDisplayedTotalValue(item: OrderCardItem) {
  if (props.getDisplayedTotal) {
    return Number(props.getDisplayedTotal(item) || 0);
  }
  if (typeof item.lineTotal === "number") {
    return Number(item.lineTotal || 0);
  }
  return Number(item.unitPrice || 0) * Math.max(0, Number(item.quantity || 0));
}

function getQuantityLabelValue(item: OrderCardItem) {
  if (props.getQuantityLabel) {
    return props.getQuantityLabel(item);
  }
  return String(Math.max(0, Number(item.quantity || 0)));
}

function getExtraRowClasses(item: OrderCardItem, index: number) {
  return props.extraRowClasses?.(item, index);
}
</script>

<style scoped>
.order-card-items-section {
  display: grid;
  gap: 14px;
}

.order-progress {
  display: grid;
  gap: 8px;
}

.order-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-progress-track {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.08);
}

.order-progress-segment { height: 100%; }
.order-progress-segment.is-waiting { background: rgba(203, 165, 81, 0.7); }
.order-progress-segment.is-cooking { background: rgba(201, 126, 71, 0.7); }
.order-progress-segment.is-ready { background: rgba(66, 133, 104, 0.78); }
.order-progress-segment.is-cancelled { background: rgba(148, 88, 88, 0.5); }

.order-progress-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--muted);
  font-size: 0.82rem;
}

.order-item-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid rgba(var(--line-rgb), 0.72);
}

@keyframes item-flash {
  0% { background: rgba(201, 88, 44, 0.18); }
  70% { background: rgba(201, 88, 44, 0.08); }
  100% { background: transparent; }
}

@keyframes cancelled-item-pulse {
  0%, 100% { background: rgba(148, 88, 88, 0.08); }
  50% { background: rgba(201, 88, 44, 0.18); }
}

.order-item-row {
  display: grid;
  gap: 6px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(var(--line-rgb), 0.72);
}

.order-item-row:last-child { border-bottom: none; }
.order-item-row.is-empty { display: flex; justify-content: flex-start; }
.order-item-row.is-highlighted { animation: item-flash 1.2s ease-out forwards; border-radius: 6px; }
.order-item-row.is-cancelled {
  padding-inline: 10px;
  border-radius: 12px;
  background: rgba(148, 88, 88, 0.08);
  opacity: 0.74;
}

.order-card-items-section.is-order-cancelled .order-item-row.is-cancelled {
  padding-inline: 0;
  border-radius: 0;
  background: transparent;
  opacity: 1;
}

.order-item-row.is-cancelled .order-item-name,
.order-item-row.is-cancelled .order-item-total {
  color: #8f2f15;
}

.order-item-row.is-cancelled .order-item-meta-chip,
.order-item-row.is-cancelled .order-item-note-toggle,
.order-item-row.is-cancelled .order-item-qty-read {
  color: rgba(143, 47, 21, 0.78);
}

.order-card-items-section.is-order-cancelled .order-item-row.is-cancelled .order-item-name,
.order-card-items-section.is-order-cancelled .order-item-row.is-cancelled .order-item-total {
  color: var(--text);
}

.order-card-items-section.is-order-cancelled .order-item-row.is-cancelled .order-item-meta-chip,
.order-card-items-section.is-order-cancelled .order-item-row.is-cancelled .order-item-note-toggle,
.order-card-items-section.is-order-cancelled .order-item-row.is-cancelled .order-item-qty-read {
  color: var(--muted);
}

.order-item-row.is-cancel-pending {
  animation: cancelled-item-pulse 1.2s ease-in-out infinite;
}

.order-item-row.is-cancelled-flash {
  animation:
    item-flash 1s ease-out forwards,
    cancelled-item-pulse 1.4s ease-in-out 3;
}

.order-item-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.order-item-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.order-item-headline {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}

.order-item-name {
  flex: 1 1 220px;
  min-width: 0;
  font-weight: 600;
}

.order-item-meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--panel-alt-rgb), 0.1);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.order-item-note-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  width: 100%;
}

.order-item-note-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.72);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s, color 0.14s;
  flex: 0 0 auto;
}

.order-item-note-toggle.has-note,
.order-item-note-toggle.is-open {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.28);
  color: var(--ember-strong);
}

.order-item-note-toggle i { font-size: 0.82rem; }

.order-item-note-toggle:hover:not(:disabled),
.order-item-note-toggle:focus-visible {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.32);
  color: var(--ember-strong);
  outline: none;
}

.order-item-note-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.order-item-note-picker-chip {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.16);
  background: rgba(var(--panel-rgb), 0.78);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 700;
  transition: background 0.14s, border-color 0.14s, color 0.14s;
}

.order-item-note-picker-chip:hover:not(:disabled):not(.is-active) {
  background: rgba(var(--ember-rgb), 0.08);
  border-color: rgba(var(--ember-rgb), 0.2);
  color: var(--ember-strong);
}

.order-item-note-picker-chip.is-active {
  background: rgba(var(--ember-rgb), 0.14);
  border-color: rgba(var(--ember-rgb), 0.32);
  color: var(--ember-strong);
}

.order-item-note-picker-chip:disabled {
  opacity: 0.55;
}

.order-item-note-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
  border: 1px solid transparent;
}

.order-item-note-chip.is-spicy {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.18);
  color: var(--ember-strong);
}

.order-item-note-chip.is-sugar {
  background: rgba(181, 123, 46, 0.14);
  border-color: rgba(181, 123, 46, 0.18);
  color: #9a5d12;
}

.order-item-note-chip.is-veggies {
  background: rgba(var(--green-rgb), 0.12);
  border-color: rgba(var(--green-rgb), 0.18);
  color: var(--green);
}

.order-item-note-chip.is-sauce {
  background: rgba(75, 120, 181, 0.12);
  border-color: rgba(75, 120, 181, 0.18);
  color: #325f99;
}

.order-item-note-chip.is-salt,
.order-item-note-chip.is-custom {
  background: rgba(var(--panel-alt-rgb), 0.08);
  border-color: rgba(var(--muted-rgb), 0.16);
  color: var(--muted);
}

.order-item-note-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(var(--muted-rgb), 0.14);
}

.order-item-statuses {
  display: grid;
  gap: 8px;
  width: 100%;
}

.order-item-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 8px;
  align-self: start;
}

.order-item-total {
  font-weight: 800;
  color: var(--ember-strong);
  white-space: nowrap;
  text-align: right;
}

.order-item-editor {
  display: flex;
  align-items: center;
  gap: 6px;
}

.order-item-qty {
  min-width: 26px;
  height: 24px;
  padding: 0 5px;
  border-radius: 4px;
  background: #fff;
  box-shadow: inset 0 1px 3px rgba(var(--text-rgb), 0.14), inset 0 1px 1px rgba(var(--text-rgb), 0.1);
  text-align: center;
  font-weight: 400;
  font-size: 0.82rem;
  line-height: 24px;
  font-variant-numeric: tabular-nums;
}

.order-qty-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid rgba(var(--text-rgb), 0.1);
  background: #fff;
  box-shadow: 0 2px 4px rgba(var(--text-rgb), 0.12), 0 1px 2px rgba(var(--text-rgb), 0.08);
  color: var(--text);
  font-size: 0.85rem;
  line-height: 1;
}

.order-qty-btn:hover:not(:disabled) {
  background: #f5f5f5;
  box-shadow: 0 3px 6px rgba(var(--text-rgb), 0.14), 0 1px 2px rgba(var(--text-rgb), 0.08);
}

.order-qty-btn:active:not(:disabled) {
  background: #ebebeb;
  box-shadow: 0 1px 2px rgba(var(--text-rgb), 0.08);
}

.order-item-qty-read {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
}

@media (max-width: 576px) {
  .order-progress-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .order-item-main {
    gap: 8px;
  }

  .order-item-editor {
    gap: 6px;
  }

  .order-qty-btn,
  .order-item-qty,
  .order-item-qty-read {
    font-size: 0.78rem;
  }

  .order-item-qty-read {
    font-size: 0.78rem;
  }
}
</style>
