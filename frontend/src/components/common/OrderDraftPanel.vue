<template>
  <div
    :class="[
      'order-draft-panel',
      {
        'is-sticky': sticky,
        'is-compact': compact,
        'is-frameless': !framed,
      },
    ]"
  >
    <div v-if="showHeader" class="order-draft-panel__header">
      <div>
        <div v-if="eyebrow" class="order-draft-panel__eyebrow">{{ eyebrow }}</div>
        <h2>{{ title }}</h2>
        <p>{{ summary }}</p>
      </div>
      <RouterLink v-if="linkTo && linkLabel" :to="linkTo" class="order-draft-panel__link">
        {{ linkLabel }}
      </RouterLink>
    </div>

    <div v-if="showSummary" class="order-draft-panel__summary">
      <div class="order-draft-panel__summary-item">
        <span>Món đã chọn</span>
        <strong>{{ itemCount }}</strong>
      </div>
      <div class="order-draft-panel__summary-item">
        <span>Món khác nhau</span>
        <strong>{{ lines.length }}</strong>
      </div>
      <div class="order-draft-panel__summary-item">
        <span>Tạm tính</span>
        <strong>{{ formatMoney(totalAmount) }}</strong>
      </div>
    </div>

    <slot name="before-lines"></slot>

    <div v-if="lines.length === 0" class="order-draft-panel__empty">
      <div class="order-draft-panel__empty-icon">
        <i class="bi bi-basket3"></i>
      </div>
      <h3>{{ emptyTitle }}</h3>
      <p>{{ emptyDescription }}</p>
    </div>

    <div v-else class="order-draft-panel__lines">
      <article v-for="line in lines" :key="line.key" class="draft-line">
        <div class="draft-line__body">
          <div class="draft-line__name">{{ line.name }}</div>
          <div class="draft-line__meta">
            <span>{{ formatMoney(line.price) }}</span>
          </div>
          <div class="draft-line__note-row">
            <button
              class="draft-line__note-toggle"
              type="button"
              :disabled="disabled || submitting"
              @click="toggleLineNoteEditor(line.key)"
            >
              <i class="bi bi-chat-left-text"></i>
              <span>Ghi chú món</span>
            </button>
            <div v-if="hasLineNote(line.note)" class="draft-line__note-preview-list">
              <span
                v-for="noteChip in getPreviewNoteChips(line.note)"
                :key="`${line.key}-${noteChip.text}`"
                :class="['draft-line__note-preview', `is-${noteChip.tone}`]"
              >{{ noteChip.text }}</span>
            </div>
          </div>
          <div v-if="isLineNoteOpen(line.key)" class="draft-line__note-editor">
            <div class="order-draft-panel__note-chips order-draft-panel__note-chips--line">
              <template v-for="(group, gi) in NOTE_CHIP_GROUPS" :key="group.key">
                <span v-if="gi > 0" class="order-draft-panel__note-sep" aria-hidden="true"></span>
                <button
                  v-for="chip in group.chips"
                  :key="chip"
                  type="button"
                  :class="['order-draft-panel__note-chip', { 'is-active': isNoteChipActive(line.note || '', chip) }]"
                  :disabled="disabled || submitting"
                  @click="toggleLineChip(line.key, line.note || '', chip)"
                >{{ chip }}</button>
              </template>
            </div>
            <textarea
              :value="line.note || ''"
              rows="2"
              class="order-draft-panel__line-note-input"
              placeholder="Ghi chú riêng cho món này..."
              :disabled="disabled || submitting"
              @input="updateLineNote(line.key, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>
        </div>

        <div class="draft-stepper">
          <span class="draft-stepper__total">{{ formatMoney(line.price * line.quantity) }}</span>
          <div class="draft-stepper__row">
            <button
              class="draft-stepper__button"
              type="button"
              :disabled="disabled || submitting"
              @click="$emit('change-qty', { key: line.key, delta: -1 })"
            >
              <i class="bi bi-dash"></i>
            </button>
            <span class="draft-stepper__qty">{{ line.quantity }}</span>
            <button
              class="draft-stepper__button"
              type="button"
              :disabled="disabled || submitting"
              @click="$emit('change-qty', { key: line.key, delta: 1 })"
            >
              <i class="bi bi-plus"></i>
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="showArrival" class="order-draft-panel__field order-draft-panel__field--arrival">
      <span>{{ arrivalLabel }}</span>
      <div class="order-draft-panel__arrival-segment">
        <button type="button" :class="['order-draft-panel__arrival-seg', { 'is-active': arrivalMode === 'scheduled' }]" :disabled="disabled || submitting" @click="$emit('update:arrivalMode', 'scheduled'); if (!arrivalTime) $emit('update:arrivalTime', '13:30')">Có giờ hẹn</button>
        <button type="button" :class="['order-draft-panel__arrival-seg', { 'is-active': arrivalMode === 'unknown' }]"   :disabled="disabled || submitting" @click="$emit('update:arrivalMode', 'unknown')">Chưa xác định</button>
        <button type="button" :class="['order-draft-panel__arrival-seg', { 'is-active': arrivalMode === 'arrived' }]"   :disabled="disabled || submitting" @click="$emit('update:arrivalMode', 'arrived')">Đã tới bàn</button>
      </div>
      <div v-if="arrivalMode === 'scheduled'" class="order-draft-panel__time-shell">
        <i class="bi bi-clock order-draft-panel__time-clock"></i>
        <input
          :value="arrivalTime || '13:30'"
          class="order-draft-panel__time-input"
          type="time"
          min="13:00"
          max="21:00"
          :disabled="disabled || submitting"
          @change="$emit('update:arrivalTime', ($event.target as HTMLInputElement).value)"
        />
      </div>


      <small v-if="arrivalMode === 'scheduled' && arrivalPlaceholder" class="order-draft-panel__field-note">
        {{ arrivalPlaceholder }}
      </small>
    </div>

    <div v-if="showNote" class="order-draft-panel__field">
      <button
        class="order-draft-panel__section-toggle"
        type="button"
        :aria-expanded="orderNoteOpen ? 'true' : 'false'"
        :disabled="disabled || submitting"
        @click="orderNoteOpen = !orderNoteOpen"
      >
        <span>{{ noteLabel }}</span>
        <small v-if="hasLineNote(note) && !orderNoteOpen">Đã có ghi chú</small>
        <i :class="['bi', orderNoteOpen ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
      </button>
      <div v-if="orderNoteOpen" class="order-draft-panel__note-section">
        <div class="order-draft-panel__note-chips">
          <template v-for="(group, gi) in NOTE_CHIP_GROUPS" :key="group.key">
            <span v-if="gi > 0" class="order-draft-panel__note-sep" aria-hidden="true"></span>
            <button
              v-for="chip in group.chips"
              :key="chip"
              type="button"
              :class="['order-draft-panel__note-chip', { 'is-active': isNoteChipActive(note || '', chip) }]"
              :disabled="disabled || submitting"
              @click="toggleChip(chip)"
            >{{ chip }}</button>
          </template>
        </div>
        <textarea
          :value="note"
          rows="3"
          :placeholder="notePlaceholder"
          :disabled="disabled || submitting"
          @input="$emit('update:note', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
    </div>

    <div class="order-draft-panel__totals">
      <div class="order-draft-panel__total-row">
        <span>Tạm tính</span>
        <strong>{{ formatMoney(totalAmount) }}</strong>
      </div>
      <div class="order-draft-panel__total-row order-draft-panel__total-row--muted">
        <span>Phí dịch vụ</span>
        <strong>Miễn phí</strong>
      </div>
      <div class="order-draft-panel__total-row order-draft-panel__total-row--grand">
        <span>{{ totalLabel }}</span>
        <strong>{{ formatMoney(totalAmount) }}</strong>
      </div>
    </div>

    <button
      class="btn btn-ember order-draft-panel__submit"
      type="button"
      :disabled="disabled || submitting || submitDisabled"
      @click="$emit('submit')"
    >
      <span v-if="submitting">{{ submittingLabel }}</span>
      <span v-else>{{ submitLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { formatMoney } from "../../utils/format";
import { NOTE_CHIP_GROUPS, isNoteChipActive, parseNoteChips, toggleNoteChip } from "../../utils/noteChips";

type DraftLine = {
  key: string | number;
  name: string;
  price: number;
  quantity: number;
  note?: string | null;
};

const props = withDefaults(
  defineProps<{
    eyebrow?: string;
    title: string;
    summary: string;
    linkTo?: string;
    linkLabel?: string;
    lines: DraftLine[];
    arrivalTime: string;
    arrivalMode?: "scheduled" | "unknown" | "arrived";
    note: string;
    disabled?: boolean;
    submitDisabled?: boolean;
    submitting?: boolean;
    submitLabel?: string;
    submittingLabel?: string;
    totalLabel?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    arrivalLabel?: string;
    arrivalPlaceholder?: string;
    noteLabel?: string;
    notePlaceholder?: string;
    sticky?: boolean;
    showArrival?: boolean;
    showNote?: boolean;
    showHeader?: boolean;
    showSummary?: boolean;
    compact?: boolean;
    framed?: boolean;
  }>(),
  {
    eyebrow: "",
    linkTo: "",
    linkLabel: "",
    disabled: false,
    submitDisabled: false,
    submitting: false,
    submitLabel: "Gửi đơn",
    submittingLabel: "Đang xử lý...",
    totalLabel: "Tổng cần xác nhận",
    emptyTitle: "Chưa có món",
    emptyDescription: "Thêm món để bắt đầu tạo đơn.",
    arrivalMode: "unknown",
    arrivalLabel: "Giờ bạn muốn tới / nhận món",
    arrivalPlaceholder: "Nếu muốn tới ngay thì để trống",
    noteLabel: "Ghi chú cho cả đơn",
    notePlaceholder: "Ví dụ: khách đến muộn, tách hóa đơn, giao trước món nước...",
    sticky: false,
    showArrival: true,
    showNote: true,
    showHeader: true,
    showSummary: true,
    compact: false,
    framed: true,
  }
);

const emit = defineEmits<{
  "change-qty": [{ key: string | number; delta: number }];
  "remove-line": [key: string | number];
  "update:arrivalTime": [value: string];
  "update:arrivalMode": [value: "scheduled" | "unknown" | "arrived"];
  "update:note": [value: string];
  "update-line-note": [{ key: string | number; note: string }];
  submit: [];
}>();

const itemCount = computed(() =>
  props.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
);
const totalAmount = computed(() =>
  props.lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0)
);

function toggleChip(chip: string) {
  emit("update:note", toggleNoteChip(props.note || "", chip));
}

const orderNoteOpen = ref(Boolean(String(props.note || "").trim()));
const openLineNoteKeys = ref<Set<string>>(new Set());

watch(
  () => props.note,
  (value) => {
    if (String(value || "").trim()) {
      orderNoteOpen.value = true;
    }
  }
);

watch(
  () => props.lines.map((line) => String(line.key)).join("|"),
  () => {
    const validKeys = new Set(props.lines.map((line) => String(line.key)));
    openLineNoteKeys.value = new Set(
      Array.from(openLineNoteKeys.value).filter((key) => validKeys.has(key))
    );
  }
);

function hasLineNote(note?: string | null) {
  return Boolean(String(note || "").trim());
}

function getPreviewNoteChips(note?: string | null) {
  return parseNoteChips(note);
}

function isLineNoteOpen(key: string | number) {
  return openLineNoteKeys.value.has(String(key));
}

function toggleLineNoteEditor(key: string | number) {
  const normalized = String(key);
  const next = new Set(openLineNoteKeys.value);
  if (next.has(normalized)) {
    next.delete(normalized);
  } else {
    next.add(normalized);
  }
  openLineNoteKeys.value = next;
}

function updateLineNote(key: string | number, note: string) {
  emit("update-line-note", { key, note });
}

function toggleLineChip(key: string | number, note: string, chip: string) {
  emit("update-line-note", { key, note: toggleNoteChip(note || "", chip) });
}

</script>

<style scoped>
.order-draft-panel {
  display: grid;
  gap: 22px;
  padding: 24px;
  border-radius: 28px;
  border: 1px solid rgba(var(--muted-rgb), 0.08);
  background: rgba(var(--panel-rgb), 0.96);
  box-shadow: 0 28px 60px rgba(var(--panel-alt-rgb), 0.12);
}

.order-draft-panel.is-frameless {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.order-draft-panel.is-compact {
  gap: 14px;
}

.order-draft-panel.is-sticky {
  position: sticky;
  top: 96px;
}

.order-draft-panel__header {
  display: grid;
  gap: 14px;
}

.order-draft-panel__eyebrow {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.order-draft-panel h2 {
  margin: 0;
  color: var(--text);
}

.order-draft-panel p {
  margin: 6px 0 0;
  color: var(--muted);
}

.order-draft-panel__link {
  justify-self: start;
  font-weight: 700;
  color: var(--ember-strong);
  text-decoration: none;
}

.order-draft-panel__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.order-draft-panel__summary-item {
  padding: 16px;
  border-radius: 20px;
  background: rgba(var(--panel-rgb), 0.94);
  border: 1px solid rgba(var(--muted-rgb), 0.08);
}

.order-draft-panel__summary-item span {
  display: block;
  color: var(--muted);
  font-size: 0.82rem;
}

.order-draft-panel__summary-item strong {
  display: block;
  margin-top: 8px;
  color: var(--text);
  font-size: 1.08rem;
}

.order-draft-panel__empty {
  display: grid;
  gap: 14px;
  padding: 24px;
  border-radius: 24px;
  border: 1px dashed rgba(var(--muted-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.56);
}

.order-draft-panel__empty-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember);
  font-size: 1.3rem;
}

.order-draft-panel__empty h3 {
  margin: 0;
  color: var(--text);
}

.order-draft-panel__empty p {
  margin: 0;
}

.order-draft-panel__lines {
  display: grid;
  gap: 12px;
}

.draft-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-radius: 0;
  background: transparent;
  border: none;
  border-top: 1px dashed rgba(var(--muted-rgb), 0.2);
}

.draft-line__body {
  min-width: 0;
  flex: 1;
}

.draft-line__name {
  font-weight: 700;
  color: var(--text);
  font-size: 0.9rem;
}

.draft-line__meta {
  display: flex;
  gap: 6px;
  margin-top: 3px;
  color: var(--muted);
  font-size: 0.8rem;
  align-items: center;
}

.draft-line__note-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: 8px;
}

