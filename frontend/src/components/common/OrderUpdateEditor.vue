<template>
  <div v-if="visible" class="order-editor-accordion">
    <div class="order-editor-accordion__head">
      <div class="order-editor-accordion__copy">
        <span class="order-field-label">{{ title }}</span>
        <button
          type="button"
          class="order-editor-accordion__toggle"
          :aria-expanded="editPanelOpen ? 'true' : 'false'"
          :title="editPanelOpen ? collapseTitle : expandTitle"
          @click="$emit('update:editPanelOpen', !editPanelOpen)"
        >
          <i class="bi bi-pencil-square"></i>
        </button>
      </div>
    </div>

    <div v-if="editPanelOpen" class="order-editor-panel">
      <div class="order-arrival-row order-arrival-row--stacked order-editor-meta-row">
        <div class="order-arrival-field">
          <span class="order-field-label">{{ arrivalLabel }}</span>
          <div class="order-arrival-time-shell">
            <i class="bi bi-clock order-arrival-time-icon" aria-hidden="true"></i>
            <input
              :value="arrivalTimeDraft"
              type="time"
              class="form-control order-arrival-time-input"
              :disabled="busy"
              :min="timeMin"
              :max="timeMax"
              :placeholder="arrivalPlaceholder"
              @input="handleArrivalInput"
              @change="handleArrivalInput"
            />
          </div>
        </div>

        <div class="order-arrival-field">
          <span class="order-field-label">{{ guestCountLabel }}</span>
          <input
            :value="guestCountDraft"
            type="number"
            min="1"
            inputmode="numeric"
            class="form-control order-select order-guest-count-input"
            :placeholder="guestCountPlaceholder"
            :disabled="busy"
            @input="handleGuestCountInput"
          />
        </div>

        <div class="order-editor-meta-action">
          <button
            class="btn order-add-btn order-add-launch-btn"
            type="button"
            :disabled="addButtonDisabled"
            :aria-label="addButtonTitle"
            :title="addButtonTitle"
            @click="$emit('openPicker')"
          >
            <i class="bi bi-clipboard-plus order-add-launch-icon"></i>
          </button>
        </div>
      </div>

      <div v-if="hasMenuOptions" class="order-add-hint">
        {{ addHintText }}
      </div>
      <div v-else class="order-add-hint">
        {{ emptyAddHintText }}
      </div>
    </div>
  </div>

  <div v-if="hasPendingSaveChanges" class="order-editor-actions order-editor-actions--outside">
    <div v-if="showSaveNote" class="order-editor-note">{{ saveNoteText }}</div>
    <button class="btn btn-dark" type="button" :disabled="busy" @click="$emit('save')">
      {{ isSaving ? savingText : saveText }}
    </button>
    <button class="btn btn-outline-dark" type="button" :disabled="busy" @click="$emit('discard')">
      {{ discardText }}
    </button>
  </div>

  <OrderItemPickerModal
    v-if="pickerOpen"
    :open="pickerOpen"
    :busy="busy"
    :buckets="pickerBuckets"
    :open-bucket-names="openBucketNames"
    :selected-key="selectedKey"
    :selected-group-label="selectedGroupLabel"
    :method-items="pickerMethodItems"
    :multi-select-mode="pickerMultiSelectMode"
    :can-select-item="pickerCanSelectItem"
    :get-method-label="pickerGetMethodLabel"
    @close="$emit('closePicker')"
    @toggle-bucket="$emit('togglePickerBucket', $event)"
    @select-group="$emit('selectPickerGroup', $event)"
    @select-item="$emit('selectPickerItem', $event)"
    @update:multiSelectMode="$emit('update:pickerMultiSelectMode', $event)"
  />
</template>

<script setup lang="ts">
import OrderItemPickerModal from "./OrderItemPickerModal.vue";

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
    visible: boolean;
    busy: boolean;
    isSaving: boolean;
    editPanelOpen: boolean;
    arrivalTimeDraft: string;
    guestCountDraft: string;
    timeMin?: string;
    timeMax?: string;
    title?: string;
    expandTitle?: string;
    collapseTitle?: string;
    arrivalLabel?: string;
    guestCountLabel?: string;
    arrivalPlaceholder?: string;
    guestCountPlaceholder?: string;
    addButtonTitle?: string;
    addButtonDisabled?: boolean;
    hasMenuOptions: boolean;
    addHintText?: string;
    emptyAddHintText?: string;
    hasPendingSaveChanges: boolean;
    showSaveNote?: boolean;
    saveNoteText?: string;
    saveText?: string;
    savingText?: string;
    discardText?: string;
    pickerOpen: boolean;
    pickerBuckets: PickerBucket[];
    openBucketNames: string[];
    selectedKey: string | null;
    selectedGroupLabel?: string | null;
    pickerMethodItems: PickerMethodItem[];
    pickerMultiSelectMode?: boolean;
    pickerCanSelectItem?: (item: PickerMethodItem) => boolean;
    pickerGetMethodLabel?: (item: PickerMethodItem, ingredientLabel: string) => string;
  }>(),
  {
    title: "Cập nhật đơn",
    expandTitle: "Mở rộng",
    collapseTitle: "Thu gọn",
    arrivalLabel: "Giờ hẹn",
    guestCountLabel: "Số người",
    arrivalPlaceholder: "Giờ hẹn",
    guestCountPlaceholder: "Số người",
    addButtonTitle: "Thêm món",
    addButtonDisabled: false,
    addHintText: "Bấm nút thêm món để mở danh sách món.",
    emptyAddHintText: "Hôm nay không còn món khả dụng để thêm vào đơn này.",
    showSaveNote: false,
    saveNoteText: "",
    saveText: "Lưu",
    savingText: "Đang lưu...",
    discardText: "Bỏ thay đổi",
    timeMin: undefined,
    timeMax: undefined,
    selectedGroupLabel: null,
    pickerMultiSelectMode: false,
  }
);

