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

    <!-- Progress -->
    <div v-if="order.itemProgress?.total && simplifyStatus(order.status) === 'CONFIRMED'" class="order-progress">
      <div class="order-progress-head">
        <strong>{{ progressText }}</strong>
      </div>
      <div class="order-progress-track">
        <span class="order-progress-segment is-waiting" :style="{ width: `${progressPct('waiting')}%` }"></span>
        <span class="order-progress-segment is-cooking" :style="{ width: `${progressPct('cooking')}%` }"></span>
        <span class="order-progress-segment is-ready"   :style="{ width: `${progressPct('ready')}%` }"></span>
      </div>
      <div class="order-progress-legend">
        <span>Chờ {{ order.itemProgress.waiting }}</span>
        <span>Đang làm {{ order.itemProgress.cooking }}</span>
        <span>Lên món {{ order.itemProgress.ready }}</span>
      </div>
    </div>

    <!-- Items -->
    <ul class="order-item-list">
      <li v-if="!editableItems.length" class="order-item-row is-empty">
        <span class="order-item-name">Chưa có món</span>
      </li>
      <li
        v-for="(item, index) in editableItems"
        :key="item.key"
        :class="[
          'order-item-row',
          {
            'is-highlighted': highlightedKey === item.key,
            'is-cancelled': item.status === 'CANCELLED',
            'is-cancelled-flash': props.flashCancelledItemId === item.id,
          },
        ]"
      >
        <div class="order-item-main">
          <div class="order-item-copy">
            <span class="order-item-name">{{ item.itemNameSnapshot }}</span>
            <span class="order-item-meta">{{ formatMoney(item.unitPrice) }} / món</span>
            <div v-if="showItemStatuses" class="order-item-statuses">
              <template v-if="canRestoreCancelledItem(item)">
                <span :class="['order-item-status', itemStatusClass(item.status), 'is-active']">
                  {{ itemStatusLabel(item.status) }}
                </span>
                <button
                  type="button"
                  :class="['order-item-restore-btn', { 'is-pending': isPendingItemAction(item.id, 'WAITING') }]"
                  :disabled="props.pendingItemStatusId === item.id"
                  :aria-busy="isPendingItemAction(item.id, 'WAITING') ? 'true' : 'false'"
                  @click="$emit('updateItemStatus', item.id!, 'WAITING')"
                >
                  <span class="order-item-action-label">Phục hồi</span>
                  <span v-if="isPendingItemAction(item.id, 'WAITING')" class="order-item-action-spinner" aria-hidden="true"></span>
                </button>
              </template>
              <template v-else-if="canUpdateItemStatus(item)">
                <button
                  v-for="s in itemStatusActions.filter(s => !(s.value === 'READY' && simplifyStatus(order.status) === 'COMPLETED'))"
                  :key="s.value"
                  type="button"
                  :class="[
                    'order-item-status',
                    itemStatusClass(s.value),
                    {
                      'is-active': item.status === s.value,
                      'is-pending': isPendingItemAction(item.id, s.value),
                    },
                  ]"
                  :disabled="props.pendingItemStatusId === item.id"
                  :aria-busy="isPendingItemAction(item.id, s.value) ? 'true' : 'false'"
                  @click="$emit('updateItemStatus', item.id!, s.value)"
                >
                  <span class="order-item-action-label">{{ s.label }}</span>
                  <span v-if="isPendingItemAction(item.id, s.value)" class="order-item-action-spinner" aria-hidden="true"></span>
                </button>
              </template>
              <span
                v-else
                :class="['order-item-status', itemStatusClass(item.id ? item.status : 'WAITING'), 'is-active']"
              >
                {{ item.id ? itemStatusLabel(item.status) : "Chờ lưu món" }}
              </span>
            </div>
          </div>
          <span class="order-item-total">{{ formatMoney(item.status === "CANCELLED" ? 0 : item.lineTotal) }}</span>
        </div>

        <div v-if="canEdit" class="order-item-editor">
          <button class="btn btn-sm order-qty-btn" type="button" :disabled="busy" @click="changeQty(index, -1)">-</button>
          <span class="order-item-qty">{{ item.quantity }}</span>
          <button class="btn btn-sm order-qty-btn" type="button" :disabled="busy" @click="changeQty(index, 1)">+</button>
        </div>
        <span v-else class="order-item-qty-read">{{ item.quantity }}</span>
      </li>
    </ul>

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
import { formatMoney } from "../../utils/format";

