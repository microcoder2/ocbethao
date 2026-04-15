<template>
  <OrderCardShell
    v-model:collapsed="collapsed"
    :tone="statusTone"
    :total-text="formatMoney(displayTotal)"
  :info-aria-label="`Thông tin đơn ${order.orderNumber}`"
  :info-lines="infoTooltipLines"
  :arrival-text="order.arrivalAt ? queueTime : 'Chưa xác định'"
  :guest-count-text="guestCountChipText"
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


      <OrderUpdateEditor
        :visible="canEdit"
        :busy="busy"
        :is-saving="isSaving"
        v-model:edit-panel-open="editPanelOpen"
        v-model:arrival-time-draft="arrivalTimeDraft"
        v-model:guest-count-draft="guestCountDraft"
        v-model:picker-multi-select-mode="multiSelectMode"
        :time-min="'10:00'"
        :time-max="'23:00'"
        :add-button-disabled="busy || !menuOptions.length"
        :has-menu-options="menuOptions.length > 0"
        :has-pending-save-changes="hasPendingSaveChanges"
        :show-save-note="draftChanged || arrivalChanged"
        save-note-text="Lưu thay đổi món hoặc giờ hẹn trước khi tiếp tục."
        :picker-open="addPickerOpen"
        :picker-buckets="pickerBuckets"
        :open-bucket-names="Array.from(openCats)"
        :selected-key="selectedGroupKey"
        :selected-group-label="selectedGroup?.label ?? null"
        :picker-method-items="pickerIngredientItems"
        :picker-can-select-item="canSelectItem"
        :picker-get-method-label="methodLabel"
        @arrival-input="handleArrivalTimeInput"
        @open-picker="openAddPicker"
        @save="emitSave"
        @discard="discardDraft"
        @close-picker="closeAddPicker"
        @toggle-picker-bucket="toggleCat"
        @select-picker-group="handleSelectGroup"
        @select-picker-item="addMenuItem"
      />

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
import { computed, ref, watch } from "vue";
import OrderCardShell from "../common/OrderCardShell.vue";
import OrderCardItemsSection from "../common/OrderCardItemsSection.vue";
import OrderCardItemStatuses from "../common/OrderCardItemStatuses.vue";
import type { OrderCardStatusActionView } from "../common/OrderCardItemStatuses.vue";
import OrderUpdateEditor from "../common/OrderUpdateEditor.vue";
import { buildOrderCardProgressSegments } from "../common/orderCardProgress";
import {
  buildOrderSaveItemsPayload,
  formatOrderGuestCountDraft,
  parseOrderGuestCountDraft,
  useOrderEditor,
} from "../../composables/useOrderEditor";
import { formatMoney } from "../../utils/format";

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
  guestCount?: number | null;
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
  availableQuantity?: number | null;
  stockLinks?: Array<{
    stockPool?: {
      id?: number;
      label?: string | null;
      remainingQuantity?: number | null;
      isAvailable?: boolean;
    } | null;
    consumeQuantity?: number;
  }>;
  menuItem: {
    id: number;
    name: string;
    category?: { id?: number; name?: string | null } | null;
  };
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
  saveItems: [items: SavePayload[], arrivalTime?: string, guestCount?: number | null];
  requestCancel: [];
  requestCancelItem: [itemId: number];
}>();

const collapsed = ref(["COMPLETED", "CANCELLED"].includes(props.order.status));
const draft = ref<EditableItem[] | null>(null);
const arrivalTimeDraft = ref(props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "");
const guestCountDraft = ref<string>(formatOrderGuestCountDraft(props.order.guestCount));
const guestCountDirty = ref(false);
const editPanelOpen = ref(false);

watch(
  () =>
    `${props.order.status}|${(props.order.items || [])
      .map((item) => `${item.menuItemId}:${item.quantity}:${item.note ?? ""}`)
      .join("|")}`,
  () => {
    draft.value = null;
    editPanelOpen.value = false;
    closeAddPicker();
    arrivalTimeDraft.value = props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "";
    guestCountDraft.value = formatOrderGuestCountDraft(props.order.guestCount);
    guestCountDirty.value = false;
    resetLineEditorState();
  }
);

watch(
  () => props.order.guestCount,
  (value) => {
    guestCountDraft.value = formatOrderGuestCountDraft(value);
    guestCountDirty.value = false;
  }
);