const emit = defineEmits<{
  "update:editPanelOpen": [value: boolean];
  "update:arrivalTimeDraft": [value: string];
  "update:guestCountDraft": [value: string];
  "update:pickerMultiSelectMode": [value: boolean];
  arrivalInput: [];
  openPicker: [];
  save: [];
  discard: [];
  closePicker: [];
  togglePickerBucket: [bucketName: string];
  selectPickerGroup: [key: string];
  selectPickerItem: [item: PickerMethodItem];
}>();

function handleArrivalInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit("update:arrivalTimeDraft", target?.value ?? "");
  emit("arrivalInput");
}

function handleGuestCountInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit("update:guestCountDraft", target?.value ?? "");
}
</script>

<style scoped>
.order-editor-accordion {
  display: grid;
  gap: 10px;
}

.order-editor-accordion__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-editor-accordion__copy {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-editor-accordion__toggle {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
}

.order-editor-accordion__toggle:hover,
.order-editor-accordion__toggle:focus-visible {
  background: rgba(var(--text-rgb), 0.1);
  color: var(--text);
  outline: none;
}

.order-editor-accordion__toggle i {
  font-size: 0.82rem;
}

.order-editor-panel {
  display: grid;
  gap: 12px;
}

.order-arrival-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-arrival-row--stacked {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.order-editor-meta-row {
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 0.6fr) auto;
  align-items: end;
  gap: 6px 8px;
}

.order-arrival-field {
  min-width: 0;
}

.order-editor-meta-action {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.order-arrival-time-shell {
  position: relative;
  min-width: 0;
}

.order-arrival-time-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.82rem;
  color: var(--muted);
  pointer-events: none;
  z-index: 1;
}

.order-arrival-time-input {
  flex: 1;
  min-width: 0;
  min-height: 34px;
  height: 34px;
  border-radius: 12px;
  padding-left: 30px;
  font-size: 0.88rem;
}

.order-guest-count-input {
  width: 100%;
  min-height: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 0.88rem;
}

.order-field-label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.order-select {
  min-height: 46px;
  border-radius: 16px;
}

.order-add-hint {
  color: var(--muted);
  font-size: 0.85rem;
}

.order-add-btn {
  width: 46px;
  min-width: 46px;
  height: 46px;
  padding: 0;
  border-radius: 16px;
  font-size: 1.2rem;
  line-height: 1;
}

.order-add-launch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 33px;
  min-width: 33px;
  height: 33px;
  min-height: 33px;
  padding: 0 !important;
  border: none;
  border-radius: 8px;
  line-height: 1;
  align-self: end;
  margin: 0;
  background: rgba(var(--ember-rgb), 0.12);
  color: var(--ember-strong);
  border: 1px solid rgba(var(--ember-rgb), 0.18);
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.order-add-launch-btn:hover,
.order-add-launch-btn:focus-visible {
  background: rgba(var(--ember-rgb), 0.18);
  border-color: rgba(var(--ember-rgb), 0.26);
  transform: translateY(-1px);
}

.order-add-launch-btn i,
.order-add-launch-icon {
  display: block;
  font-size: 1rem;
}

.order-editor-meta-row .order-guest-count-input.order-select {
  min-height: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 0.88rem;
}

.order-editor-meta-row .order-add-launch-btn.order-add-btn {
  width: 33px;
  min-width: 33px;
  height: 33px;
  min-height: 33px;
  padding: 0 !important;
  border-radius: 8px;
}

.order-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.order-editor-actions--outside {
  margin-top: 2px;
}

.order-editor-note {
  width: 100%;
  color: var(--muted);
  font-size: 0.85rem;
}

@media (pointer: coarse) {
  .order-arrival-time-input {
    appearance: none;
    -webkit-appearance: none;
  }

  .order-arrival-time-input::-webkit-calendar-picker-indicator {
    opacity: 0;
  }
}
</style>
