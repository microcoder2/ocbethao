<template>
  <article :class="['order-card', surfaceClass, { 'is-collapsed': collapsed }]">
    <div class="order-card-head">
      <div class="order-head-main">
        <div class="order-head-label">Đơn {{ order.orderNumber }}</div>
        <div class="order-head-meta">
          <span>{{ formatDate(order.createdAt) }}</span>
          <span v-if="order.arrivalAt">Giờ hẹn {{ queueTime }}</span>
        </div>
      </div>
      <div class="order-head-side">
        <div class="order-total">{{ formatMoney(displayTotal) }}</div>
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

    <div class="order-status-line">
      <span class="order-arrival-chip">{{ order.arrivalAt ? `Giờ hẹn ${queueTime}` : 'Chưa xác định' }}</span>
      <span v-if="hasProgress" class="order-pill is-muted">{{ progressText }}</span>
      <span class="order-item-count-chip">{{ editableItems.length }} món</span>
      <span :class="['order-pill', simpleStatusClass]">{{ statusLabel }}</span>
    </div>

    <div v-show="!collapsed" class="order-collapsible">
      <div v-if="hasProgress" class="order-progress">
        <div class="order-progress-head">
          <strong>{{ progressText }}</strong>
        </div>
        <div class="order-progress-track">
          <span class="order-progress-segment is-waiting" :style="{ width: `${pendingPct}%` }"></span>
          <span class="order-progress-segment is-ready" :style="{ width: `${readyPct}%` }"></span>
        </div>
        <div class="order-progress-legend">
          <span>Đang chờ {{ pendingCount }}</span>
          <span>Sẵn sàng {{ readyCount }}</span>
        </div>
      </div>

      <ul class="order-item-list">
        <li v-if="!editableItems.length" class="order-item-row is-empty">
          <span class="order-item-name">Chưa có món</span>
        </li>
        <li
          v-for="(item, index) in editableItems"
          :key="item.key"
          :class="['order-item-row', { 'is-highlighted': highlightedKey === item.key }]"
        >
          <div class="order-item-main">
            <div class="order-item-copy">
              <span class="order-item-name">{{ item.itemNameSnapshot }}</span>
              <span class="order-item-meta">{{ formatMoney(item.unitPrice) }} / món</span>
              <div class="order-item-statuses">
                <span :class="['order-item-status', itemStatusClass(item.status), 'is-active']">
                  {{ itemStatusLabel(item.status) }}
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
          <span v-else class="order-item-qty-read">x{{ item.quantity }}</span>
        </li>
      </ul>

      <div v-if="canEdit" class="order-editor-panel">
        <div class="order-arrival-row">
          <div class="order-add-field">
            <span class="order-field-label">Giờ hẹn</span>
            <div class="order-arrival-control">
              <i class="bi bi-clock"></i>
              <input
                v-model="arrivalTimeDraft"
                type="time"
                class="form-control order-arrival-time-input"
                :disabled="busy"
                min="10:00"
                max="23:00"
              />
            </div>
          </div>
        </div>

        <div v-if="menuOptions.length" class="order-add-row">
          <div class="order-add-field">
            <span class="order-field-label">Cập nhật đơn</span>
            <div class="order-add-control">
              <select v-model="addSelection" class="form-select order-select" :disabled="busy">
                <option value="">Chọn món để thêm</option>
                <option v-for="option in menuOptions" :key="option.id" :value="String(option.id)">
                  {{ option.menuItem.name }} · {{ formatMoney(option.sellingPrice) }}
                </option>
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
        <div v-else class="order-add-hint">Hôm nay không còn món khả dụng để thêm vào đơn này.</div>

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

      <div v-if="canCancel" class="order-actions">
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
    </div>

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
import { formatDate, formatMoney } from "../../utils/format";

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
  totalAmount: number;
  arrivalAt?: string | null;
  createdAt: string;
  items?: OrderItem[];
  itemProgress?: { total: number; ready: number };
};

type MenuOption = {
  id: number;
  sellingPrice: number;
  isAvailable: boolean;
  menuItem: { id: number; name: string };
};

