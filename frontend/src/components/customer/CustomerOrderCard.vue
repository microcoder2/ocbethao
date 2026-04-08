<template>
  <OrderCardShell
    v-model:collapsed="collapsed"
    :tone="statusTone"
    :total-text="formatMoney(displayTotal)"
    :info-aria-label="`Thông tin đơn ${order.orderNumber}`"
    :info-lines="infoTooltipLines"
    :arrival-text="order.arrivalAt ? queueTime : 'Chưa xác định'"
    :item-count-text="`${editableItems.length} món`"
    :status-text="statusLabel"
  >
    <template #head-main>
      <div class="order-head-label">{{ order.orderNumber }}</div>
    </template>
      <OrderCardItemsSection
        :items="editableItems"
        :busy="busy"
        :highlighted-key="highlightedKey"
        :show-progress="showProgressBar"
        :progress-text="progressText"
        :progress-segments="progressSegments"
        :progress-legend="progressLegend"
        :show-item-statuses="showItemStatuses"
        :cancelled-order="simpleStatus === 'CANCELLED'"
        :extra-row-classes="getItemRowClasses"
        :can-edit-item-note="canEditItemNote"
        :is-item-note-editor-open="isItemNoteEditorOpen"
        :can-adjust-item="canAdjustItem"
        :get-displayed-total="getItemDisplayedTotal"
        :get-quantity-label="getItemQuantityLabel"
        @change-qty="changeQty"
        @toggle-item-note-editor="toggleItemNoteEditor"
        @toggle-item-note-chip="toggleItemNoteChip"
      >
        <template #item-statuses="{ item }">
          <OrderCardItemStatuses
            :chips="getItemStatusChips(item)"
            :actions="getItemStatusActions(item)"
            @trigger-action="handleItemStatusAction(item, $event)"
          />
        </template>
      </OrderCardItemsSection>

      <div v-if="canEdit" class="order-editor-panel">
        <div class="order-add-row">
          <div class="order-add-field">
            <span class="order-field-label">Cập nhật đơn</span>
            <div :class="['order-add-control', { 'is-time-only': !menuOptions.length }]">
              <button
                type="button"
                :class="['btn order-add-btn order-time-toggle', arrivalEditOpen ? 'btn-secondary' : 'btn-outline-secondary']"
                :title="arrivalEditOpen ? 'Đóng chỉnh giờ' : 'Chỉnh giờ hẹn'"
                :aria-pressed="arrivalEditOpen"
                @click="arrivalEditOpen = !arrivalEditOpen"
              ><i class="bi bi-clock"></i></button>
              <select v-if="menuOptions.length" v-model="addSelection" class="form-select order-select" :disabled="busy">
                <option value="">Chọn món để thêm</option>
                <option v-for="option in menuOptions" :key="option.id" :value="String(option.id)">
                  {{ option.menuItem.name }} · {{ formatMoney(option.sellingPrice) }}
                </option>
              </select>
              <div v-else class="order-add-empty">Mở chỉnh giờ hẹn cho đơn</div>
              <button
                v-if="menuOptions.length"
                class="btn btn-outline-dark order-add-btn"
                type="button"
                :disabled="busy || !addSelection"
                aria-label="Thêm món"
                title="Thêm món"
                @click="addItem"
              >+</button>
            </div>
          </div>
        </div>
        <div v-if="arrivalEditOpen" class="order-arrival-row">
          <div class="order-add-field">
            <span class="order-field-label">Giờ hẹn</span>
            <div class="order-arrival-control">
              <i class="bi bi-clock"></i>
              <input
                v-model="arrivalTimeDraft"
                type="time"
                class="form-control order-arrival-time-input"
                :disabled="busy"
                placeholder="--:--"
                min="10:00"
                max="23:00"
              />
            </div>
          </div>
        </div>
        <div v-if="!menuOptions.length" class="order-add-hint">Hôm nay không còn món khả dụng để thêm vào đơn này.</div>

        <div v-if="draftChanged || arrivalChanged" class="order-editor-actions">
          <div class="order-editor-note">Lưu thay đổi món hoặc giờ hẹn trước khi tiếp tục.</div>
          <button class="btn btn-dark" type="button" :disabled="busy" @click="emitSave">
            {{ isSaving ? "Đang lưu..." : "Lưu" }}
          </button>
          <button class="btn btn-outline-dark" type="button" :disabled="busy" @click="discardDraft">
            Bỏ thay đổi
          </button>
        </div>
      </div>

      <div v-if="canCancelOrder" class="order-actions">
        <button
          class="btn btn-outline-danger"
          type="button"
          :disabled="busy || draftChanged"
          @click="$emit('requestCancel')"
        >
          {{ isCancelling ? "Đang hủy..." : "Hủy đơn" }}
        </button>
      </div>

      <p v-if="errorMessage" class="order-error">
        <i class="bi bi-exclamation-circle"></i>
        <span>{{ errorMessage }}</span>
      </p>

    <div
      v-if="removeDialog.visible"
      class="orders-modal-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="removeDialog.visible = false"
    >
      <div class="orders-modal">
        <div class="orders-modal-title">Xóa món khỏi đơn?</div>
        <p class="orders-modal-text">
          Giảm về 0 sẽ xóa <strong>{{ removeDialog.itemName }}</strong> khỏi đơn.
        </p>
        <div class="orders-modal-actions">
          <button class="btn btn-outline-dark" type="button" @click="removeDialog.visible = false">Giữ lại</button>
          <button class="btn btn-danger" type="button" @click="confirmRemove">Xóa món</button>
        </div>
      </div>
    </div>
  </OrderCardShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import OrderCardShell from "../common/OrderCardShell.vue";