watch(guestCountDraft, () => {
  guestCountDirty.value = String(guestCountDraft.value ?? "").trim() !== formatOrderGuestCountDraft(props.order.guestCount);
});

watch(
  () => (draft.value ?? cloneItems(props.order.items)).map((item) => item.key).join("|"),
  () => {
    syncOpenItemNoteKeys(draft.value ?? cloneItems(props.order.items));
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

function handleArrivalTimeInput() {
  // The draft is read directly from arrivalTimeDraft; this keeps the template
  // aligned with the admin card without extra mode state.
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

const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));

const {
  addPickerOpen,
  multiSelectMode,
  selectedGroupKey,
  openCats,
  selectedGroup,
  pickerIngredientItems,
  pickerBuckets,
  openAddPicker,
  closeAddPicker,
  toggleCat,
  handleSelectGroup,
  canSelectItem,
  methodLabel,
  addMenuItem,
  highlightedKey,
  removeDialog,
  flashItem,
  toggleItemNoteChip,
  isItemNoteEditorOpen,
  toggleItemNoteEditor,
  openItemNoteEditor,
  syncOpenItemNoteKeys,
  resetLineEditorState,
  changeQty,
  confirmRemove,
} = useOrderEditor<MenuOption, EditableItem>({
  menuOptions: computed(() => props.menuOptions),
  draft,
  editableItems,
  ensureDraft,
  getItemRemaining,
  findExistingDraftIndex: (items, option) => {
    const optionMenuItemId = Number(option.menuItemId ?? option.menuItem.id);
    return items.findIndex((item) => item.menuItemId === optionMenuItemId);
  },
  buildUpdatedDraftItem: (current) => ({
    ...current,
    quantity: current.quantity + 1,
    lineTotal: (current.quantity + 1) * current.unitPrice,
  }),
  buildNewDraftItem: (option) => {
    const optionMenuItemId = Number(option.menuItemId ?? option.menuItem.id);
    return {
      id: null,
      key: `new-${optionMenuItemId}`,
      menuItemId: optionMenuItemId,
      itemNameSnapshot: option.menuItem.name,
      unitPrice: Number(option.sellingPrice || 0),
      quantity: 1,
      status: "WAITING",
      lineTotal: Number(option.sellingPrice || 0),
      note: "",
    };
  },
  getDraftItemKey: (item) => item.key,
  onItemAdded: (key) => {
    flashItem(key);
    openItemNoteEditor(key);
  },
  updateQuantity: (item, nextQuantity) => ({
    ...item,
    quantity: nextQuantity,
    lineTotal: nextQuantity * item.unitPrice,
  }),
});

function discardDraft() {
  draft.value = null;
  closeAddPicker();
  arrivalTimeDraft.value = initialArrivalTime.value;
  guestCountDraft.value = formatOrderGuestCountDraft(props.order.guestCount);
  guestCountDirty.value = false;
  resetLineEditorState();
}


function getItemRemaining(item: MenuOption) {
  const pool = item.stockLinks?.[0]?.stockPool;
  if (pool?.remainingQuantity != null) {
    return pool.remainingQuantity;
  }
  if (item.availableQuantity != null) {
    return item.availableQuantity;
  }
  return null;
}





function emitSave() {
  emit(
    "saveItems",
    buildOrderSaveItemsPayload(editableItems.value),
    arrivalChanged.value ? arrivalTimeDraft.value : undefined,
    guestCountDirty.value ? guestCountValue.value : undefined
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
const guestCountChipText = computed(() => {
  const value = Number(props.order.guestCount || 0);
  return value > 0 ? `${value} khách` : "";
});
const infoTooltipLines = computed(() => [
  `Khách: ${customerName.value} - ${customerPhone.value}`,
  `Giờ đặt: ${formatTime(props.order.createdAt)}`,
]);
const queueTime = computed(() => formatTime(props.order.arrivalAt));
const initialArrivalTime = computed(() => (props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : ""));
const guestCountValue = computed(() => parseOrderGuestCountDraft(guestCountDraft.value));
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
const hasPendingSaveChanges = computed(() => draftChanged.value || arrivalChanged.value || guestCountDirty.value);
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

function getItemStatusActions(item: EditableItem): OrderCardStatusActionView[] {
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
.order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
