<template>
  <OrderCardShell
    v-model:collapsed="collapsed"
    :tone="statusTone"
    :total-text="formatMoney(order.totalAmount)"
    :info-aria-label="`Thông tin đơn ${order.orderNumber}`"
    :info-lines="infoTooltipLines"
    :arrival-text="order.arrivalAt ? queueTime : 'Chưa xác định'"
    :guest-count-text="guestCountChipText"
    :status-meta-text="showPaymentMethod && order.paymentMethod ? paymentMethodLabel : ''"
    :item-count-text="`${editableItems.length} món`"
    :status-text="statusLabel"
    :show-delete="canDelete"
    :delete-disabled="busy"
    :delete-title="`Xóa đơn ${order.orderNumber}`"
    @delete="$emit('deleteOrder')"
  >
    <template #head-main>
      <div class="order-contact-line">
        <span class="order-customer-name">{{ customerName }}</span>
        <a
          v-if="order.guestPhone || order.customer?.phone"
          class="order-customer-phone"
          :href="`tel:${order.guestPhone || order.customer?.phone}`"
        >{{ customerPhone }}</a>
        <span v-else class="order-customer-phone">{{ customerPhone }}</span>
      </div>
    </template>

    <OrderCardItemsSection
      :items="editableItems"
      :busy="busy"
      :highlighted-key="highlightedKey"
      :show-progress="order.itemProgress?.total && simplifyStatus(order.status) === 'CONFIRMED'"
      :progress-text="progressText"
      :progress-segments="progressSegments"
      :progress-legend="progressLegend"
      :show-item-statuses="showItemStatuses"
      :cancelled-order="simplifyStatus(order.status) === 'CANCELLED'"
      :extra-row-classes="getItemRowClasses"
      :can-edit-item-note="canEditItemNote"
      :is-item-note-editor-open="isItemNoteEditorOpen"
      :can-adjust-item="canAdjustDraftItem"
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
          :show-picker="stagePicker.visible && stagePicker.itemId === item.id"
          :picker-label="stagePicker.label"
          :picker-hint="stagePicker.hint"
          :picker-quantity="stagePicker.quantity"
          @trigger-action="handleItemStatusAction(item, $event)"
          @nudge-picker="nudgeStagePicker"
          @confirm-picker="confirmStagePicker"
          @close-picker="closeStagePicker"
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
      :time-min="'13:30'"
      :time-max="'20:30'"
      :add-button-disabled="busy"
      :has-menu-options="menuOptions.length > 0"
      :has-pending-save-changes="hasPendingSaveChanges"
      :show-save-note="draftChanged || hasPendingMetaChange"
      save-note-text="Lưu thay đổi trước khi hoàn tất hoặc hủy đơn."
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

    <!-- Actions -->
    <div class="order-actions">
      <button
        v-if="canConfirm"
        class="btn btn-dark"
        type="button"
        :disabled="busy"
        @click="$emit('confirm')"
      >
        {{ busy ? "Đang xác nhận..." : "Xác nhận đơn" }}
      </button>
      <button
        v-if="canComplete"
        class="btn btn-ember"
        type="button"
        :disabled="busy || draftChanged || !readyToComplete"
        @click="$emit('openComplete')"
      >
        Hoàn tất
      </button>
      <button
        v-if="canCancel"
        class="btn btn-outline-danger"
        type="button"
        :disabled="busy || draftChanged"
        @click="$emit('openCancel')"
      >
        Hủy đơn
      </button>
    </div>

  </OrderCardShell>

    <!-- Remove item confirm (internal) -->
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
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import OrderCardShell from "../common/OrderCardShell.vue";
import OrderCardItemsSection from "../common/OrderCardItemsSection.vue";
import OrderCardItemStatuses from "../common/OrderCardItemStatuses.vue";
import OrderUpdateEditor from "../common/OrderUpdateEditor.vue";
import { buildOrderCardProgressSegments } from "../common/orderCardProgress";
import {
  buildOrderSaveItemsPayload,
  formatOrderGuestCountDraft,
  parseOrderGuestCountDraft,
  useOrderDraftLineEditor,
} from "../../composables/useOrderDraftLineEditor";
import { useOrderItemPicker } from "../../composables/useOrderItemPicker";
import { formatMoney } from "../../utils/format";