.draft-line__note-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.72);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s, color 0.14s;
}

.draft-line__note-toggle:hover:not(:disabled),
.draft-line__note-toggle:focus-visible {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.32);
  color: var(--ember-strong);
  outline: none;
}

.draft-line__note-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.draft-line__note-preview {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  max-width: 100%;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.25;
  border: 1px solid transparent;
}

.draft-line__note-preview.is-spicy {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.18);
  color: var(--ember-strong);
}

.draft-line__note-preview.is-sugar {
  background: rgba(181, 123, 46, 0.14);
  border-color: rgba(181, 123, 46, 0.18);
  color: #9a5d12;
}

.draft-line__note-preview.is-veggies {
  background: rgba(var(--green-rgb), 0.12);
  border-color: rgba(var(--green-rgb), 0.18);
  color: var(--green);
}

.draft-line__note-preview.is-sauce {
  background: rgba(75, 120, 181, 0.12);
  border-color: rgba(75, 120, 181, 0.18);
  color: #325f99;
}

.draft-line__note-preview.is-salt,
.draft-line__note-preview.is-custom {
  background: rgba(var(--panel-alt-rgb), 0.08);
  border-color: rgba(var(--muted-rgb), 0.16);
  color: var(--muted);
}

.draft-line__note-editor {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 18px;
  background: rgba(var(--panel-rgb), 0.6);
  border: 1px dashed rgba(var(--muted-rgb), 0.18);
}