// ─── Types ──────────────────────────────────────────────────────────────
type OrderItem = {
  id: number;
  menuItemId?: number | null;
  dailyMenuItemId?: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: string;
  lineTotal: number;
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
  status: string;
  lineTotal: number;
};

type SavePayload = { dailyMenuItemId?: number; menuItemId?: number; quantity: number };

// ─── Props / Emits ──────────────────────────────────────────────────────
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
  updateItemStatus: [itemId: number, status: string];
}>();

// ─── Constants ──────────────────────────────────────────────────────────
const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
  E_WALLET: "Ví điện tử",
};

const itemStatusActions = [
  { value: "WAITING", label: "Chờ" },
  { value: "COOKING", label: "Đang làm" },
  { value: "READY", label: "Lên món" },
] as const;

// ─── Internal state ─────────────────────────────────────────────────────
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

function flashItem(key: string | number) {
  highlightedKey.value = key;
  setTimeout(() => { highlightedKey.value = null; }, 1200);
}
const removeDialog = reactive({ visible: false, index: -1, itemName: "" });

// Reset draft when server items change (after save or status update)
watch(
  () => props.order.items?.map((i) => `${i.dailyMenuItemId ?? i.menuItemId}:${i.quantity}`).join("|"),
  () => {
    draft.value = null;
    addSelection.value = "";
  }
);

// ─── Helpers ────────────────────────────────────────────────────────────
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

function cloneItems(items: OrderItem[] = []): EditableItem[] {
  return items.map((item, i) => ({
    id: item.id,
    key: `${item.dailyMenuItemId ?? item.menuItemId ?? "item"}-${i}`,
    menuItemId: item.menuItemId ?? null,
    dailyMenuItemId: item.dailyMenuItemId ?? null,
    itemNameSnapshot: item.itemNameSnapshot,
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    status: item.status || "WAITING",
    lineTotal: Number(item.lineTotal || 0),
  }));
}

function ensureDraft() {
  if (!draft.value) draft.value = cloneItems(props.order.items);
}

function discardDraft() {
  draft.value = null;
  addSelection.value = "";
}

// ─── Computed ───────────────────────────────────────────────────────────
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

const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));

const arrivalChanged = computed(() =>
  arrivalMode.value !== initialArrivalMode ||
  (arrivalMode.value === "scheduled" && arrivalTimeDraft.value !== initialArrivalTime)
);

const draftChanged = computed(() => {
  if (!draft.value) return false;
  const orig = cloneItems(props.order.items).map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}`).join("|");
  const curr = draft.value.map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}`).join("|");
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

// ─── Functions ──────────────────────────────────────────────────────────
function progressPct(key: "waiting" | "cooking" | "ready") {
  const total = Number(props.order.itemProgress?.total || 0);
  if (!total) return 0;
  return (Number(props.order.itemProgress?.[key] || 0) / total) * 100;
}

function itemStatusLabel(status?: string | null) {
  if (status === "READY") return "Lên món";
  if (status === "COOKING") return "Đang làm";
  if (status === "CANCELLED") return "Đã hủy";
  return "Chờ";
}

function itemStatusClass(status?: string | null) {
  return `is-${String(status || "WAITING").toLowerCase()}`;
}

function canUpdateItemStatus(item: EditableItem) {
  return (
    canEdit.value &&
    !draftChanged.value &&
    item.status !== "CANCELLED" &&
    typeof item.id === "number" &&
    item.id > 0
  );
}

function canRestoreCancelledItem(item: EditableItem) {
  return (
    simplifyStatus(props.order.status) === "CONFIRMED" &&
    !draftChanged.value &&
    item.status === "CANCELLED" &&
    typeof item.id === "number" &&
    item.id > 0
  );
}