// Types
type OrderItem = {
  id: number;
  menuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  activeQuantity?: number;
  waitingQuantity?: number;
  cookingQuantity?: number;
  readyQuantity?: number;
  cancelledQuantity?: number;
  status: string;
  lineTotal: number;
  activeLineTotal?: number;
  note?: string | null;
};

type OrderRecord = {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalAmount: number;
  guestName?: string | null;
  guestPhone?: string | null;
  guestCount?: number | null;
  createdAt: string;
  arrivalAt?: string | null;
  itemProgress?: {
    total: number;
    waiting: number;
    cooking: number;
    ready: number;
    cancelled: number;
  };
  customer?: { fullName?: string | null; phone?: string | null } | null;
  items?: OrderItem[];
};

type CatalogOption = {
  id: number;
  menuItemId?: number | null;
  sellingPrice: number;
  isAvailable: boolean;
  stockLinks?: Array<{
    stockPool?: { id?: number; label?: string | null; remainingQuantity?: number } | null;
  }>;
  menuItem: { id: number; name: string; category?: { name: string } | null };
};

type EditableItem = {
  id?: number | null;
  key: string;
  menuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  activeQuantity?: number;
  waitingQuantity?: number;
  cookingQuantity?: number;
  readyQuantity?: number;
  cancelledQuantity?: number;
  status: string;
  lineTotal: number;
  activeLineTotal?: number;
  note?: string | null;
};

type SavePayload = { menuItemId?: number; quantity: number; note?: string };
type ItemStageName = "WAITING" | "COOKING" | "READY" | "CANCELLED";
type ActiveItemStageName = Exclude<ItemStageName, "CANCELLED">;
type MoveItemStagePayload = {
  itemId: number;
  action: "MOVE_STAGE";
  fromStage: ItemStageName;
  toStage: ActiveItemStageName;
  quantity: number;
};
type StageAction = {
  key: `${ItemStageName}->${ActiveItemStageName}`;
  hint: string;
  fromStage: ItemStageName;
  toStage: ActiveItemStageName;
  count: number;
  toneClass: string;
};
type StageControl = {
  key: ItemStageName;
  label: string;
  toneClass: string;
  activeCount: number;
  action: StageAction | null;
};
type StageControlView = StageControl & {
  pending: boolean;
  disabled: boolean;
  title: string;
  showCount: boolean;
};

// Props / Emits
const props = defineProps<{
  order: OrderRecord;
  menuOptions: CatalogOption[];
  stockRemainingMap: Record<number, number>;
  busy: boolean;
  isSaving: boolean;
  flashCancelledItemId?: number | null;
  pendingItemStatusId?: number | null;
  pendingItemStatusValue?: string | null;
}>();

const emit = defineEmits<{
  confirm: [];
  openComplete: [];
  openCancel: [];
  deleteOrder: [];
  saveItems: [items: SavePayload[], arrivalTime: string | null, guestCount?: number | null];
  moveItemStage: [payload: MoveItemStagePayload];
}>();

// Constants
const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  E_WALLET: "Ví điện tử",
};



// Internal state
const collapsed = ref(true);
const draft = ref<EditableItem[] | null>(null);
const arrivalTimeDraft = ref<string>(
  props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : ""
);
const guestCountDraft = ref<string>(formatOrderGuestCountDraft(props.order.guestCount));

type ArrivalMode = "scheduled" | "unknown" | "arrived";
const initialArrivalMode: ArrivalMode = props.order.arrivalAt ? "scheduled" : "unknown";
const initialArrivalTime = props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "";
const arrivalMode = ref<ArrivalMode>(initialArrivalMode);
const editPanelOpen = ref(false);
const draftKeySeed = ref(0);
const arrivalMetaDirty = ref(false);
const guestCountDirty = ref(false);
const stagePicker = reactive<{
  visible: boolean;
  itemId: number | null;
  fromStage: ItemStageName;
  toStage: ActiveItemStageName;
  quantity: number;
  max: number;
  label: string;
  hint: string;
}>({
  visible: false,
  itemId: null,
  fromStage: "WAITING",
  toStage: "COOKING",
  quantity: 1,
  max: 1,
  label: "",
  hint: "",
});

