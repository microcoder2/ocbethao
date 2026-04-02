<template>
  <article :class="['order-card', surfaceClass, { 'is-collapsed': collapsed }]">
    <!-- Head -->
    <div class="order-card-head">
      <div class="order-head-main">
        <div class="order-contact-line">
          <span class="order-customer-name">{{ customerName }}</span>
          <a
            v-if="order.guestPhone || order.customer?.phone"
            class="order-customer-phone"
            :href="`tel:${order.guestPhone || order.customer?.phone}`"
          >{{ customerPhone }}</a>
          <span v-else class="order-customer-phone">{{ customerPhone }}</span>
        </div>
      </div>
      <div class="order-head-side">
        <div ref="infoTriggerRef" class="order-info-wrap">
          <button
            class="order-info-trigger"
            type="button"
            :aria-label="`Thông tin đơn ${order.orderNumber}`"
            @click.stop="toggleInfo"
          >
            <i class="bi bi-info-circle"></i>
          </button>
          <div v-if="infoOpen" class="order-info-popup" role="tooltip">
            <div v-for="line in infoTooltip.split('\n')" :key="line">{{ line }}</div>
          </div>
        </div>
        <div class="order-total">{{ formatMoney(order.totalAmount) }}</div>
        <button
          class="order-collapse-btn"
          type="button"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? 'Mở rộng đơn' : 'Thu gọn đơn'"
          :title="collapsed ? 'Mở rộng' : 'Thu gọn'"
          @click="collapsed = !collapsed"
        >
          <i :class="['bi', collapsed ? 'bi-chevron-down' : 'bi-chevron-up']"></i>
        </button>
      </div>
    </div>

    <!-- Status line -->
    <div class="order-status-line">
      <span class="order-arrival-chip"><i class="bi bi-clock"></i> {{ order.arrivalAt ? queueTime : 'Chưa xác định' }}</span>
      <span v-if="showPaymentMethod && order.paymentMethod" class="order-pill is-muted">{{ paymentMethodLabel }}</span>
      <span class="order-item-count-chip">{{ editableItems.length }} món</span>
      <span :class="['order-pill', simpleStatusClass]">{{ statusLabel }}</span>
      <button v-if="canDelete" class="order-delete-inline" type="button" :disabled="busy" :title="`Xóa đơn ${order.orderNumber}`" @click="$emit('deleteOrder')">
        <i class="bi bi-trash3"></i>
      </button>
    </div>

    <!-- Collapsible body -->
    <div v-show="!collapsed" class="order-collapsible">

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
          :show-cancelled="isFullyCancelledItem(item)"
          :cancelled-count="getCancelledItemCount(item)"
          :show-cancelled-count="shouldShowCancelledStageCount(item)"
          :restore-pending="isPendingItemAction(item.id, 'CANCELLED->WAITING')"
          :restore-disabled="!canMoveItemStages(item) || props.pendingItemStatusId === item.id"
          :restore-title="canMoveItemStages(item) ? getCancelledRestoreHint(item) : 'Không thể phục hồi lúc này'"
          :stage-controls="getItemStageControlViews(item)"
          :show-stage-picker="stagePicker.visible && stagePicker.itemId === item.id"
          :stage-picker-label="stagePicker.label"
          :stage-picker-hint="stagePicker.hint"
          :stage-picker-quantity="stagePicker.quantity"
          @restore-cancelled="restoreCancelledItem(item)"
          @open-control="openStageControlByKey(item, $event)"
          @nudge-picker="nudgeStagePicker"
          @confirm-picker="confirmStagePicker"
          @close-picker="closeStagePicker"
        />
      </template>
    </OrderCardItemsSection>

    <!-- Edit panel -->
    <div v-if="canEdit" class="order-editor-panel">
      <div v-if="menuOptions.length" class="order-add-row">
        <div class="order-add-field">
          <span class="order-field-label">Cập nhật đơn</span>
          <div class="order-add-control">
            <button
              type="button"
              :class="['btn order-add-btn order-time-toggle', arrivalEditOpen ? 'btn-secondary' : 'btn-outline-secondary']"
              :title="arrivalEditOpen ? 'Đóng chỉnh giờ' : 'Chỉnh giờ hẹn'"
              @click="arrivalEditOpen = !arrivalEditOpen"
            ><i class="bi bi-clock"></i></button>
            <select v-model="addSelection" class="form-select order-select" :disabled="busy">
              <option value="">Chọn món để thêm</option>
              <template v-for="group in groupedOptions" :key="group.label">
                <optgroup :label="groupLabelText(group)">
                  <option v-for="opt in group.items" :key="opt.id" :value="String(opt.id)">
                    {{ opt.menuItem.name }} · {{ formatMoney(opt.sellingPrice) }}
                  </option>
                </optgroup>
              </template>
            </select>
            <button
              class="btn btn-outline-dark order-add-btn"
              type="button"
              :disabled="busy || !addSelection"
              aria-label="Thêm món"
              title="Thêm món"
              @click="addItem"
            >+</button>
          </div>
        </div>
        <div v-if="arrivalEditOpen" class="order-arrival-row">
          <div class="order-arrival-segment">
            <button type="button" :class="['order-arrival-seg', { 'is-active': arrivalMode === 'scheduled' }]" :disabled="busy" @click="arrivalMode = 'scheduled'">Có giờ hẹn</button>
            <button type="button" :class="['order-arrival-seg', { 'is-active': arrivalMode === 'unknown' }]"   :disabled="busy" @click="arrivalMode = 'unknown'">Chưa xác định</button>
            <button type="button" :class="['order-arrival-seg', { 'is-active': arrivalMode === 'arrived' }]"   :disabled="busy" @click="arrivalMode = 'arrived'">Đã tới bàn</button>
          </div>
          <input
            v-if="arrivalMode === 'scheduled'"
            v-model="arrivalTimeDraft"
            type="time"
            class="form-control order-arrival-time-input"
            :disabled="busy"
            min="13:30"
            max="20:30"
          />
        </div>
      </div>
      <div v-else class="order-add-hint">
        Hôm nay không còn món khả dụng để thêm vào đơn này.
      </div>

      <div v-if="draftChanged || arrivalChanged" class="order-editor-actions">
        <div v-if="draftChanged" class="order-editor-note">Lưu thay đổi món trước khi hoàn tất hoặc hủy đơn.</div>
        <button class="btn btn-dark" type="button" :disabled="busy" @click="emitSave">
          {{ isSaving ? "Đang lưu..." : "Lưu" }}
        </button>
        <button class="btn btn-outline-dark" type="button" :disabled="busy" @click="discardDraft">
          Bỏ thay đổi
        </button>
      </div>
    </div>

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

    </div><!-- /order-collapsible -->

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
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import OrderCardItemsSection from "../common/OrderCardItemsSection.vue";
import OrderCardItemStatuses from "./OrderCardItemStatuses.vue";
import { buildOrderCardProgressSegments } from "../common/orderCardProgress";
import { formatMoney } from "../../utils/format";
import { toggleNoteChip } from "../../utils/noteChips";