function isPendingItemAction(itemId?: number | null, nextStatus?: string | null) {
  return (
    typeof itemId === "number" &&
    itemId > 0 &&
    props.pendingItemStatusId === itemId &&
    props.pendingItemStatusValue === String(nextStatus || "")
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
    draft.value![index] = { ...item, quantity: next, lineTotal: next * item.unitPrice };
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
  const existing = draft.value!.findIndex((i) => i.dailyMenuItemId === opt.id);
  if (existing >= 0) {
    const cur = draft.value![existing];
    draft.value![existing] = { ...cur, quantity: cur.quantity + 1, lineTotal: (cur.quantity + 1) * cur.unitPrice };
    flashItem(cur.key);
  } else {
    const newKey = `new-${opt.id}`;
    draft.value!.push({
      id: null,
      key: newKey,
      menuItemId: opt.menuItem.id,
      dailyMenuItemId: opt.id,
      itemNameSnapshot: opt.menuItem.name,
      unitPrice: Number(opt.sellingPrice || 0),
      quantity: 1,
      status: "WAITING",
      lineTotal: Number(opt.sellingPrice || 0),
    });
    flashItem(newKey);
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
  border: 1px solid rgba(126, 86, 65, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(var(--line-rgb), 0.72);
}

.order-item-row:last-child { border-bottom: none; }
.order-item-row.is-empty   { justify-content: flex-start; }
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

.order-item-row.is-cancelled .order-item-meta,
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
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
}

.order-item-copy   { display: grid; gap: 2px; min-width: 0; }
.order-item-name   { font-weight: 600; }
.order-item-meta   { color: var(--muted); font-size: 0.84rem; }

.order-item-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.order-item-restore-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(66, 133, 104, 0.22);
  border-radius: 999px;
  background: rgba(66, 133, 104, 0.1);
  color: var(--green);
  font-size: 0.76rem;
  font-weight: 700;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}

.order-item-restore-btn:hover,
.order-item-restore-btn:focus-visible {
  background: rgba(66, 133, 104, 0.16);
  border-color: rgba(66, 133, 104, 0.32);
  outline: none;
}

.order-item-restore-btn:disabled {
  cursor: default;
  opacity: 1;
}

.order-item-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.order-item-restore-btn,
.order-item-status {
  position: relative;
}

.order-item-action-label {
  transition: opacity 0.18s ease;
}

.order-item-restore-btn.is-pending .order-item-action-label,
.order-item-status.is-pending .order-item-action-label {
  opacity: 0.28;
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

.order-item-status.is-waiting  { background: rgba(203, 165, 81, 0.12); color: #8b6517; }
.order-item-status.is-cooking  { background: rgba(201, 126, 71, 0.13); color: #8a451f; }
.order-item-status.is-ready    { background: rgba(66, 133, 104, 0.14); color: var(--green); }
.order-item-status.is-cancelled{ background: rgba(148, 88, 88, 0.14); color: #8f2f15; }
.order-item-status.is-active {
  border-color: currentColor;
  position: relative;
  overflow: hidden;
}

.order-item-status.is-active::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 80%;
  height: 100%;
  background: linear-gradient(
    to right,
    transparent,
    rgba(255, 255, 255, 0.55),
    transparent
  );
  will-change: transform;
  animation: glass-shine 1.2s linear infinite;
  pointer-events: none;
}

.order-item-status:disabled {
  opacity: 1;
  cursor: default;
}

@keyframes order-item-spin {
  to { transform: rotate(360deg); }
}

@keyframes glass-shine {
  from { transform: skewX(-18deg) translateX(-150%); }
  to   { transform: skewX(-18deg) translateX(280%); }
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
  gap: 10px;
  flex: 0 0 auto;
  justify-content: flex-end;
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
  min-width: 32px;
  padding: 0 6px;
  border-radius: 4px;
  background: #fff;
  box-shadow: inset 0 1px 3px rgba(var(--text-rgb), 0.14), inset 0 1px 1px rgba(var(--text-rgb), 0.1);
  flex: 0 0 auto;
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

  .order-item-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
  }

  .order-item-main { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .order-item-total { text-align: left; }

  .order-item-editor { width: auto; align-self: center; justify-content: flex-end; gap: 8px; }

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