// Reset draft when server items change (after save or status update)
watch(
  () => props.order.items?.map((i) =>
    [
      i.id ?? "",
      i.menuItemId,
      i.quantity,
      i.waitingQuantity ?? "",
      i.cookingQuantity ?? "",
      i.readyQuantity ?? "",
      i.cancelledQuantity ?? "",
      i.status,
      normalizeItemNote(i.note),
    ].join(":")
  ).join("|"),
  () => {
    draft.value = null;
    addPickerOpen.value = false;
    multiSelectMode.value = false;
    selectedGroupKey.value = null;
    openCats.value = new Set();
    closeStagePicker();
    resetLineEditorState();
    arrivalMetaDirty.value = false;
    guestCountDirty.value = false;
  }
);

watch(
  () => props.order.guestCount,
  (value) => {
    guestCountDraft.value = formatOrderGuestCountDraft(value);
  }
);

watch(arrivalTimeDraft, () => {
  arrivalMetaDirty.value =
    arrivalMode.value !== initialArrivalMode ||
    (arrivalMode.value === "scheduled" && arrivalTimeDraft.value !== initialArrivalTime);
});

watch([arrivalMode, guestCountDraft], () => {
  arrivalMetaDirty.value =
    arrivalMode.value !== initialArrivalMode ||
    (arrivalMode.value === "scheduled" && arrivalTimeDraft.value !== initialArrivalTime);
  guestCountDirty.value = String(guestCountDraft.value ?? "").trim() !== formatOrderGuestCountDraft(props.order.guestCount);
});

watch(
  () => props.order.id,
  () => {
    arrivalMetaDirty.value = false;
    guestCountDirty.value = false;
  }
);

watch(
  () => (draft.value ?? cloneItems(props.order.items)).map((item) => item.key).join("|"),
  () => {
    syncOpenItemNoteKeys(draft.value ?? cloneItems(props.order.items));
  }
);

// Helpers
function simplifyStatus(status: string) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "PENDING") return "PENDING";
  return "CONFIRMED";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function normalizeItemNote(note?: string | null) {
  return String(note || "").trim();
}

function handleArrivalTimeInput() {
  if (String(arrivalTimeDraft.value || "").trim()) {
    arrivalMode.value = "scheduled";
  }
  arrivalMetaDirty.value =
    arrivalMode.value !== initialArrivalMode ||
    (arrivalMode.value === "scheduled" && arrivalTimeDraft.value !== initialArrivalTime);
}

function canEditItemNote(item: EditableItem) {
  return canAdjustDraftItem(item) && item.status !== "CANCELLED";
}

function buildDraftItemKey(seed: string | number) {
  draftKeySeed.value += 1;
  return `draft-${seed}-${draftKeySeed.value}`;
}

function cloneItems(items: OrderItem[] = []): EditableItem[] {
  return items.map((item, i) => ({
    id: item.id,
    key:
      typeof item.id === "number" && item.id > 0
        ? `item-${item.id}`
        : `item-${item.menuItemId ?? "item"}-${i}`,
    menuItemId: item.menuItemId ?? null,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    activeQuantity: Number(item.activeQuantity ?? 0),
    waitingQuantity: Number(item.waitingQuantity ?? 0),
    cookingQuantity: Number(item.cookingQuantity ?? 0),
    readyQuantity: Number(item.readyQuantity ?? 0),
    cancelledQuantity: Number(item.cancelledQuantity ?? 0),
    status: item.status || "WAITING",
    lineTotal: Number(item.lineTotal || 0),
    activeLineTotal: Number(item.activeLineTotal ?? 0),
    note: item.note ?? "",
  }));
}

function ensureDraft() {
  if (!draft.value) draft.value = cloneItems(props.order.items);
}