// Types
type OrderItem = {
  id: number;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
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

type DailyMenuOption = {
  id: number;
  sellingPrice: number;
  isAvailable: boolean;
  stockLinks?: Array<{
    stockPool?: { id?: number; label?: string | null; remainingQuantity?: number } | null;
  }>;
  menuItem: { id: number; name: string };
};

type EditableItem = {
  id?: number | null;
  key: string;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
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

type SavePayload = { dailyMenuItemId?: number; menuItemId?: number; quantity: number; note?: string };
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
  menuOptions: DailyMenuOption[];
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
  saveItems: [items: SavePayload[], arrivalTime: string | null];
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
const infoOpen = ref(false);
const infoTriggerRef = ref<HTMLElement | null>(null);

function toggleInfo() {
  infoOpen.value = !infoOpen.value;
}

function closeInfoOnOutside(e: MouseEvent) {
  if (infoTriggerRef.value && !infoTriggerRef.value.contains(e.target as Node)) {
    infoOpen.value = false;
  }
}

watch(infoOpen, (val) => {
  if (val) document.addEventListener("click", closeInfoOnOutside);
  else document.removeEventListener("click", closeInfoOnOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", closeInfoOnOutside);
});

const draft = ref<EditableItem[] | null>(null);
const arrivalTimeDraft = ref<string>(
  props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : ""
);

type ArrivalMode = "scheduled" | "unknown" | "arrived";
const initialArrivalMode: ArrivalMode = props.order.arrivalAt ? "scheduled" : "unknown";
const initialArrivalTime = props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "";
const arrivalMode = ref<ArrivalMode>(initialArrivalMode);
const arrivalEditOpen = ref(false);
const addSelection = ref("");
const highlightedKey = ref<string | number | null>(null);
const openItemNoteKeys = ref<Set<string>>(new Set());
const draftKeySeed = ref(0);

function flashItem(key: string | number) {
  highlightedKey.value = key;
  setTimeout(() => { highlightedKey.value = null; }, 1200);
}
const removeDialog = reactive({ visible: false, index: -1, itemName: "" });
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
      i.dailyMenuItemId ?? i.menuItemId,
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
    addSelection.value = "";
    closeStagePicker();
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

function canEditItemNote(item: EditableItem) {
  return canAdjustDraftItem(item) && item.status !== "CANCELLED";
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
        : `item-${item.dailyMenuItemId ?? item.menuItemId ?? "item"}-${i}`,
    menuItemId: item.menuItemId ?? null,
    dailyMenuItemId: item.dailyMenuItemId ?? null,
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

function setItemNote(index: number, note: string) {
  ensureDraft();
  const item = draft.value?.[index];
  if (!item) return;
  draft.value![index] = { ...item, note };
}

function toggleItemNoteChip(index: number, chip: string) {
  const item = editableItems.value[index];
  if (!item) return;
  setItemNote(index, toggleNoteChip(item.note || "", chip));
}

function discardDraft() {
  draft.value = null;
  addSelection.value = "";
  closeStagePicker();
  openItemNoteKeys.value = new Set();
}

// Computed
const surfaceClass = computed(() => `is-status-${simplifyStatus(props.order.status).toLowerCase()}`);
const simpleStatusClass = computed(() => `is-${simplifyStatus(props.order.status).toLowerCase()}`);

const statusLabel = computed(() => {
  const s = simplifyStatus(props.order.status);
  if (s === "PENDING") return "Chờ xác nhận";
  if (s === "CONFIRMED") return "Đang xử lý";
  if (s === "COMPLETED") return "Hoàn tất";
  return "Đã hủy";
});

const customerName = computed(() => props.order.customer?.fullName || props.order.guestName || "Khách lẻ");
const customerPhone = computed(() => props.order.guestPhone || props.order.customer?.phone || "Không có SĐT");
const infoTooltip = computed(() => `ID đơn: ${props.order.orderNumber}\nGiờ đặt: ${formatTime(props.order.createdAt)}`);
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

const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));

const arrivalChanged = computed(() =>
  arrivalMode.value !== initialArrivalMode ||
  (arrivalMode.value === "scheduled" && arrivalTimeDraft.value !== initialArrivalTime)
);

const draftChanged = computed(() => {
  if (!draft.value) return false;
  const orig = cloneItems(props.order.items).map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}:${i.note ?? ""}`).join("|");
  const curr = draft.value.map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}:${i.note ?? ""}`).join("|");
  return orig !== curr;
});

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