import OrderCardItemsSection from "../common/OrderCardItemsSection.vue";
import OrderCardItemStatuses from "../common/OrderCardItemStatuses.vue";
import { buildOrderCardProgressSegments } from "../common/orderCardProgress";
import { formatMoney } from "../../utils/format";
import { toggleNoteChip } from "../../utils/noteChips";

type OrderItem = {
  id: number;
  menuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lineTotal: number;
  note?: string | null;
};

type OrderRecord = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
   guestName?: string | null;
   guestPhone?: string | null;
  arrivalAt?: string | null;
  createdAt: string;
  items?: OrderItem[];
  itemProgress?: { total: number; ready: number };
   customer?: { fullName?: string | null; phone?: string | null } | null;
};

type MenuOption = {
  id: number;
  menuItemId?: number | null;
  sellingPrice: number;
  isAvailable: boolean;
  menuItem: { id: number; name: string };
};

type EditableItem = {
  id?: number | null;
  key: string;
  menuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lineTotal: number;
  note?: string | null;
};

type SavePayload = { menuItemId?: number; quantity: number; note?: string };

const props = defineProps<{
  order: OrderRecord;
  menuOptions: MenuOption[];
  busy: boolean;
  isSaving: boolean;
  isCancelling: boolean;
  cancellingItemId?: number | null;
  errorMessage?: string;
}>();

const emit = defineEmits<{
  saveItems: [items: SavePayload[], arrivalTime?: string];
  requestCancel: [];
  requestCancelItem: [itemId: number];
}>();

const collapsed = ref(["COMPLETED", "CANCELLED"].includes(props.order.status));
const addSelection = ref("");
const highlightedKey = ref<string | null>(null);
const draft = ref<EditableItem[] | null>(null);
const arrivalTimeDraft = ref(props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "");
const arrivalEditOpen = ref(false);
const removeDialog = reactive({ visible: false, index: -1, itemName: "" });
const openItemNoteKeys = ref<Set<string>>(new Set());