const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));

const {
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
} = useOrderDraftLineEditor<EditableItem>({
  draft,
  editableItems,
  ensureDraft,
  updateQuantity: (item, nextQuantity) => ({
    ...item,
    quantity: nextQuantity,
    activeQuantity: nextQuantity,
    waitingQuantity: nextQuantity,
    cookingQuantity: 0,
    readyQuantity: 0,
    cancelledQuantity: 0,
    lineTotal: nextQuantity * item.unitPrice,
    activeLineTotal: nextQuantity * item.unitPrice,
    status: "WAITING",
  }),
});

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
} = useOrderItemPicker<CatalogOption, EditableItem>({
  menuOptions: computed(() => props.menuOptions),
  draftItems: draft,
  ensureDraft,
  getItemRemaining,
  findExistingDraftIndex: (items, option) => {
    const optionMenuItemId = Number(option.menuItemId ?? option.menuItem.id);
    return items.findIndex(
      (item) =>
        item.menuItemId === optionMenuItemId &&
        normalizeItemNote(item.note) === "" &&
        canAdjustDraftItem(item)
    );
  },
  buildUpdatedDraftItem: (current) => {
    const nextQuantity = current.quantity + 1;
    return {
      ...current,
      quantity: nextQuantity,
      activeQuantity: nextQuantity,
      waitingQuantity: nextQuantity,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: 0,
      status: "WAITING",
      lineTotal: nextQuantity * current.unitPrice,
      activeLineTotal: nextQuantity * current.unitPrice,
    };
  },
  buildNewDraftItem: (option) => {
    const optionMenuItemId = Number(option.menuItemId ?? option.menuItem.id);
    return {
      id: null,
      key: buildDraftItemKey(optionMenuItemId),
      menuItemId: optionMenuItemId,
      itemNameSnapshot: option.menuItem.name,
      unitPrice: Number(option.sellingPrice || 0),
      quantity: 1,
      activeQuantity: 1,
      waitingQuantity: 1,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: 0,
      status: "WAITING",
      lineTotal: Number(option.sellingPrice || 0),
      activeLineTotal: Number(option.sellingPrice || 0),
      note: "",
    };
  },
  getDraftItemKey: (item) => item.key,
  onItemAdded: (key) => {
    flashItem(key);
    openItemNoteEditor(key);
  },
});

function discardDraft() {
  draft.value = null;
  addPickerOpen.value = false;
  selectedGroupKey.value = null;
  openCats.value = new Set();
  closeStagePicker();
  resetLineEditorState();
  guestCountDraft.value = formatOrderGuestCountDraft(props.order.guestCount);
  arrivalTimeDraft.value = initialArrivalTime;
  arrivalMode.value = initialArrivalMode;
  arrivalMetaDirty.value = false;
  guestCountDirty.value = false;
}

// Computed
const statusTone = computed(() => simplifyStatus(props.order.status).toLowerCase());

const statusLabel = computed(() => {
  const s = simplifyStatus(props.order.status);
  if (s === "PENDING") return "Chờ xác nhận";
  if (s === "CONFIRMED") return "Đang xử lý";
  if (s === "COMPLETED") return "Hoàn tất";
  return "Đã hủy";
});

const customerName = computed(() => props.order.customer?.fullName || props.order.guestName || "Khách lẻ");
const customerPhone = computed(() => props.order.guestPhone || props.order.customer?.phone || "Không có SĐT");
const guestCountChipText = computed(() => {
  const value = Number(props.order.guestCount || 0);
  return value > 0 ? `${value} khách` : "";
});
const infoTooltipLines = computed(() => [
  `ID đơn: ${props.order.orderNumber}`, 
  `Giờ đặt: ${formatTime(props.order.createdAt)}`, 
]);
const queueTime = computed(() => props.order.arrivalAt ? formatTime(props.order.arrivalAt) : "Chưa hẹn");

const showPaymentMethod = computed(() =>
  simplifyStatus(props.order.status) === "COMPLETED" &&
  props.order.paymentStatus === "PAID" &&
  !!props.order.paymentMethod
);
const paymentMethodLabel = computed(() => paymentMethodLabels[props.order.paymentMethod || ""] || props.order.paymentMethod || "");