const groupedOptions = computed(() => groupByIngredient(props.menuOptions));

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
      label: "Chờ",
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
  stagePicker.label = "Phục hồi";
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

function changeQty(index: number, delta: number) {
  ensureDraft();
  const item = draft.value![index];
  if (!item) return;
  const next = item.quantity + delta;
  if (next <= 0) {
    removeDialog.visible = true;
    removeDialog.index = index;
    removeDialog.itemName = item.itemNameSnapshot;
  } else {
    draft.value![index] = {
      ...item,
      quantity: next,
      activeQuantity: next,
      waitingQuantity: next,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: 0,
      lineTotal: next * item.unitPrice,
      activeLineTotal: next * item.unitPrice,
      status: "WAITING",
    };
  }
}

function confirmRemove() {
  if (draft.value && removeDialog.index >= 0) {
    draft.value = draft.value.filter((_, i) => i !== removeDialog.index);
  }
  removeDialog.visible = false;
  removeDialog.index = -1;
}

function addItem() {
  const selectedId = Number(addSelection.value || 0);
  if (!selectedId) return;
  const opt = props.menuOptions.find((o) => o.id === selectedId);
  if (!opt) return;

  ensureDraft();
  const existing = draft.value!.findIndex(
    (i) =>
      i.dailyMenuItemId === opt.id &&
      normalizeItemNote(i.note) === "" &&
      canAdjustDraftItem(i)
  );
  if (existing >= 0) {
    const cur = draft.value![existing];
    const nextQuantity = cur.quantity + 1;
    draft.value![existing] = {
      ...cur,
      quantity: nextQuantity,
      activeQuantity: nextQuantity,
      waitingQuantity: nextQuantity,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: 0,
      status: "WAITING",
      lineTotal: nextQuantity * cur.unitPrice,
      activeLineTotal: nextQuantity * cur.unitPrice,
    };
    flashItem(cur.key);
    openItemNoteEditor(cur.key);
  } else {
    const newKey = buildDraftItemKey(opt.id);
    draft.value!.push({
      id: null,
      key: newKey,
      menuItemId: opt.menuItem.id,
      dailyMenuItemId: opt.id,
      itemNameSnapshot: opt.menuItem.name,
      unitPrice: Number(opt.sellingPrice || 0),
      quantity: 1,
      activeQuantity: 1,
      waitingQuantity: 1,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: 0,
      status: "WAITING",
      lineTotal: Number(opt.sellingPrice || 0),
      activeLineTotal: Number(opt.sellingPrice || 0),
      note: "",
    });
    flashItem(newKey);
    openItemNoteEditor(newKey);
  }
  addSelection.value = "";
}