watch(
  () =>
    `${props.order.status}|${(props.order.items || [])
      .map((item) => `${item.menuItemId}:${item.quantity}:${item.note ?? ""}`)
      .join("|")}`,
  () => {
    draft.value = null;
    addSelection.value = "";
    arrivalTimeDraft.value = props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "";
    arrivalEditOpen.value = false;
    openItemNoteKeys.value = new Set();
  }
);

watch(
  () => (draft.value ?? cloneItems(props.order.items)).map((item) => item.key).join("|"),
  () => {
    const validKeys = new Set((draft.value ?? cloneItems(props.order.items)).map((item) => item.key));
    openItemNoteKeys.value = new Set(
      Array.from(openItemNoteKeys.value).filter((key) => validKeys.has(key))
    );
  }
);

function simplifyStatus(status: string) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "PENDING") return "PENDING";
  return "CONFIRMED";
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function cloneItems(items: OrderItem[] = []): EditableItem[] {
  return items.map((item, index) => ({
    id: item.id,
    key: `${item.menuItemId ?? "item"}-${index}`,
    menuItemId: item.menuItemId ?? null,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    status: item.status || "WAITING",
    lineTotal: Number(item.lineTotal || 0),
    note: item.note ?? null,
  }));
}

function ensureDraft() {
  if (!draft.value) {
    draft.value = cloneItems(props.order.items);
  }
}

function setItemNote(index: number, note: string) {
  ensureDraft();
  const item = draft.value?.[index];
  if (!item) return;
  draft.value![index] = {
    ...item,
    note,
  };
}

function toggleItemNoteChip(index: number, chip: string) {
  const item = editableItems.value[index];
  if (!item) return;
  setItemNote(index, toggleNoteChip(item.note || "", chip));
}

function isItemNoteEditorOpen(key: string) {
  return openItemNoteKeys.value.has(key);
}