const progressText = computed(() => {
  const p = props.order.itemProgress;
  if (!p?.total) return "Chưa có món";
  return `${p.ready}/${p.total} món sẵn sàng`;
});
const progressSegments = computed(() => buildOrderCardProgressSegments([
  { key: "waiting", tone: "waiting", width: progressPct("waiting") },
  { key: "cooking", tone: "cooking", width: progressPct("cooking") },
  { key: "ready", tone: "ready", width: progressPct("ready") },
]));
const progressLegend = computed(() => {
  const progress = props.order.itemProgress;
  if (!progress?.total) return [];
  return [
    `Chờ ${progress.waiting}`, 
    `Đang làm ${progress.cooking}`, 
    `Lên món ${progress.ready}`, 
  ];
});

const draftChanged = computed(() => {
  const orig = [
    cloneItems(props.order.items).map((i) => `${i.menuItemId}:${i.quantity}:${i.note ?? ""}`).join("|"),
    formatOrderGuestCountDraft(props.order.guestCount),
  ].join("||");
  const curr = [
    (draft.value ?? cloneItems(props.order.items)).map((i) => `${i.menuItemId}:${i.quantity}:${i.note ?? ""}`).join("|"),
    String(guestCountDraft.value ?? "").trim(),
  ].join("||");
  return orig !== curr;
});
const guestCountValue = computed(() => parseOrderGuestCountDraft(guestCountDraft.value));
const hasPendingMetaChange = computed(() =>
  arrivalMode.value !== initialArrivalMode ||
  (arrivalMode.value === "scheduled" && arrivalTimeDraft.value !== initialArrivalTime) ||
  String(guestCountDraft.value ?? "").trim() !== formatOrderGuestCountDraft(props.order.guestCount)
);
const hasPendingSaveChanges = computed(() => draftChanged.value || hasPendingMetaChange.value);

const canEdit    = computed(() => {
  const s = simplifyStatus(props.order.status);
  return s !== "COMPLETED" && s !== "CANCELLED";
});
const canConfirm = computed(() => simplifyStatus(props.order.status) === "PENDING");
const canComplete = computed(() => simplifyStatus(props.order.status) === "CONFIRMED");
const canCancel  = computed(() => {
  const s = simplifyStatus(props.order.status);
  return s === "PENDING" || s === "CONFIRMED";
});
const canDelete = computed(() => simplifyStatus(props.order.status) === "CANCELLED");
const readyToComplete = computed(() => {
  const p = props.order.itemProgress;
  return Boolean(p?.total && p.waiting === 0 && p.cooking === 0);
});
const showItemStatuses = computed(() =>
  simplifyStatus(props.order.status) === "CONFIRMED" ||
  editableItems.value.some((item) => item.status === "CANCELLED")
);

// Functions
function progressPct(key: "waiting" | "cooking" | "ready") {
  const total = Number(props.order.itemProgress?.total || 0);
  if (!total) return 0;
  return (Number(props.order.itemProgress?.[key] || 0) / total) * 100;
}

function getFallbackStageCounts(item: EditableItem) {
  const quantity = Math.max(0, Number(item.quantity || 0));
  if (item.status === "CANCELLED") {
    return { waiting: 0, cooking: 0, ready: 0, cancelled: quantity };
  }
  if (item.status === "READY") {
    return { waiting: 0, cooking: 0, ready: quantity, cancelled: 0 };
  }
  if (item.status === "COOKING") {
    return { waiting: 0, cooking: quantity, ready: 0, cancelled: 0 };
  }
  return { waiting: quantity, cooking: 0, ready: 0, cancelled: 0 };
}