function emitSave() {
  if (!draft.value && !arrivalChanged.value) return;
  emit(
    "saveItems",
    editableItems.value.map((i) => ({
      dailyMenuItemId: i.dailyMenuItemId ?? undefined,
      menuItemId: i.menuItemId ?? undefined,
      quantity: i.quantity,
      note: i.note || undefined,
    })),
    arrivalMode.value === "scheduled" ? (arrivalTimeDraft.value || null)
      : arrivalMode.value === "arrived" ? "ARRIVED"
      : null,
  );
}

function groupByIngredient(options: DailyMenuOption[]) {
  const groups = new Map<string, { label: string; poolId: number | null; items: DailyMenuOption[] }>();
  for (const option of options) {
    const pool = option.stockLinks?.[0]?.stockPool;
    const label = pool?.label || "Khác";
    const poolId = pool?.id ?? null;
    const key = poolId != null ? `pool-${poolId}` : `label-${label}`;
    if (!groups.has(key)) groups.set(key, { label, poolId, items: [] });
    groups.get(key)!.items.push(option);
  }
  return Array.from(groups.values());
}

function groupLabelText(group: { label: string; poolId: number | null }) {
  const rem = group.poolId != null ? props.stockRemainingMap[group.poolId] : undefined;
  return rem != null ? `${group.label} — còn ${rem}` : group.label;
}
</script>

<style scoped>
.order-card {
  --order-status-surface: rgba(var(--panel-rgb), 0.96);
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  margin-bottom: 6px;
  background: var(--order-status-surface);
}

.order-card:last-child { margin-bottom: 0; }
.order-card.is-collapsed { gap: 8px; }
.order-collapsible { display: grid; gap: 14px; }