function toggleItemNoteEditor(key: string) {
  const next = new Set(openItemNoteKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  openItemNoteKeys.value = next;
}

function openItemNoteEditor(key: string) {
  const next = new Set(openItemNoteKeys.value);
  next.add(key);
  openItemNoteKeys.value = next;
}

function discardDraft() {
  draft.value = null;
  addSelection.value = "";
  arrivalTimeDraft.value = initialArrivalTime.value;
  arrivalEditOpen.value = false;
  openItemNoteKeys.value = new Set();
}

function flashItem(key: string) {
  highlightedKey.value = key;
  window.setTimeout(() => {
    if (highlightedKey.value === key) {
      highlightedKey.value = null;
    }
  }, 1200);
}

function changeQty(index: number, delta: number) {
  ensureDraft();
  const item = draft.value?.[index];
  if (!item) return;
  const next = item.quantity + delta;
  if (next <= 0) {
    removeDialog.visible = true;
    removeDialog.index = index;
    removeDialog.itemName = item.itemNameSnapshot;
    return;
  }
  draft.value![index] = {
    ...item,
    quantity: next,
    lineTotal: next * item.unitPrice,
  };
}

function confirmRemove() {
  if (draft.value && removeDialog.index >= 0) {
    draft.value = draft.value.filter((_, index) => index !== removeDialog.index);
  }
  removeDialog.visible = false;
  removeDialog.index = -1;
}

function addItem() {
  const selectedId = Number(addSelection.value || 0);
  if (!selectedId) return;
  const option = props.menuOptions.find((item) => item.id === selectedId);
  if (!option) return;
  const optionMenuItemId = Number(option.menuItemId ?? option.menuItem.id);

  ensureDraft();
  const existingIndex = draft.value!.findIndex(
    (item) =>
      item.menuItemId === optionMenuItemId
  );
  if (existingIndex >= 0) {
    const current = draft.value![existingIndex];
    draft.value![existingIndex] = {
      ...current,
      quantity: current.quantity + 1,
      lineTotal: (current.quantity + 1) * current.unitPrice,
    };
    flashItem(current.key);
    openItemNoteEditor(current.key);
  } else {
    const key = `new-${optionMenuItemId}`;
    draft.value!.push({
      id: null,
      key,
      menuItemId: optionMenuItemId,
      itemNameSnapshot: option.menuItem.name,
      unitPrice: Number(option.sellingPrice || 0),
      quantity: 1,
      status: "WAITING",
      lineTotal: Number(option.sellingPrice || 0),
      note: "",
    });
    flashItem(key);
    openItemNoteEditor(key);
  }
  addSelection.value = "";
}

function emitSave() {
  emit(
    "saveItems",
    editableItems.value.map((item) => ({
      menuItemId: item.menuItemId ?? undefined,
      quantity: item.quantity,
      note: item.note || undefined,
    })),
    arrivalChanged.value ? arrivalTimeDraft.value : undefined
  );
}

function canEditItemNote(item: EditableItem) {
  return canEdit.value && item.status !== "CANCELLED";
}

const simpleStatus = computed(() => simplifyStatus(props.order.status));
const statusTone = computed(() => simpleStatus.value.toLowerCase());

const statusLabel = computed(() => {
  const status = simpleStatus.value;
  if (status === "PENDING") return "Chờ xác nhận";
  if (status === "CONFIRMED") return "Đang xử lý";
  if (status === "COMPLETED") return "Hoàn tất";
  return "Đã hủy";
});

const customerName = computed(() => props.order.customer?.fullName || props.order.guestName || "Khách hàng");
const customerPhone = computed(() => props.order.guestPhone || props.order.customer?.phone || "Không có SĐT");
const infoTooltipLines = computed(() => [
  `Khách: ${customerName.value} - ${customerPhone.value}`,
  `Giờ đặt: ${formatTime(props.order.createdAt)}`,
]);
const queueTime = computed(() => formatTime(props.order.arrivalAt));
const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));
const initialArrivalTime = computed(() => (props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : ""));
const hasProgress = computed(() => Boolean(props.order.itemProgress?.total));
const showProgressBar = computed(() => hasProgress.value && simpleStatus.value === "CONFIRMED");
const showItemStatuses = computed(() => simpleStatus.value === "CONFIRMED");
const readyCount = computed(() => Number(props.order.itemProgress?.ready || 0));
const pendingCount = computed(() => Math.max(0, Number(props.order.itemProgress?.total || 0) - readyCount.value));
const readyPct = computed(() => {
  const total = Number(props.order.itemProgress?.total || 0);
  if (!total) return 0;
  return (readyCount.value / total) * 100;
});
const pendingPct = computed(() => {
  const total = Number(props.order.itemProgress?.total || 0);
  if (!total) return 0;
  return (pendingCount.value / total) * 100;
});
const progressText = computed(() => {
  if (!props.order.itemProgress?.total) return "Chưa có món";
  return `${readyCount.value}/${props.order.itemProgress.total} món sẵn sàng`;
});
const progressSegments = computed(() => buildOrderCardProgressSegments([
  { key: "waiting", tone: "waiting", width: pendingPct.value },
  { key: "ready", tone: "ready", width: readyPct.value },
]));
const progressLegend = computed(() => {
  if (!props.order.itemProgress?.total) return [];
  return [
    `Đang chờ ${pendingCount.value}`,
    `Sẵn sàng ${readyCount.value}`,
  ];
});
const draftChanged = computed(() => {
  if (!draft.value) return false;
  const original = cloneItems(props.order.items)
    .map((item) => `${item.menuItemId}:${item.quantity}:${item.note ?? ""}`)
    .join("|");
  const current = draft.value
    .map((item) => `${item.menuItemId}:${item.quantity}:${item.note ?? ""}`)
    .join("|");
  return original !== current;
});
const arrivalChanged = computed(() => {
  const next = String(arrivalTimeDraft.value || "").trim();
  if (!next) return false;
  return next !== initialArrivalTime.value;
});
const canEdit = computed(() => simplifyStatus(props.order.status) === "PENDING");
const canCancelOrder = computed(() => simpleStatus.value === "PENDING");
const displayTotal = computed(() => {
  if (!draftChanged.value) return Number(props.order.totalAmount || 0);
  return editableItems.value.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
});