function getItemStageCounts(item: EditableItem) {
  const hasStageBreakdown =
    item.waitingQuantity != null ||
    item.cookingQuantity != null ||
    item.readyQuantity != null ||
    item.cancelledQuantity != null;

  if (!hasStageBreakdown) {
    return getFallbackStageCounts(item);
  }

  const waiting = Math.max(0, Number(item.waitingQuantity || 0));
  const cooking = Math.max(0, Number(item.cookingQuantity || 0));
  const ready = Math.max(0, Number(item.readyQuantity || 0));
  const cancelled = Math.max(0, Number(item.cancelledQuantity || 0));
  const total = waiting + cooking + ready + cancelled;
  const quantity = Math.max(0, Number(item.quantity || 0));

  if (!total && quantity > 0) {
    return getFallbackStageCounts(item);
  }

  return {
    waiting,
    cooking,
    ready,
    cancelled: total > quantity ? Math.max(0, quantity - waiting - cooking - ready) : cancelled,
  };
}

function getCancelledItemCount(item: EditableItem) {
  return getItemStageCounts(item).cancelled;
}

function getItemActiveQuantity(item: EditableItem) {
  const stages = getItemStageCounts(item);
  return stages.waiting + stages.cooking + stages.ready;
}

function getItemDisplayedTotal(item: EditableItem) {
  if (!item.id) {
    return Number(item.lineTotal || 0);
  }

  const activeQuantity = getItemActiveQuantity(item);
  if (item.activeLineTotal != null && item.activeLineTotal > 0) {
    return Number(item.activeLineTotal || 0);
  }
  if (activeQuantity <= 0) {
    return 0;
  }
  return Number(item.unitPrice || 0) * activeQuantity;
}

function getItemQuantityLabel(item: EditableItem) {
  const activeQuantity = getItemActiveQuantity(item);
  const quantity = Math.max(0, Number(item.quantity || 0));
  if (!item.id || activeQuantity === quantity || quantity <= 0) {
    return String(quantity);
  }
  return `${activeQuantity}/${quantity}`;
}

function getItemRowClasses(item: EditableItem) {
  return {
    "is-cancelled-flash": props.flashCancelledItemId === item.id,
  };
}

function getItemStageControlViews(item: EditableItem): StageControlView[] {
  if (!canMoveItemStages(item) || isFullyCancelledItem(item)) {
    return [];
  }

  return getItemStageControls(item).map((control) => ({
    ...control,
    pending: isPendingItemAction(item.id, control.action?.key),
    disabled: !control.action || props.pendingItemStatusId === item.id,
    title: control.action?.hint || `${control.label}: không có thao tác`,
    showCount: shouldShowStageCount(item, control),
  }));
}

function getItemStatusChips(item: EditableItem) {
  if (!isFullyCancelledItem(item)) {
    return [];
  }

  return [{
    key: `${item.key}-cancelled`,
    label: "Đã hủy",
    toneClass: "is-cancelled",
    count: getCancelledItemCount(item),
    showCount: shouldShowCancelledStageCount(item),
    active: false,
  }];
}

function getItemStatusActions(item: EditableItem) {
  if (isFullyCancelledItem(item)) {
    return [{
      key: "restoreCancelled",
      label: "Phục hồi món này",
      toneClass: "is-ready",
      pending: isPendingItemAction(item.id, "CANCELLED->WAITING"),
      disabled: !canMoveItemStages(item) || props.pendingItemStatusId === item.id,
      title: canMoveItemStages(item) ? getCancelledRestoreHint(item) : "Không thể phục hồi lúc này",
      active: false,
      showCount: false,
    }];
  }

  return getItemStageControlViews(item).map((control) => ({
    key: control.key,
    label: control.label,
    toneClass: control.toneClass,
    count: control.activeCount,
    showCount: control.showCount,
    active: control.activeCount > 0,
    pending: control.pending,
    disabled: control.disabled,
    title: control.title,
  }));
}

function handleItemStatusAction(item: EditableItem, actionKey: string) {
  if (actionKey === "restoreCancelled") {
    restoreCancelledItem(item);
    return;
  }

  openStageControlByKey(item, actionKey);
}

function isWaitingOnlyItem(item: EditableItem) {
  const stages = getItemStageCounts(item);
  return (
    stages.waiting === Math.max(0, Number(item.quantity || 0)) &&
    stages.cooking === 0 &&
    stages.ready === 0 &&
    stages.cancelled === 0
  );
}