type EditableItem = {
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

const props = defineProps<{
  order: OrderRecord;
  menuOptions: MenuOption[];
  busy: boolean;
  isSaving: boolean;
  isCancelling: boolean;
  errorMessage?: string;
}>();

const emit = defineEmits<{
  saveItems: [items: SavePayload[], arrivalTime?: string];
  requestCancel: [];
}>();

const collapsed = ref(["COMPLETED", "CANCELLED"].includes(props.order.status));
const addSelection = ref("");
const highlightedKey = ref<string | null>(null);
const draft = ref<EditableItem[] | null>(null);
const arrivalTimeDraft = ref(props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "");
const removeDialog = reactive({ visible: false, index: -1, itemName: "" });

watch(
  () => `${props.order.status}|${(props.order.items || []).map((item) => `${item.dailyMenuItemId ?? item.menuItemId}:${item.quantity}`).join("|")}`,
  () => {
    draft.value = null;
    addSelection.value = "";
    arrivalTimeDraft.value = props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "";
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
    key: `${item.dailyMenuItemId ?? item.menuItemId ?? "item"}-${index}`,
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
  if (!draft.value) {
    draft.value = cloneItems(props.order.items);
  }
}

function discardDraft() {
  draft.value = null;
  addSelection.value = "";
  arrivalTimeDraft.value = initialArrivalTime.value;
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

  ensureDraft();
  const existingIndex = draft.value!.findIndex((item) => item.dailyMenuItemId === option.id);
  if (existingIndex >= 0) {
    const current = draft.value![existingIndex];
    draft.value![existingIndex] = {
      ...current,
      quantity: current.quantity + 1,
      lineTotal: (current.quantity + 1) * current.unitPrice,
    };
    flashItem(current.key);
  } else {
    const key = `new-${option.id}`;
    draft.value!.push({
      key,
      menuItemId: option.menuItem.id,
      dailyMenuItemId: option.id,
      itemNameSnapshot: option.menuItem.name,
      unitPrice: Number(option.sellingPrice || 0),
      quantity: 1,
      status: "WAITING",
      lineTotal: Number(option.sellingPrice || 0),
    });
    flashItem(key);
  }
  addSelection.value = "";
}

function emitSave() {
  emit(
    "saveItems",
    editableItems.value.map((item) => ({
      dailyMenuItemId: item.dailyMenuItemId ?? undefined,
      menuItemId: item.menuItemId ?? undefined,
      quantity: item.quantity,
    })),
    arrivalChanged.value ? arrivalTimeDraft.value : undefined
  );
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

const surfaceClass = computed(() => `is-status-${simplifyStatus(props.order.status).toLowerCase()}`);
const simpleStatusClass = computed(() => `is-${simplifyStatus(props.order.status).toLowerCase()}`);

const statusLabel = computed(() => {
  const status = simplifyStatus(props.order.status);
  if (status === "PENDING") return "Chờ xác nhận";
  if (status === "CONFIRMED") return "Đang xử lý";
  if (status === "COMPLETED") return "Hoàn tất";
  return "Đã hủy";
});

const queueTime = computed(() => formatTime(props.order.arrivalAt));
const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));
const initialArrivalTime = computed(() => (props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : ""));
const hasProgress = computed(() => Boolean(props.order.itemProgress?.total));
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
const draftChanged = computed(() => {
  if (!draft.value) return false;
  const original = cloneItems(props.order.items).map((item) => `${item.dailyMenuItemId}:${item.menuItemId}:${item.quantity}`).join("|");
  const current = draft.value.map((item) => `${item.dailyMenuItemId}:${item.menuItemId}:${item.quantity}`).join("|");
  return original !== current;
});
const arrivalChanged = computed(() => {
  const next = String(arrivalTimeDraft.value || "").trim();
  if (!next) return false;
  return next !== initialArrivalTime.value;
});
const canEdit = computed(() => simplifyStatus(props.order.status) === "PENDING");
const canCancel = computed(() => {
  const status = simplifyStatus(props.order.status);
  return status === "PENDING" || status === "CONFIRMED";
});
const displayTotal = computed(() => {
  if (!draftChanged.value) return Number(props.order.totalAmount || 0);
  return editableItems.value.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
});
</script>

<style scoped>
.order-card {
  --order-status-surface: rgba(var(--panel-rgb), 0.98);
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid rgba(var(--line-rgb), 0.86);
  border-radius: 22px;
  background: var(--order-status-surface);
  box-shadow: 0 14px 28px rgba(var(--text-rgb), 0.06);
}

.order-card.is-collapsed { gap: 8px; }
.order-collapsible { display: grid; gap: 14px; }

.order-card.is-status-pending   { --order-status-surface: rgba(203, 165, 81, 0.11); }
.order-card.is-status-confirmed { --order-status-surface: rgba(201, 126, 71, 0.09); }
.order-card.is-status-completed { --order-status-surface: rgba(66, 133, 104, 0.1); }
.order-card.is-status-cancelled { --order-status-surface: rgba(148, 88, 88, 0.08); }

.order-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-head-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.order-head-label {
  font-size: 0.96rem;
  font-weight: 800;
  color: var(--text);
}

.order-head-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--muted);
  font-size: 0.82rem;
}

