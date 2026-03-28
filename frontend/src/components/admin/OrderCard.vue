<template>
  <article :class="['order-card', surfaceClass]">
    <!-- Head -->
    <div class="order-card-head">
      <div class="order-head-main">
        <div class="order-contact-line">
          <span class="order-customer-name">{{ customerName }}</span>
          <span class="order-customer-phone">{{ customerPhone }}</span>
        </div>
      </div>
      <div class="order-head-side">
        <button
          class="order-info-trigger"
          type="button"
          :title="infoTooltip"
          :aria-label="`Thông tin đơn ${order.orderNumber}`"
        >
          <i class="bi bi-info-circle"></i>
        </button>
        <div class="order-total">{{ formatMoney(order.totalAmount) }}</div>
      </div>
    </div>

    <!-- Status line -->
    <div class="order-status-line">
      <span class="order-arrival-chip">Giờ hẹn {{ queueTime }}</span>
      <span :class="['order-pill', simpleStatusClass]">{{ statusLabel }}</span>
    </div>

    <!-- Payment badge -->
    <div v-if="showPaymentMethod" class="order-badges">
      <span v-if="order.paymentMethod" class="order-pill is-muted">
        {{ paymentMethodLabel }}
      </span>
    </div>

    <!-- Progress -->
    <div v-if="order.itemProgress?.total" class="order-progress">
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
        class="order-item-row"
      >
        <div class="order-item-main">
          <div class="order-item-copy">
            <span class="order-item-name">{{ item.itemNameSnapshot }}</span>
            <span class="order-item-meta">{{ formatMoney(item.unitPrice) }} / món</span>
            <div class="order-item-statuses">
              <template v-if="canUpdateItemStatus(item)">
                <button
                  v-for="s in itemStatusActions"
                  :key="s.value"
                  type="button"
                  :class="['order-item-status', itemStatusClass(s.value), { 'is-active': item.status === s.value }]"
                  @click="$emit('updateItemStatus', item.id!, s.value)"
                >{{ s.label }}</button>
              </template>
              <span
                v-else
                :class="['order-item-status', itemStatusClass(item.id ? item.status : 'WAITING'), 'is-active']"
              >
                {{ item.id ? itemStatusLabel(item.status) : "Chờ lưu món" }}
              </span>
            </div>
          </div>
          <span class="order-item-total">{{ formatMoney(item.lineTotal) }}</span>
        </div>

        <div v-if="canEdit" class="order-item-editor">
          <button class="btn btn-sm order-qty-btn" type="button" :disabled="busy" @click="changeQty(index, -1)">-</button>
          <span class="order-item-qty">{{ item.quantity }}</span>
          <button class="btn btn-sm order-qty-btn" type="button" :disabled="busy" @click="changeQty(index, 1)">+</button>
        </div>
        <span v-else class="order-item-qty-read">{{ item.quantity }}</span>
      </li>
    </ul>

    <!-- Edit panel (CONFIRMED only) -->
    <div v-if="canEdit" class="order-editor-panel">
      <div v-if="menuOptions.length" class="order-add-row">
        <div class="order-add-field">
          <span class="order-field-label">Thêm món vào đơn</span>
          <div class="order-add-control">
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
      </div>
      <div v-else class="order-add-hint">
        Hôm nay không còn món khả dụng để thêm vào đơn này.
      </div>

      <div v-if="draftChanged" class="order-editor-actions">
        <div class="order-editor-note">Lưu thay đổi món trước khi hoàn tất hoặc hủy đơn.</div>
        <button class="btn btn-dark" type="button" :disabled="busy" @click="emitSave">
          {{ isSaving ? "Đang lưu..." : "Lưu món" }}
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
import { computed, reactive, ref, watch } from "vue";
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
}>();

const emit = defineEmits<{
  confirm: [];
  openComplete: [];
  openCancel: [];
  saveItems: [items: SavePayload[]];
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
const draft = ref<EditableItem[] | null>(null);
const addSelection = ref("");
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

const draftChanged = computed(() => {
  if (!draft.value) return false;
  const orig = cloneItems(props.order.items).map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}`).join("|");
  const curr = draft.value.map((i) => `${i.dailyMenuItemId}:${i.menuItemId}:${i.quantity}`).join("|");
  return orig !== curr;
});

const canEdit    = computed(() => simplifyStatus(props.order.status) === "CONFIRMED");
const canConfirm = computed(() => simplifyStatus(props.order.status) === "PENDING");
const canComplete = computed(() => simplifyStatus(props.order.status) === "CONFIRMED");
const canCancel  = computed(() => {
  const s = simplifyStatus(props.order.status);
  return s === "PENDING" || s === "CONFIRMED";
});
const readyToComplete = computed(() => {
  const p = props.order.itemProgress;
  return Boolean(p?.total && p.waiting === 0 && p.cooking === 0);
});

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
  return canEdit.value && !draftChanged.value && !props.busy && typeof item.id === "number" && item.id > 0;
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
  } else {
    draft.value!.push({
      id: null,
      key: `new-${opt.id}`,
      menuItemId: opt.menuItem.id,
      dailyMenuItemId: opt.id,
      itemNameSnapshot: opt.menuItem.name,
      unitPrice: Number(opt.sellingPrice || 0),
      quantity: 1,
      status: "WAITING",
      lineTotal: Number(opt.sellingPrice || 0),
    });
  }
  addSelection.value = "";
}

function emitSave() {
  if (!draft.value) return;
  emit("saveItems", draft.value.map((i) => ({
    dailyMenuItemId: i.dailyMenuItemId ?? undefined,
    menuItemId: i.menuItemId ?? undefined,
    quantity: i.quantity,
  })));
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

.order-contact-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}

.order-customer-name { font-weight: 700; }
.order-customer-phone { color: var(--muted); font-size: 0.9rem; }

.order-status-line {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.order-arrival-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px 0 0;
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
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
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

.order-item-status {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
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
  min-width: 40px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
  text-align: center;
  font-weight: 800;
  line-height: 38px;
  font-variant-numeric: tabular-nums;
}

.order-qty-btn {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(var(--text-rgb), 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(243, 234, 226, 0.94));
  box-shadow: 0 10px 18px rgba(var(--text-rgb), 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  color: var(--text);
}

.order-qty-btn:hover  { transform: translateY(-1px); }
.order-qty-btn:active { transform: translateY(1px); box-shadow: 0 5px 10px rgba(var(--text-rgb), 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.92); }

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
  grid-template-columns: minmax(0, 1fr) auto;
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
  min-width: 40px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  flex: 0 0 auto;
  text-align: center;
  font-weight: 800;
  line-height: 38px;
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
    min-width: 36px;
    height: 36px;
    line-height: 36px;
  }

  .order-add-control { grid-template-columns: minmax(0, 1fr) auto; }

  .orders-modal { padding: 18px; }
}
</style>