function isFullyCancelledItem(item: EditableItem) {
  const stages = getItemStageCounts(item);
  return stages.cancelled > 0 && stages.waiting === 0 && stages.cooking === 0 && stages.ready === 0;
}

function shouldShowCancelledStageCount(item: EditableItem) {
  return getCancelledItemCount(item) > 1;
}

function getCancelledRestoreHint(item: EditableItem) {
  const cancelledCount = getCancelledItemCount(item);
  return `Khôi phục ${cancelledCount} món về chờ`;
}

function canMoveItemStages(item: EditableItem) {
  return (
    simplifyStatus(props.order.status) === "CONFIRMED" &&
    !draftChanged.value &&
    typeof item.id === "number" &&
    item.id > 0
  );
}

function canAdjustDraftItem(item: EditableItem) {
  return (
    canEdit.value &&
    (simplifyStatus(props.order.status) === "PENDING" || !item.id || isWaitingOnlyItem(item))
  );
}


function buildStageAction(
  fromStage: ItemStageName,
  toStage: ActiveItemStageName,
  count: number,
  toneClass: string,
  hint: string
): StageAction {
  return {
    key: `${fromStage}->${toStage}`,
    fromStage,
    toStage,
    count,
    toneClass,
    hint,
  };
}

function getSuggestedMoveQuantity(action: StageAction) {
  if (action.fromStage === "COOKING" && action.toStage === "READY") {
    return 1;
  }
  if (action.fromStage === "READY" && action.toStage === "COOKING") {
    return 1;
  }
  return action.count;
}

function getItemStageControls(item: EditableItem): StageControl[] {
  const stages = getItemStageCounts(item);
  const quantity = Math.max(0, Number(item.quantity || 0));
  const waitingAction =
    stages.cancelled === quantity && quantity > 0
      ? buildStageAction("CANCELLED", "WAITING", quantity, "is-ready", `Khôi phục ${quantity} món về chờ`)
      : stages.cooking > 0
        ? buildStageAction("COOKING", "WAITING", stages.cooking, "is-muted", `Trả ${stages.cooking} món đang làm về chờ`)
        : null;

  const cookingAction =
    stages.waiting > 0
      ? buildStageAction("WAITING", "COOKING", stages.waiting, "is-cooking", `Bắt đầu làm ${stages.waiting} món đang chờ`)
      : stages.ready > 0
        ? buildStageAction("READY", "COOKING", stages.ready, "is-muted", `Đưa ${stages.ready} món đã lên về bếp`)
        : null;

  const readyAction =
    stages.cooking > 0
      ? buildStageAction("COOKING", "READY", stages.cooking, "is-ready", `Lên ${stages.cooking} món đang làm`)
      : null;

  return [
    {
      key: "WAITING",
      label: "Đang chờ",
      toneClass: "is-waiting",
      activeCount: stages.waiting,
      action: waitingAction,
    },
    {
      key: "COOKING",
      label: "Đang làm",
      toneClass: "is-cooking",
      activeCount: stages.cooking,
      action: cookingAction,
    },
    {
      key: "READY",
      label: "Lên món",
      toneClass: "is-ready",
      activeCount: stages.ready,
      action: readyAction,
    },
  ];
}

function shouldShowStageCount(item: EditableItem, control: StageControl) {
  const quantity = Math.max(0, Number(item.quantity || 0));
  if (control.activeCount <= 0) return false;
  if (control.activeCount > 1) return true;
  return quantity > 1;
}

function openStageControlByKey(item: EditableItem, controlKey: ItemStageName) {
  const control = getItemStageControls(item).find((entry) => entry.key === controlKey);
  if (!control) {
    return;
  }
  openStageControl(item, control);
}

