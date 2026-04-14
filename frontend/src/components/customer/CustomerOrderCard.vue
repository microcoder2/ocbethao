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

      <div v-if="canEdit" class="order-editor-accordion">
        <div class="order-editor-accordion__head">
          <div class="order-editor-accordion__copy">
            <span class="order-field-label">Cập nhật đơn</span>
            <button
              type="button"
              class="order-editor-accordion__toggle"
              :aria-expanded="editPanelOpen ? 'true' : 'false'"
              :title="editPanelOpen ? 'Thu gọn' : 'Mở rộng'"
              @click="editPanelOpen = !editPanelOpen"
            >
              <i class="bi bi-pencil-square"></i>
            </button>
          </div>
        </div>

        <div v-if="editPanelOpen" class="order-editor-panel">
          <div class="order-arrival-row order-arrival-row--stacked order-editor-meta-row">
            <div class="order-arrival-field">
              <span class="order-field-label">Giờ hẹn</span>
              <div class="order-arrival-time-shell">
                <i class="bi bi-clock order-arrival-time-icon" aria-hidden="true"></i>
                <input
                  v-model="arrivalTimeDraft"
                  type="time"
                  class="form-control order-arrival-time-input"
                  :disabled="busy"
                  placeholder="Giờ hẹn"
                  min="10:00"
                  max="23:00"
                  @input="handleArrivalTimeInput"
                  @change="handleArrivalTimeInput"
                />
              </div>
            </div>
            <div class="order-arrival-field">
              <span class="order-field-label">Số người</span>
              <input
                v-model="guestCountDraft"
                type="number"
                min="1"
                inputmode="numeric"
                class="form-control order-select order-guest-count-input"
                placeholder="Số người"
                :disabled="busy"
              />
            </div>
            <div class="order-editor-meta-action">
              <button
                class="btn order-add-btn order-add-launch-btn"
                type="button"
                :disabled="busy || !menuOptions.length"
                aria-label="Thêm món"
                title="Thêm món"
                @click="openAddPicker"
              >
                <i class="bi bi-clipboard-plus order-add-launch-icon"></i>
              </button>
            </div>
          </div>

          <div v-if="menuOptions.length" class="order-add-hint">
            Bấm nút thêm món để mở danh sách món.
          </div>
          <div v-else class="order-add-hint">
            Hôm nay không còn món khả dụng để thêm vào đơn này.
          </div>
        </div>
      </div>

      <div v-if="hasPendingSaveChanges" class="order-editor-actions order-editor-actions--outside">
        <div v-if="draftChanged || arrivalChanged" class="order-editor-note">Lưu thay đổi món hoặc giờ hẹn trước khi tiếp tục.</div>
        <button class="btn btn-dark" type="button" :disabled="busy" @click="emitSave">
          {{ isSaving ? "Đang lưu..." : "Lưu" }}
        </button>
        <button class="btn btn-outline-dark" type="button" :disabled="busy" @click="discardDraft">
          Bỏ thay đổi
        </button>
      </div>

      <Teleport to="body">
        <div
          v-if="addPickerOpen"
          class="orders-modal-backdrop orders-modal-backdrop--fullscreen"
          role="dialog"
          aria-modal="true"
          @click.self="closeAddPicker"
        >
          <div class="orders-modal order-picker-modal">
            <div class="order-picker-modal__header">
              <div class="order-picker-modal__heading">
                <div class="orders-modal-title">Thêm món</div>
              </div>
              <button
                class="orders-modal-close order-picker-modal__close"
                type="button"
                aria-label="Đóng"
                @click="closeAddPicker"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
            <div class="order-picker-modal__body">
              <MenuIngredientFilterCard
                :buckets="pickerBuckets"
                :open-bucket-names="Array.from(openCats)"
                :selected-key="selectedGroupKey"
                @toggle-bucket="toggleCat"
                @select-group="handleSelectGroup"
              />

              <fieldset
                v-if="selectedGroup"
                class="quick-order-picker__fieldset quick-order-picker__fieldset--methods"
              >
                <legend class="quick-order-picker__legend quick-order-picker__legend--methods">
                  Cách nấu
                </legend>
                <div class="quick-order-picker__methods">
                  <button
                    v-for="item in pickerIngredientItems"
                    :key="item.id"
                    type="button"
                    class="quick-order-picker__method"
                    :disabled="busy || !canSelectItem(item)"
                    @click="addMenuItem(item)"
                  >
                    <span>{{ methodLabel(item, selectedGroup.label) }}</span>
                    <span class="quick-order-picker__price">{{ formatMoneyShort(item.sellingPrice) }}</span>
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      </Teleport>

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
import MenuIngredientFilterCard from "../common/MenuIngredientFilterCard.vue";
import { buildOrderCardProgressSegments } from "../common/orderCardProgress";
import { formatMoney, formatMoneyShort } from "../../utils/format";
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