.order-card.is-status-pending   { --order-status-surface: rgba(203, 165, 81, 0.12); }
.order-card.is-status-confirmed { --order-status-surface: rgba(201, 126, 71, 0.1); }
.order-card.is-status-completed { --order-status-surface: rgba(66, 133, 104, 0.11); }
.order-card.is-status-cancelled { --order-status-surface: rgba(148, 88, 88, 0.1); }

.order-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-head-main { display: grid; gap: 8px; min-width: 0; }

.order-head-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  text-align: right;
}

.order-info-wrap {
  position: relative;
  display: inline-flex;
}

.order-info-popup {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(30, 20, 14, 0.92);
  color: #fff;
  font-size: 0.8rem;
  line-height: 1.6;
  white-space: nowrap;
  z-index: 200;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.order-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  transition: color 0.18s, border-color 0.18s, background 0.18s;
}

.order-info-trigger:hover,
.order-info-trigger:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}

.order-info-trigger i { font-size: 0.95rem; }

.order-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(126, 86, 65, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  transition: color 0.18s, border-color 0.18s, background 0.18s;
}
.order-collapse-btn:hover,
.order-collapse-btn:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}
.order-collapse-btn i { font-size: 0.82rem; }

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

.order-status-line {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) repeat(4, auto);
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.order-delete-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--bs-danger, #dc3545);
  opacity: 0.7;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}

.order-delete-inline:hover { opacity: 1; background: rgba(220, 53, 69, 0.08); }
.order-delete-inline i { font-size: 0.82rem; }

.order-item-count-chip {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
}

.order-arrival-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-arrival-segment {
  display: flex;
  border: 1px solid rgba(var(--text-rgb), 0.14);
  border-radius: 8px;
  overflow: hidden;
}

.order-arrival-seg {
  flex: 1;
  padding: 5px 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.order-arrival-seg + .order-arrival-seg {
  border-left: 1px solid rgba(var(--text-rgb), 0.14);
}

.order-arrival-seg.is-active {
  background: var(--ember-strong, #c9582c);
  color: #fff;
  font-weight: 700;
}

.order-arrival-seg:disabled {
  opacity: 0.5;
  cursor: default;
}

.order-arrival-time-input {
  flex: 1;
  min-width: 0;
  height: 36px;
}

.order-arrival-toggle {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
}

.order-arrival-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}

.order-arrival-prefix {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ember-strong);
  white-space: nowrap;
}

.order-arrival-input {
  width: 106px;
  height: 24px;
  padding: 0 2px;
  border-radius: 999px;
  border: 1px solid rgba(var(--text-rgb), 0.14);
  background: #fff;
  font-size: 0.72rem;
  color: var(--text);
  line-height: 1;
  overflow: hidden;
}

.order-arrival-chip i { margin-right: 4px; }

.order-arrival-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px 0 0;
  color: var(--ember-strong);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  justify-self: start;
  z-index: 0;
}

.order-arrival-chip::before {
  content: "";
  position: absolute;
  inset: 0;
  left: -10px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  z-index: -1;
}

.order-total { font-weight: 800; color: var(--ember-strong); }

.order-badges { display: flex; flex-wrap: wrap; gap: 8px; }

.order-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  white-space: nowrap;
  flex-shrink: 0;
  justify-self: end;
}