function restoreCancelledItem(item: EditableItem) {
  if (!item.id || props.busy) {
    return;
  }

  const cancelledCount = getCancelledItemCount(item);
  if (cancelledCount <= 0) {
    return;
  }

  if (cancelledCount <= 1) {
    emit("moveItemStage", {
      itemId: item.id,
      action: "MOVE_STAGE",
      fromStage: "CANCELLED",
      toStage: "WAITING",
      quantity: 1,
    });
    return;
  }

  stagePicker.visible = true;
  stagePicker.itemId = item.id;
  stagePicker.fromStage = "CANCELLED";
  stagePicker.toStage = "WAITING";
  stagePicker.max = cancelledCount;
  stagePicker.quantity = 1;
  stagePicker.label = "Phục hồi món này";
  stagePicker.hint = getCancelledRestoreHint(item);
}

function openStageControl(item: EditableItem, control: StageControl) {
  if (!item.id || props.busy || !control.action) {
    return;
  }

  const action = control.action;
  if (action.count <= 1) {
    emit("moveItemStage", {
      itemId: item.id,
      action: "MOVE_STAGE",
      fromStage: action.fromStage,
      toStage: action.toStage,
      quantity: 1,
    });
    return;
  }

  stagePicker.visible = true;
  stagePicker.itemId = item.id;
  stagePicker.fromStage = action.fromStage;
  stagePicker.toStage = action.toStage;
  stagePicker.max = action.count;
  stagePicker.quantity = Math.min(action.count, Math.max(1, getSuggestedMoveQuantity(action)));
  stagePicker.label = control.label;
  stagePicker.hint = action.hint;
}

function closeStagePicker() {
  stagePicker.visible = false;
  stagePicker.itemId = null;
  stagePicker.fromStage = "WAITING";
  stagePicker.toStage = "COOKING";
  stagePicker.quantity = 1;
  stagePicker.max = 1;
  stagePicker.label = "";
  stagePicker.hint = "";
}

function nudgeStagePicker(delta: number) {
  if (!stagePicker.visible) {
    return;
  }
  const nextQuantity = stagePicker.quantity + delta;
  stagePicker.quantity = Math.min(stagePicker.max, Math.max(1, nextQuantity));
}


function confirmStagePicker() {
  if (!stagePicker.visible || !stagePicker.itemId) {
    return;
  }

  emit("moveItemStage", {
    itemId: stagePicker.itemId,
    action: "MOVE_STAGE",
    fromStage: stagePicker.fromStage,
    toStage: stagePicker.toStage,
    quantity: stagePicker.quantity,
  });
  closeStagePicker();
}

function isPendingItemAction(itemId?: number | null, actionKey?: string | null) {
  return (
    typeof itemId === "number" &&
    itemId > 0 &&
    props.pendingItemStatusId === itemId &&
    props.pendingItemStatusValue === String(actionKey || "")
  );
}

function getItemRemaining(item: CatalogOption) {
  const poolId = item.stockLinks?.[0]?.stockPool?.id;
  if (poolId == null) {
    return null;
  }

  const liveRemaining = props.stockRemainingMap[poolId];
  if (liveRemaining != null) {
    return liveRemaining;
  }

  return item.stockLinks?.[0]?.stockPool?.remainingQuantity ?? null;
}

function emitSave() {
  if (!hasPendingSaveChanges.value) return;
  emit(
    "saveItems",
    buildOrderSaveItemsPayload(editableItems.value),
    arrivalMode.value === "scheduled" ? (arrivalTimeDraft.value || null)
      : arrivalMode.value === "arrived" ? "ARRIVED"
      : null,
    guestCountValue.value,
  );
}

</script>

<style scoped>
.order-contact-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}

.order-customer-name { font-weight: 700; }
.order-customer-phone {
  color: var(--muted);
  font-size: 0.9rem;
  text-decoration: none;
}
a.order-customer-phone:hover { color: var(--ember-strong); text-decoration: underline; }

.order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Internal remove-item modal */
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
  position: relative;
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 24px 48px rgba(var(--text-rgb), 0.24);
}

.orders-modal-title  { font-size: 1.05rem; font-weight: 800; margin: 0; }
.orders-modal-text   { margin: 0; color: var(--muted); }
.orders-modal-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }

@media (max-width: 767px) {
  .orders-modal { padding: 18px; }
}
</style>