function canCancelWaitingItem(item: EditableItem) {
  return (
    simpleStatus.value === "CONFIRMED" &&
    item.status === "WAITING" &&
    typeof item.id === "number" &&
    item.id > 0
  );
}

function canAdjustItem(item: EditableItem) {
  return canEdit.value;
}

function getItemDisplayedTotal(item: EditableItem) {
  return item.status === "CANCELLED" ? 0 : Number(item.lineTotal || 0);
}

function getItemQuantityLabel(item: EditableItem) {
  return `x${Math.max(0, Number(item.quantity || 0))}`;
}

function getItemRowClasses(item: EditableItem) {
  return {
    "is-cancel-pending": props.cancellingItemId === item.id,
  };
}

function getItemStatusLabel(status?: string | null) {
  if (status === "READY") return "Lên món";
  if (status === "COOKING") return "Đang làm";
  if (status === "CANCELLED") return "Đã hủy";
  return "Đang chờ";
}

function getItemStatusChips(item: EditableItem) {
  return [{
    key: `${item.key}-status`,
    label: getItemStatusLabel(item.status),
    toneClass: `is-${String(item.status || "WAITING").toLowerCase()}`,
    active: true,
  }];
}

function getItemStatusActions(item: EditableItem) {
  if (!canCancelWaitingItem(item)) {
    return [];
  }

  const isCancellingItem = props.cancellingItemId === item.id;
  return [{
    key: "cancel",
    label: "",
    toneClass: "is-cancelled",
    disabled: props.busy,
    title: isCancellingItem ? "Đang hủy món" : "Hủy món này",
    iconClass: isCancellingItem ? "bi-arrow-repeat" : "bi-trash3",
    iconSide: "end",
    iconOnly: true,
    ariaLabel: isCancellingItem ? "Đang hủy món" : "Hủy món này",
    active: false,
    showCount: false,
  }];
}

function handleItemStatusAction(item: EditableItem, actionKey: string) {
  if (actionKey === "cancel" && item.id) {
    emit("requestCancelItem", item.id);
  }
}
</script>

<style scoped>
.order-head-label {
  font-size: 0.96rem;
  font-weight: 800;
  color: var(--text);
}
.order-editor-panel { display: grid; gap: 12px; }
.order-arrival-row { display: grid; gap: 10px; }
.order-add-row,
.order-editor-actions,
.order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.order-add-row { display: grid; gap: 10px; }
.order-add-field { display: grid; gap: 8px; min-width: 0; }

.order-field-label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.order-add-control {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.order-add-control.is-time-only {
  grid-template-columns: auto minmax(0, 1fr);
}

.order-add-empty {
  min-height: 46px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px dashed rgba(var(--text-rgb), 0.16);
  background: rgba(var(--text-rgb), 0.03);
  color: var(--muted);
  font-size: 0.84rem;
}

.order-arrival-control {
  position: relative;
}

.order-arrival-control i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 0.9rem;
  pointer-events: none;
}

.order-select {
  min-height: 46px;
  border-radius: 16px;
}

.order-arrival-time-input {
  min-height: 46px;
  padding-left: 40px;
  border-radius: 16px;
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

.order-time-toggle {
  font-size: 1rem;
}

.order-editor-note {
  width: 100%;
  color: var(--muted);
  font-size: 0.85rem;
}

.order-error {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--danger);
  font-size: 0.82rem;
}

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

.orders-modal {
  width: min(100%, 440px);
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 24px 48px rgba(var(--text-rgb), 0.24);
}

.orders-modal-title { font-size: 1.05rem; font-weight: 800; margin: 0; }
.orders-modal-text { margin: 0; color: var(--muted); }
.orders-modal-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }

@media (max-width: 767px) {
  .orders-modal {
    padding: 18px;
  }
}
</style>