.draft-line__total {
  font-weight: 700;
  color: var(--text);
  margin-left: auto;
}

.draft-stepper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.draft-stepper__button {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.1s;
}

.draft-stepper__button:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.3);
  color: var(--ember-strong);
}

.draft-stepper__total {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ember-strong);
  white-space: nowrap;
}

.draft-stepper__row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.draft-stepper__qty {
  min-width: 22px;
  text-align: center;
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--text);
}

.order-draft-panel__field {
  display: grid;
  gap: 10px;
}

.order-draft-panel__field--arrival {
  gap: 8px;
}

.order-draft-panel__arrival-segment {
  display: flex;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 10px;
  overflow: hidden;
}

.order-draft-panel__arrival-seg {
  flex: 1;
  padding: 7px 6px;
  font-size: 0.8rem;
  font-weight: 500;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.order-draft-panel__arrival-seg + .order-draft-panel__arrival-seg {
  border-left: 1px solid rgba(0, 0, 0, 0.14);
}

.order-draft-panel__arrival-seg.is-active {
  background: #c9582c;
  color: #fff;
  font-weight: 700;
}

.order-draft-panel__arrival-seg:disabled {
  opacity: 0.5;
  cursor: default;
}

.order-draft-panel__field span {
  font-weight: 700;
  color: var(--text);
}

.order-draft-panel__section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  color: var(--text);
}