.order-head-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.order-total {
  font-weight: 800;
  color: var(--ember-strong);
}

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

.order-collapse-btn i {
  font-size: 0.82rem;
}

.order-status-line {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) repeat(3, auto);
  gap: 8px;
}

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

.order-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  white-space: nowrap;
}

.order-pill.is-pending   { background: rgba(203, 165, 81, 0.18); color: #8b6517; }
.order-pill.is-confirmed { background: rgba(201, 126, 71, 0.16); color: #8a451f; }
.order-pill.is-completed { background: rgba(66, 133, 104, 0.15); color: var(--green); }
.order-pill.is-cancelled { background: rgba(148, 88, 88, 0.14); color: #8f2f15; }
.order-pill.is-muted     { background: rgba(var(--text-rgb), 0.06); color: var(--muted); }

.order-item-count-chip {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
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
.order-progress-segment.is-ready { background: rgba(66, 133, 104, 0.78); }

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

.order-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(var(--line-rgb), 0.72);
}

.order-item-row:last-child { border-bottom: none; }
.order-item-row.is-empty { justify-content: flex-start; }
.order-item-row.is-highlighted { animation: item-flash 1.2s ease-out forwards; border-radius: 6px; }

.order-item-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
}

.order-item-copy { display: grid; gap: 2px; min-width: 0; }
.order-item-name { font-weight: 600; }
.order-item-meta { color: var(--muted); font-size: 0.84rem; }

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

.order-item-status.is-waiting { background: rgba(203, 165, 81, 0.12); color: #8b6517; }
.order-item-status.is-cooking { background: rgba(201, 126, 71, 0.13); color: #8a451f; }
.order-item-status.is-ready { background: rgba(66, 133, 104, 0.14); color: var(--green); }
.order-item-status.is-cancelled { background: rgba(148, 88, 88, 0.14); color: #8f2f15; }
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
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.55), transparent);
  animation: glass-shine 1.2s linear infinite;
  pointer-events: none;
}

@keyframes glass-shine {
  from { transform: skewX(-18deg) translateX(-150%); }
  to { transform: skewX(-18deg) translateX(280%); }
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

.order-item-qty,
.order-item-qty-read {
  min-width: 32px;
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

.order-qty-btn:hover {
  background: #f5f5f5;
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
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
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
  .order-card {
    padding: 16px;
    border-radius: 18px;
  }

  .order-card-head {
    gap: 12px;
  }

  .order-head-side {
    min-width: 96px;
  }

  .order-status-line {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .order-progress-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .order-item-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
  }

  .order-item-main {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .order-item-total {
    text-align: left;
  }

  .order-item-editor {
    align-self: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .order-qty-btn,
  .order-item-qty,
  .order-item-qty-read {
    min-width: 22px;
    height: 22px;
    line-height: 22px;
  }

  .orders-modal {
    padding: 18px;
  }
}
</style>