.order-pill.is-pending   { background: rgba(203, 165, 81, 0.18); color: #8b6517; }
.order-pill.is-confirmed { background: rgba(201, 126, 71, 0.16); color: #8a451f; }
.order-pill.is-completed { background: rgba(66, 133, 104, 0.15); color: var(--green); }
.order-pill.is-cancelled { background: rgba(148, 88, 88, 0.14);  color: #8f2f15; }
.order-pill.is-unpaid    { background: rgba(var(--ember-rgb), 0.12);  color: var(--ember-strong); }
.order-pill.is-paid      { background: rgba(var(--green-rgb), 0.14);  color: var(--green); }
.order-pill.is-refunded  { background: rgba(var(--text-rgb), 0.08);   color: var(--text); }
.order-pill.is-muted     { background: rgba(var(--text-rgb), 0.06);   color: var(--muted); }

.order-progress { display: grid; gap: 8px; }

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
.order-progress-segment.is-ready   { background: rgba(66, 133, 104, 0.78); }

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
  0%   { background: rgba(201, 88, 44, 0.18); }
  70%  { background: rgba(201, 88, 44, 0.08); }
  100% { background: transparent; }
}

.order-item-row {
  display: grid;
  gap: 6px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(var(--line-rgb), 0.72);
}

.order-item-row:last-child { border-bottom: none; }
.order-item-row.is-highlighted { animation: item-flash 1.2s ease-out forwards; border-radius: 6px; }
.order-item-row.is-cancelled {
  padding-inline: 10px;
  border-radius: 12px;
  background: rgba(148, 88, 88, 0.08);
  opacity: 0.74;
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

.order-item-row.is-cancelled-flash {
  animation:
    item-flash 1s ease-out forwards,
    cancelled-item-pulse 1.4s ease-in-out 3;
}

@keyframes cancelled-item-pulse {
  0%, 100% { background: rgba(148, 88, 88, 0.08); }
  50% { background: rgba(201, 88, 44, 0.18); }
}

.order-item-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.order-item-copy { display: grid; gap: 4px; min-width: 0; }
.order-item-headline {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}
.order-item-name {
  flex: 1 1 180px;
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

.order-item-total {
  font-weight: 800;
  color: var(--ember-strong);
  white-space: nowrap;
  text-align: right;
}

.order-item-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  align-self: start;
}

.order-item-editor {
  display: flex;
  align-items: center;
  gap: 6px;
}

.order-item-qty {
  min-width: 26px;
  padding: 0 5px;
  border-radius: 4px;
  background: #fff;
  box-shadow: inset 0 1px 3px rgba(var(--text-rgb), 0.14), inset 0 1px 1px rgba(var(--text-rgb), 0.1);
  text-align: center;
  font-weight: 400;
  font-size: 0.82rem;
  line-height: 24px;
  height: 24px;
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

.order-qty-btn:hover  { background: #f5f5f5; box-shadow: 0 3px 6px rgba(var(--text-rgb), 0.14), 0 1px 2px rgba(var(--text-rgb), 0.08); }
.order-qty-btn:active { background: #ebebeb; box-shadow: 0 1px 2px rgba(var(--text-rgb), 0.08); }

.order-editor-panel { display: grid; gap: 12px; }

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

.order-select {
  min-height: 46px;
  border-radius: 16px;
}

.order-add-hint { color: var(--muted); font-size: 0.85rem; }

.order-add-btn {
  width: 46px;
  min-width: 46px;
  height: 46px;
  padding: 0;
  border-radius: 16px;
  font-size: 1.2rem;
  line-height: 1;
}

.order-item-qty-read {
  min-width: 28px;
  padding: 0 6px;
  border-radius: 4px;
  background: #fff;
  box-shadow: inset 0 1px 3px rgba(var(--text-rgb), 0.14), inset 0 1px 1px rgba(var(--text-rgb), 0.1);
  text-align: center;
  font-weight: 400;
  font-size: 0.82rem;
  line-height: 24px;
  height: 24px;
  font-variant-numeric: tabular-nums;
}

.order-editor-note { width: 100%; color: var(--muted); font-size: 0.85rem; }

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
  .order-card { padding: 16px; }
  .order-card-head { gap: 12px; }
  .order-head-side { min-width: 96px; }

  .order-progress-head { align-items: flex-start; flex-direction: column; }

  .order-item-main { gap: 8px; }
  .order-item-headline { gap: 4px 6px; }
  .order-item-side { gap: 6px; }
  .order-item-editor { gap: 6px; }

  .order-qty-btn,
  .order-item-qty,
  .order-item-qty-read {
    min-width: 22px;
    height: 22px;
    line-height: 22px;
  }

  .order-add-control { grid-template-columns: auto minmax(0, 1fr) auto; }

  .orders-modal { padding: 18px; }
}
</style>