.order-draft-panel__section-toggle span {
  font-weight: 700;
}

.order-draft-panel__section-toggle small {
  margin-left: auto;
  color: var(--muted);
  font-size: 0.78rem;
}

.order-draft-panel__section-toggle i {
  color: var(--muted);
}

.order-draft-panel__note-section {
  display: grid;
  gap: 10px;
}

.order-draft-panel__field-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.order-draft-panel__field textarea,
.order-draft-panel__field input {
  width: 100%;
  border: 1px solid rgba(var(--muted-rgb), 0.14);
  border-radius: 20px;
  padding: 14px 16px;
  background: rgba(var(--panel-rgb), 0.8);
  color: var(--text);
  font: inherit;
}

.order-draft-panel__time-shell {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.order-draft-panel__time-clock {
  position: absolute;
  left: 10px;
  color: var(--ember);
  font-size: 0.95rem;
  pointer-events: none;
  z-index: 1;
}

.order-draft-panel__time-input {
  padding-left: 30px;
}

.order-draft-panel__time-input {
  flex: 1 1 140px;
  min-width: 0;
  min-height: 0;
  height: auto;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 1rem;
  font-weight: 700;
}

.order-draft-panel__time-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.72;
}


.order-draft-panel__note-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.order-draft-panel__note-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.2);
  background: rgba(var(--panel-rgb), 0.8);
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.order-draft-panel__note-chip:hover:not(:disabled):not(.is-active) {
  background: rgba(var(--ember-rgb), 0.1);
  border-color: rgba(var(--ember-rgb), 0.3);
  color: var(--ember-strong);
}