type PickerGroup = {
  key: string;
  label: string;
  poolId: number | null;
  remaining: number | null;
  items: MenuOption[];
};

type PickerCategory = {
  name: string;
  groups: PickerGroup[];
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
const highlightedKey = ref<string | null>(null);
const draft = ref<EditableItem[] | null>(null);
const arrivalTimeDraft = ref(props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : "");
const guestCountDraft = ref<string>(formatGuestCountDraft(props.order.guestCount));
const guestCountDirty = ref(false);
const editPanelOpen = ref(false);
const addPickerOpen = ref(false);
const selectedGroupKey = ref<string | null>(null);
const openCats = ref<Set<string>>(new Set());
const removeDialog = reactive({ visible: false, index: -1, itemName: "" });
const openItemNoteKeys = ref<Set<string>>(new Set());

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
    guestCountDraft.value = formatGuestCountDraft(props.order.guestCount);
    guestCountDirty.value = false;
    openItemNoteKeys.value = new Set();
  }
);

watch(
  () => props.order.guestCount,
  (value) => {
    guestCountDraft.value = formatGuestCountDraft(value);
    guestCountDirty.value = false;
  }
);

watch(guestCountDraft, () => {
  guestCountDirty.value = String(guestCountDraft.value ?? "").trim() !== formatGuestCountDraft(props.order.guestCount);
});

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

function handleArrivalTimeInput() {
  // The draft is read directly from arrivalTimeDraft; this keeps the template
  // aligned with the admin card without extra mode state.
}

function formatGuestCountDraft(value?: number | null) {
  const next = Number(value || 0);
  return next > 0 ? String(next) : "";
}

function parseGuestCountDraft(value: string) {
  const next = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(next) && next > 0 ? next : null;
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
  closeAddPicker();
  arrivalTimeDraft.value = initialArrivalTime.value;
  guestCountDraft.value = formatGuestCountDraft(props.order.guestCount);
  guestCountDirty.value = false;
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

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategoryLabel(value: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("hai manh")) return "Hai mảnh";
  if (normalized.includes("oc")) return "Ốc";
  return String(value || "").trim() || "Khác";
}

function openAddPicker() {
  addPickerOpen.value = true;
}

function closeAddPicker() {
  addPickerOpen.value = false;
  selectedGroupKey.value = null;
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

function canSelectItem(item: MenuOption) {
  const remaining = getItemRemaining(item);
  return Boolean(item.isAvailable) && remaining !== 0;
}

function methodLabel(item: MenuOption, ingredientLabel: string) {
  const name = String(item.menuItem?.name || "").trim();
  const label = String(ingredientLabel || "").trim();
  if (!name) return label;

  const normalizedName = normalizeText(name);
  const normalizedLabel = normalizeText(label);
  if (normalizedName.startsWith(normalizedLabel)) {
    const stripped = name.slice(label.length).trim().replace(/^[-·–—\s]+/, "");
    return stripped || name;
  }

  return name;
}

function addMenuItem(opt: MenuOption) {
  if (!canSelectItem(opt)) return;
  const optionMenuItemId = Number(opt.menuItemId ?? opt.menuItem.id);

  ensureDraft();
  const existingIndex = draft.value!.findIndex((item) => item.menuItemId === optionMenuItemId);
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
      itemNameSnapshot: opt.menuItem.name,
      unitPrice: Number(opt.sellingPrice || 0),
      quantity: 1,
      status: "WAITING",
      lineTotal: Number(opt.sellingPrice || 0),
      note: "",
    });
    flashItem(key);
    openItemNoteEditor(key);
  }

  closeAddPicker();
}