.order-draft-panel__note-chip.is-active {
  background: rgba(var(--ember-rgb), 0.15);
  border-color: rgba(var(--ember-rgb), 0.5);
  color: var(--ember-strong);
  font-weight: 700;
}

.order-draft-panel__note-chip.is-active:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.08);
  border-color: rgba(var(--ember-rgb), 0.3);
}

.order-draft-panel__note-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

.order-draft-panel__note-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(var(--muted-rgb), 0.2);
  margin: 2px 2px;
  flex-shrink: 0;
}

.order-draft-panel__field textarea {
  resize: vertical;
  min-height: 84px;
}

.order-draft-panel__line-note-input {
  min-height: 72px !important;
}

.order-draft-panel__field textarea:focus,
.order-draft-panel__field input:focus {
  outline: none;
}

.order-draft-panel__totals {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.order-draft-panel__total-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: var(--text);
  font-weight: 600;
}

.order-draft-panel__total-row--muted {
  color: var(--muted);
}

.order-draft-panel__total-row--grand {
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--muted-rgb), 0.18);
  font-size: 1.05rem;
}

.order-draft-panel__submit {
  width: 100%;
  min-height: 52px;
  font-size: 1rem;
  font-weight: 700;
}

.order-draft-panel.is-compact .order-draft-panel__empty {
  gap: 10px;
  padding: 16px;
  border-radius: 16px;
}

.order-draft-panel.is-compact .order-draft-panel__empty-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  font-size: 1rem;
}

.order-draft-panel.is-compact .order-draft-panel__lines {
  gap: 8px;
}

.order-draft-panel.is-compact .draft-line {
  gap: 8px;
  padding: 6px 2px;
}

.order-draft-panel.is-compact .draft-stepper__button {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.order-draft-panel.is-compact .order-draft-panel__field {
  gap: 6px;
}

.order-draft-panel.is-compact .order-draft-panel__field span {
  font-size: 0.88rem;
}

.order-draft-panel.is-compact .order-draft-panel__field-note {
  font-size: 0.76rem;
}

.order-draft-panel.is-compact .order-draft-panel__field textarea,
.order-draft-panel.is-compact .order-draft-panel__field input {
  border-radius: 14px;
  padding: 10px 12px;
}

.order-draft-panel.is-compact .order-draft-panel__time-input {
  font-size: 0.95rem;
}

.order-draft-panel.is-compact .order-draft-panel__field textarea {
  min-height: 84px;
}

.order-draft-panel.is-compact .order-draft-panel__totals {
  gap: 8px;
  padding-top: 0;
}

.order-draft-panel.is-compact .order-draft-panel__total-row {
  font-size: 0.92rem;
}

.order-draft-panel.is-compact .order-draft-panel__total-row--grand {
  margin-top: 0;
  padding-top: 10px;
  font-size: 0.98rem;
}

.order-draft-panel.is-compact .order-draft-panel__submit {
  min-height: 44px;
  font-size: 0.95rem;
}

@media (max-width: 1199px) {
  .order-draft-panel.is-sticky {
    position: static;
  }
}

@media (max-width: 991px) {
  .order-draft-panel {
    padding: 22px;
    border-radius: 26px;
  }

  .order-draft-panel__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .order-draft-panel {
    gap: 18px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
  }

  .order-draft-panel__summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .draft-line {
    gap: 8px;
  }
}
</style>