function emitSave() {
  emit(
    "saveItems",
    editableItems.value.map((item) => ({
      menuItemId: item.menuItemId ?? undefined,
      quantity: item.quantity,
      note: item.note || undefined,
    })),
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
const editableItems = computed(() => draft.value ?? cloneItems(props.order.items));
const initialArrivalTime = computed(() => (props.order.arrivalAt ? props.order.arrivalAt.slice(11, 16) : ""));
const guestCountValue = computed(() => parseGuestCountDraft(guestCountDraft.value));
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

const CATEGORY_ORDER = ["Hai mảnh", "Ốc", "Khác"];

const pickerCategories = computed((): PickerCategory[] => {
  const categories = new Map<string, Map<string, Omit<PickerGroup, "remaining">>>();

  for (const option of props.menuOptions) {
    const categoryName = normalizeCategoryLabel(option.menuItem?.category?.name ?? "Khác");
    if (!categories.has(categoryName)) {
      categories.set(categoryName, new Map());
    }

    const pool = option.stockLinks?.[0]?.stockPool;
    const label = String(pool?.label || "Khác").trim() || "Khác";
    const poolId = pool?.id ?? null;
    const groupKey = `${categoryName}::${label}::${poolId ?? "none"}`;
    const groups = categories.get(categoryName)!;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { key: groupKey, label, poolId, items: [] });
    }

    groups.get(groupKey)!.items.push(option);
  }

  const groupedCategories = Array.from(categories.entries()).map(([name, groups]) => ({
    name,
    groups: Array.from(groups.values()).map((group) => ({
      ...group,
      remaining: group.items.length > 0 ? getItemRemaining(group.items[0]) : null,
    })),
  }));

  return groupedCategories.sort((left, right) => {
    const leftRank = CATEGORY_ORDER.indexOf(left.name);
    const rightRank = CATEGORY_ORDER.indexOf(right.name);

    if (leftRank !== rightRank) {
      return (leftRank === -1 ? CATEGORY_ORDER.length : leftRank) - (rightRank === -1 ? CATEGORY_ORDER.length : rightRank);
    }

    return left.name.localeCompare(right.name, "vi");
  });
});

const selectedGroup = computed((): PickerGroup | null => {
  if (!selectedGroupKey.value) return null;

  for (const category of pickerCategories.value) {
    const group = category.groups.find((entry) => entry.key === selectedGroupKey.value);
    if (group) {
      return group;
    }
  }

  return null;
});

const pickerIngredientItems = computed(() => selectedGroup.value?.items ?? []);
const pickerBuckets = computed(() =>
  pickerCategories.value.map((category) => ({
    name: category.name,
    groups: category.groups.map((group) => ({
      key: group.key,
      label: group.label,
      badge: group.remaining,
      items: group.items,
    })),
  }))
);

watch(
  pickerCategories,
  (categories) => {
    const nextOpenCats = new Set(
      [...openCats.value].filter((name) => categories.some((category) => category.name === name))
    );

    for (const category of categories) {
      nextOpenCats.add(category.name);
    }

    openCats.value = nextOpenCats;

    if (
      selectedGroupKey.value &&
      !categories.some((category) =>
        category.groups.some((group) => group.key === selectedGroupKey.value)
      )
    ) {
      selectedGroupKey.value = null;
    }
  },
  { immediate: true }
);

function toggleCat(name: string) {
  const next = new Set(openCats.value);
  if (next.has(name)) {
    next.delete(name);
    const category = pickerCategories.value.find((entry) => entry.name === name);
    if (category?.groups.some((group) => group.key === selectedGroupKey.value)) {
      selectedGroupKey.value = null;
    }
  } else {
    next.add(name);
  }
  openCats.value = next;
}

function handleSelectGroup(key: string) {
  selectedGroupKey.value = selectedGroupKey.value === key ? null : key;
}

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
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.58fr) auto;
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
  min-height: 34px;
  height: 34px;
  padding-left: 30px;
  border-radius: 12px;
  font-size: 0.88rem;
}

.order-editor-meta-row .order-guest-count-input.order-select {
  min-height: 34px;
  height: 34px;
  border-radius: 12px;
  font-size: 0.88rem;
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

.order-picker-modal {
  width: min(1040px, calc(100vw - 32px));
  max-height: min(900px, calc(100dvh - 32px));
  overflow: hidden;
  padding: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: stretch;
  text-align: left;
}

.order-picker-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.98);
}

.order-picker-modal__heading {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.order-picker-modal__body {
  display: grid;
  gap: 10px;
  min-height: 0;
  padding: 14px 18px 18px;
  overflow: auto;
  overscroll-behavior: contain;
}

.order-picker-modal__close {
  position: static;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--muted);
}

.order-picker-modal__close:hover,
.order-picker-modal__close:focus-visible {
  background: rgba(var(--text-rgb), 0.1);
  color: var(--text);
  outline: none;
}

.quick-order-picker {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}

.quick-order-picker__fieldset--methods {
  display: grid;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(var(--ember-rgb), 0.25);
  border-radius: 10px;
  background: rgba(var(--ember-rgb), 0.03);
}

.quick-order-picker__legend--methods {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ember-strong);
  cursor: default;
  user-select: none;
}

.quick-order-picker__methods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
}

.quick-order-picker__method {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  border-radius: 10px;
  background: rgba(var(--panel-rgb), 0.9);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
}

.quick-order-picker__price {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(var(--muted-rgb), 0.08);
}

.quick-order-picker__method:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.4);
  color: var(--ember-strong);
  transform: translateY(-1px);
}

.quick-order-picker__method:disabled {
  opacity: 0.5;
  cursor: default;
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
