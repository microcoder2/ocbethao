<template>
  <section class="grocery-expense">
    <div v-if="notice" class="grocery-expense__notice" :class="`is-${notice.kind}`">
      {{ notice.text }}
    </div>

    <section class="grocery-expense__header">
      <div class="grocery-expense__header-top">
        <div class="grocery-expense__header-label">
          <i class="bi bi-cash-coin"></i>
          <span>GHI TIỀN CHỢ</span>
        </div>

        <div class="grocery-expense__header-actions">
          <button
            class="grocery-expense__action-btn"
            :class="{ 'is-spin': loading }"
            aria-label="Làm mới"
            title="Làm mới"
            type="button"
            @click="refreshPageState"
          >
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button
            class="grocery-expense__toggle-btn"
            type="button"
            :aria-expanded="panelExpanded"
            :aria-label="panelExpanded ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'"
            :title="panelExpanded ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'"
            @click="togglePanel"
          >
            <i :class="panelExpanded ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"></i>
          </button>
        </div>
      </div>

      <div v-if="panelExpanded" class="grocery-expense__filters">
        <label class="grocery-expense__field grocery-expense__field--search">
          <span class="grocery-expense__field-label">Tìm nguyên liệu</span>
          <div class="grocery-expense__search">
            <i class="bi bi-search"></i>
            <input
              v-model.trim="search"
              class="grocery-expense__input grocery-expense__input--search"
              type="search"
              autocomplete="off"
              spellcheck="false"
              placeholder="Tên, mã, đơn vị..."
            />
          </div>
        </label>

        <label class="grocery-expense__field">
          <span class="grocery-expense__field-label">Ngày ghi</span>
          <div class="grocery-expense__date-wrap">
            <i class="bi bi-calendar3 grocery-expense__date-icon"></i>
            <input
              v-model="recordDate"
              class="grocery-expense__input grocery-expense__input--date"
              type="date"
            />
          </div>
        </label>
      </div>
    </section>

    <section class="grocery-expense__list-card">
      <div v-if="loading" class="grocery-expense__loading">
        <i class="bi bi-hourglass-split"></i>
        <span>Đang tải...</span>
      </div>

      <div v-else class="grocery-expense__table-shell">
        <DataTable
          :columns="columns"
          :items="filteredRows"
          row-key="id"
          :loading="false"
          empty-text="Không có nguyên liệu phù hợp."
          responsive-class="grocery-expense__table-responsive"
          table-class="grocery-expense__table"
          header-row-class="grocery-expense__header-row text-muted small"
          header-cell-class="grocery-expense__th"
          body-row-class="grocery-expense__tr"
          body-cell-class="grocery-expense__td"
          action-header-class="grocery-expense__th grocery-expense__th--action"
          action-header-text="Thao tác"
          action-cell-class="grocery-expense__td grocery-expense__td--action"
          empty-cell-class="grocery-expense__empty"
        >
          <template #cell-name="{ row }">
            <button class="grocery-expense__name-btn" type="button" @click="openPriceEditor(row)">
              <div class="grocery-expense__name">{{ row.name }}</div>
              <div v-if="drafts[row.id]?.note" class="grocery-expense__note">
                {{ drafts[row.id].note }}
              </div>
              <div class="grocery-expense__mobile-qty">
                {{ formatRemainingQuantityLabel(row) }}
              </div>
            </button>
          </template>

          <template #cell-amount="{ row }">
            <button class="grocery-expense__price" type="button" @click="openPriceEditor(row)">
              {{ formatDraftAmount(row.id) }}
            </button>
          </template>

          <template #row-actions="{ row }">
            <div v-if="deleteConfirmId === row.id" class="grocery-expense__row-actions grocery-expense__row-actions--confirm">
              <button
                class="grocery-expense__icon-btn grocery-expense__icon-btn--confirm"
                type="button"
                :disabled="saving"
                :aria-label="`Xác nhận xóa dòng ${row.name}`"
                title="Xác nhận"
                @click="clearRowDraft(row)"
              >
                <i class="bi bi-check-lg"></i>
              </button>
              <button
                class="grocery-expense__icon-btn grocery-expense__icon-btn--cancel"
                type="button"
                :disabled="saving"
                :aria-label="`Hủy xóa dòng ${row.name}`"
                title="Hủy"
                @click="cancelClearRow"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
            <div v-else class="grocery-expense__row-actions">
              <button
                class="grocery-expense__icon-btn grocery-expense__icon-btn--edit"
                type="button"
                :disabled="saving"
                :aria-label="`Sửa giá tiền của ${row.name}`"
                title="Sửa giá"
                @click="openPriceEditor(row)"
              >
                <i class="bi bi-pencil-square"></i>
              </button>
              <button
                class="grocery-expense__icon-btn grocery-expense__icon-btn--danger"
                type="button"
                :disabled="saving && !drafts[row.id]?.amount && !drafts[row.id]?.note"
                :aria-label="`Xóa dòng ${row.name}`"
                title="Xóa"
                @click="requestClearRow(row)"
              >
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="grocery-expense-fade" @after-leave="resetPriceEditorState">
        <div
          v-if="priceEditorOpen"
          class="grocery-expense__editor-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="grocery-expense-editor-title"
          @click.self="closePriceEditor"
        >
          <div class="grocery-expense__editor">
            <div class="grocery-expense__editor-head">
              <h3 id="grocery-expense-editor-title" class="grocery-expense__editor-title">
                {{ priceEditorRow?.name || "Nguyên liệu" }}
              </h3>
              <button class="grocery-expense__editor-close" type="button" aria-label="Đóng" @click="closePriceEditor">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>

            <label class="grocery-expense__editor-field">
              <span>Giá tiền</span>
              <input
                ref="priceEditorInputRef"
                v-model="priceEditorValue"
                class="form-control grocery-expense__editor-input"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                placeholder="0"
                @keydown.enter.prevent="savePriceEditor"
                @keydown.esc.prevent="closePriceEditor"
              />
            </label>

            <label class="grocery-expense__editor-field">
              <span>Ghi chú</span>
              <input
                v-model.trim="priceEditorNoteValue"
                class="form-control grocery-expense__editor-input grocery-expense__editor-input--note"
                type="text"
                autocomplete="off"
                placeholder="VD: 1 phần = 1kg"
                @keydown.enter.prevent="savePriceEditor"
                @keydown.esc.prevent="closePriceEditor"
              />
            </label>

            <div class="grocery-expense__editor-preview">
              <strong>{{ formatMoney(normalizeMoney(priceEditorValue)) }}</strong>
              <span>{{ priceEditorNoteValue || "Chưa có ghi chú phần." }}</span>
            </div>

            <div class="grocery-expense__editor-footer">
              <button
                class="btn btn-ember grocery-expense__editor-save"
                type="button"
                :disabled="saving"
                @click="savePriceEditor"
              >
                <i class="bi bi-save2"></i>
                <span>Lưu</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../api";
import DataTable from "../common/DataTable.vue";
import { formatMoney } from "../../utils/format";
import { socket } from "../../socket";

type Ingredient = {
  id: number;
  name: string;
  slug: string;
  unit: string;
  isActive: boolean;
};

type IngredientStock = {
  id: number;
  ingredientId: number;
  label: string | null;
  quantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  isAvailable: boolean;
  ingredient: Ingredient | null;
};

type GroceryExpenseRow = {
  id: number;
  ingredientId: number;
  name: string;
  slug: string;
  unit: string;
  remainingQuantity: number;
  soldQuantity: number;
};

type GroceryExpenseDraft = {
  amount: string;
  note: string;
};

type GroceryExpenseNotice = {
  kind: "success" | "info" | "error";
  text: string;
};

type GroceryExpenseResponse = {
  id: number;
  amount: number;
  note: string | null;
  recordedAt: string;
  recordedDate: string;
  breakdown: Array<{
    ingredientId: number;
    ingredientName: string | null;
    unit: string | null;
    remainingQuantity: number;
    amount: number;
    note: string | null;
  }>;
};

type GroceryExpenseLookupResponse = {
  expense: GroceryExpenseResponse | null;
};

const columns = [
  { key: "name", title: "Nguyên liệu" },
  {
    key: "amount",
    title: "Giá tiền",
    thClass: "grocery-expense__th--amount",
    tdClass: "grocery-expense__td--amount",
  },
];

const rows = ref<GroceryExpenseRow[]>([]);
const search = ref("");
const recordDate = ref(getLocalDateValue());
const note = ref("");
const loading = ref(false);
const saving = ref(false);
const notice = ref<GroceryExpenseNotice | null>(null);
const panelExpanded = ref(true);
const drafts = reactive<Record<number, GroceryExpenseDraft>>({});
const loadedExpense = ref<GroceryExpenseResponse | null>(null);
const loadedExpenseDate = ref<string | null>(null);
const deleteConfirmId = ref<number | null>(null);
const priceEditorOpen = ref(false);
const priceEditorRowId = ref<number | null>(null);
const priceEditorValue = ref("");
const priceEditorNoteValue = ref("");
const priceEditorInputRef = ref<HTMLInputElement | null>(null);
const priceEditorRow = computed(
  () => rows.value.find((row) => row.id === priceEditorRowId.value) ?? null
);

let loadSeq = 0;
let expenseLoadSeq = 0;

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function getLocalDateValue(base = new Date()) {
  const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatQuantity(value: number) {
  const amount = Number(value || 0);
  return amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatRemainingQuantityLabel(row: GroceryExpenseRow) {
  const unit = row.unit ? ` ${row.unit}` : "";
  return `SL: ${formatQuantity(row.remainingQuantity)}${unit}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeMoney(value: unknown) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function normalizeAmountInput(value: string | number) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) && amount > 0 ? String(amount) : "";
}

function normalizeDraftNote(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function setNotice(kind: GroceryExpenseNotice["kind"], text: string) {
  notice.value = { kind, text };
}

function togglePanel() {
  panelExpanded.value = !panelExpanded.value;
}

function getLoadedExpenseDraft(ingredientId: number) {
  const expense = loadedExpense.value;
  if (!expense || loadedExpenseDate.value !== recordDate.value) {
    return null;
  }

  const item = expense.breakdown.find((entry) => entry.ingredientId === ingredientId);
  if (!item) {
    return null;
  }

  return {
    amount: normalizeAmountInput(item.amount),
    note: normalizeDraftNote(item.note || ""),
  };
}

function syncDrafts(nextRows: GroceryExpenseRow[]) {
  const nextIds = new Set(nextRows.map((row) => row.id));
  if (deleteConfirmId.value != null && !nextIds.has(deleteConfirmId.value)) {
    deleteConfirmId.value = null;
  }

  if (priceEditorRowId.value != null && !nextIds.has(priceEditorRowId.value)) {
    closePriceEditor();
  }

  for (const key of Object.keys(drafts)) {
    const id = Number(key);
    if (!nextIds.has(id)) {
      delete drafts[id];
    }
  }

  for (const row of nextRows) {
    if (!drafts[row.id]) {
      drafts[row.id] = getLoadedExpenseDraft(row.ingredientId) || {
        amount: "",
        note: "",
      };
    } else if (typeof drafts[row.id].note === "undefined") {
      drafts[row.id].note = "";
    }
  }
}

function applyExpenseDrafts(expense: GroceryExpenseResponse | null) {
  loadedExpense.value = expense;
  loadedExpenseDate.value = expense?.recordedDate ?? null;
  note.value = expense?.note ?? "";

  const breakdownMap = new Map(
    expense?.breakdown.map((item) => [item.ingredientId, item] as const) ?? []
  );

  for (const row of rows.value) {
    const item = breakdownMap.get(row.ingredientId);
    drafts[row.id] = item
      ? {
          amount: normalizeAmountInput(item.amount),
          note: normalizeDraftNote(item.note || ""),
        }
      : {
          amount: "",
          note: "",
        };
  }
}

function buildExpensePayload() {
  const breakdown = rows.value
    .map((row) => ({
      ingredientId: row.ingredientId,
      ingredientName: row.name,
      unit: row.unit || null,
      remainingQuantity: row.remainingQuantity,
      amount: normalizeMoney(drafts[row.id]?.amount),
      note: normalizeDraftNote(drafts[row.id]?.note || "") || undefined,
    }))
    .filter((item) => item.amount > 0);

  const amount = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    amount,
    note: note.value.trim() || undefined,
    date: recordDate.value,
    breakdown,
  };
}

async function persistExpenseState() {
  const payload = buildExpensePayload();

  if (!payload.breakdown.length && loadedExpenseDate.value !== recordDate.value) {
    setNotice("error", "Hãy nhập số tiền cho ít nhất một nguyên liệu.");
    return null;
  }

  saving.value = true;

  try {
    const { data } = await api.post("/inventory-movements/grocery-expense", payload);
    const response = data as GroceryExpenseResponse;
    applyExpenseDrafts(response.amount > 0 ? response : null);
    expenseLoadSeq += 1;

    if (response.amount > 0) {
      setNotice(
        "success",
        `Đã lưu tiền chợ ngày ${formatDateLabel(response.recordedAt)} với tổng ${formatMoney(response.amount)}.`
      );
    } else {
      setNotice("success", `Đã xoá tiền chợ ngày ${formatDateLabel(response.recordedAt)}.`);
    }

    return response;
  } catch (error) {
    setNotice("error", getErrorMessage(error, "Không ghi được tiền chợ."));
    return null;
  } finally {
    saving.value = false;
  }
}

function setAmount(rowId: number, value: string) {
  if (!drafts[rowId]) {
    drafts[rowId] = { amount: "", note: "" };
  } else if (typeof drafts[rowId].note === "undefined") {
    drafts[rowId].note = "";
  }
  drafts[rowId].amount = normalizeAmountInput(value);
}

function setNote(rowId: number, value: string) {
  if (!drafts[rowId]) {
    drafts[rowId] = { amount: "", note: "" };
  } else if (typeof drafts[rowId].note === "undefined") {
    drafts[rowId].note = "";
  }
  drafts[rowId].note = normalizeDraftNote(value);
}

function formatDraftAmount(rowId: number) {
  const amount = normalizeMoney(drafts[rowId]?.amount);
  return amount > 0 ? formatMoney(amount) : "-";
}

function openPriceEditor(row: GroceryExpenseRow) {
  openRowEditor(row);
}

function openRowEditor(row: GroceryExpenseRow) {
  if (saving.value) {
    return;
  }

  deleteConfirmId.value = null;
  priceEditorRowId.value = row.id;
  priceEditorValue.value = drafts[row.id]?.amount ?? "";
  priceEditorNoteValue.value = drafts[row.id]?.note ?? "";
  priceEditorOpen.value = true;
}

function closePriceEditor() {
  priceEditorOpen.value = false;
}

function resetPriceEditorState() {
  priceEditorRowId.value = null;
  priceEditorValue.value = "";
  priceEditorNoteValue.value = "";
}

async function savePriceEditor() {
  if (priceEditorRowId.value == null) {
    closePriceEditor();
    return;
  }

  setAmount(priceEditorRowId.value, priceEditorValue.value);
  setNote(priceEditorRowId.value, priceEditorNoteValue.value);

  const response = await persistExpenseState();
  if (response) {
    closePriceEditor();
  }
}

function requestClearRow(row: GroceryExpenseRow) {
  if (saving.value) {
    return;
  }

  deleteConfirmId.value = row.id;
}

function cancelClearRow() {
  deleteConfirmId.value = null;
}

function clearRowDraft(row: GroceryExpenseRow) {
  if (!drafts[row.id]) {
    drafts[row.id] = { amount: "", note: "" };
  } else if (typeof drafts[row.id].note === "undefined") {
    drafts[row.id].note = "";
  }

  drafts[row.id].amount = "";
  drafts[row.id].note = "";
  if (priceEditorRowId.value === row.id) {
    closePriceEditor();
  }
  deleteConfirmId.value = null;
  setNotice("info", `Đã xóa dòng ${row.name}.`);
}

const filteredRows = computed(() => {
  const query = normalizeText(search.value);
  const list = [...rows.value];

  if (!query) {
    return list;
  }

  return list.filter((row) =>
    normalizeText([row.name, row.slug, row.unit].join(" ")).includes(query)
  );
});

watch(priceEditorOpen, async (isOpen) => {
  if (typeof document !== "undefined") {
    document.body.classList.toggle("is-modal-open", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  if (!isOpen) {
    return;
  }

  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
    return;
  }

  await nextTick();
  priceEditorInputRef.value?.focus();
  priceEditorInputRef.value?.select();
});

watch(recordDate, (date) => {
  deleteConfirmId.value = null;
  closePriceEditor();
  applyExpenseDrafts(null);
  void loadExpenseDraft(date);
});

onBeforeUnmount(() => {
  if (typeof document !== "undefined") {
    document.body.classList.remove("is-modal-open");
    document.body.style.overflow = "";
  }
});

async function loadData(options?: { keepLoading?: boolean }) {
  const requestId = ++loadSeq;
  const shouldToggleLoading = !options?.keepLoading;

  if (shouldToggleLoading) {
    loading.value = true;
  }

  try {
    const { data } = await api.get("/ingredient-stocks");

    if (requestId !== loadSeq) {
      return;
    }

    const stocks = Array.isArray(data) ? (data as IngredientStock[]) : [];
    const nextRows = stocks
      .map((stock) => {
        const ingredient = stock.ingredient;
        const remainingQuantity = Math.max(
          Number(
            stock.remainingQuantity ??
              Number(stock.quantity || 0) - Number(stock.soldQuantity || 0)
          ),
          0
        );

        return {
          id: Number(stock.id),
          ingredientId: Number(stock.ingredientId || 0),
          name: String(stock.label || ingredient?.name || "Nguyên liệu"),
          slug: String(ingredient?.slug || ""),
          unit: String(ingredient?.unit || ""),
          remainingQuantity,
          soldQuantity: Number(stock.soldQuantity || 0),
        } satisfies GroceryExpenseRow;
      })
      .filter((row) => row.ingredientId > 0)
      .sort((a, b) => {
        const quantityDiff = Number(b.remainingQuantity || 0) - Number(a.remainingQuantity || 0);
        if (quantityDiff !== 0) {
          return quantityDiff;
        }
        return a.name.localeCompare(b.name, "vi");
      });

    rows.value = nextRows;
    syncDrafts(nextRows);
  } catch (error) {
    setNotice("error", getErrorMessage(error, "Không tải được dữ liệu nguyên liệu."));
  } finally {
    if (shouldToggleLoading && requestId === loadSeq) {
      loading.value = false;
    }
  }
}

function handleStockUpdate() {
  void loadData();
}

async function loadExpenseDraft(date = recordDate.value) {
  const requestId = ++expenseLoadSeq;

  try {
    const { data } = await api.get("/inventory-movements/grocery-expense", {
      params: { date },
    });

    if (requestId !== expenseLoadSeq) {
      return;
    }

    const response = data as GroceryExpenseLookupResponse;
    applyExpenseDrafts(response.expense);
  } catch (error) {
    if (requestId !== expenseLoadSeq) {
      return;
    }

    setNotice("error", getErrorMessage(error, "Không tải được tiền chợ đã lưu."));
  }
}

async function refreshPageState() {
  loading.value = true;

  try {
    await Promise.all([loadData({ keepLoading: true }), loadExpenseDraft()]);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refreshPageState();
  socket.on("stock:update", handleStockUpdate);
});

onBeforeUnmount(() => {
  socket.off("stock:update", handleStockUpdate);
});
</script>

<style scoped>
.grocery-expense {
  display: grid;
  gap: 0;
  width: 100%;
}

.grocery-expense__panel {
  display: grid;
  gap: 16px;
  padding: 12px;
  border: 0;
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.96);
}

.grocery-expense__notice {
  padding: 10px 12px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.82);
  font-size: 0.84rem;
  line-height: 1.4;
}

.grocery-expense__notice.is-success {
  border-color: rgba(var(--green-rgb), 0.24);
  background: rgba(var(--green-rgb), 0.08);
  color: var(--green);
}

.grocery-expense__notice.is-info {
  border-color: rgba(var(--orange-rgb), 0.24);
  background: rgba(var(--orange-rgb), 0.08);
  color: var(--ember-strong);
}

.grocery-expense__notice.is-error {
  border-color: rgba(var(--danger-rgb), 0.24);
  background: rgba(var(--danger-rgb), 0.08);
  color: var(--danger);
}

.grocery-expense__header {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.96);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.grocery-expense__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.grocery-expense__header-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--muted);
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.grocery-expense__header-label i {
  font-size: 0.84rem;
}

.grocery-expense__header-label span {
  min-width: 0;
}

.grocery-expense__header-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.grocery-expense__filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: end;
}

.grocery-expense__search {
  position: relative;
  width: 100%;
}

.grocery-expense__field--search {
  min-width: 0;
}

.grocery-expense__search i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 0.9rem;
  pointer-events: none;
}

.grocery-expense__field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.grocery-expense__field-label {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  color: var(--muted);
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.grocery-expense__input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
  font: inherit;
  font-size: 0.88rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, background 0.15s;
}

.grocery-expense__input:focus {
  border-color: var(--ember);
  background: rgba(255, 255, 255, 0.92);
}

.grocery-expense__input--search {
  padding-left: 36px;
}

.grocery-expense__date-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.grocery-expense__date-icon {
  display: none;
}

.grocery-expense__input--date {
  width: 100%;
  min-width: 0;
  text-align: left;
}

.grocery-expense__list-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.96);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.grocery-expense__loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.9rem;
}

.grocery-expense__table-shell {
  width: 100%;
  overflow-x: hidden;
}

:deep(.grocery-expense__table-responsive) {
  overflow: hidden;
}

:deep(.grocery-expense__table) {
  width: 100%;
  min-width: 0;
  table-layout: fixed;
  border-collapse: collapse;
  color: var(--text);
}

:deep(.grocery-expense__th),
:deep(.grocery-expense__td) {
  padding: 9px 10px;
  border-bottom: 1px solid rgba(var(--line-rgb), 0.4);
  vertical-align: middle;
}

:deep(.grocery-expense__th) {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--muted);
}

:deep(.grocery-expense__th--amount),
:deep(.grocery-expense__td--amount) {
  width: 150px;
}

:deep(.grocery-expense__th--action),
:deep(.grocery-expense__td--action) {
  width: 108px;
  text-align: center;
}

:deep(.grocery-expense__tr:hover) {
  background: rgba(var(--ember-rgb), 0.04);
}

:deep(.grocery-expense__empty) {
  padding: 22px 12px;
  color: var(--muted);
  font-size: 0.84rem;
}

:deep(.grocery-expense__name) {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}

:deep(.grocery-expense__note) {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  margin-top: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(var(--gold-rgb), 0.12);
  color: #8a5a12;
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.01em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.grocery-expense__mobile-qty) {
  display: inline-flex;
  margin-top: 4px;
  width: fit-content;
  max-width: 100%;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--green-rgb), 0.12);
  color: var(--green);
  font-size: 0.64rem;
  font-weight: 800;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

:deep(.grocery-expense__name-btn) {
  display: inline-flex;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 0.18s, transform 0.18s;
}

:deep(.grocery-expense__name-btn:hover),
:deep(.grocery-expense__name-btn:focus-visible) {
  background: rgba(var(--ember-rgb), 0.05);
  outline: none;
  transform: translateY(-1px);
}

:deep(.grocery-expense__name-btn) {
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

:deep(.grocery-expense__price) {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 30px;
  width: 100%;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  font-size: 0.76rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  white-space: nowrap;
}

:deep(.grocery-expense__price.is-empty) {
  background: rgba(var(--line-rgb), 0.12);
  color: var(--muted);
}

.grocery-expense__row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.grocery-expense__row-actions--confirm {
  gap: 4px;
}

.grocery-expense__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: rgba(var(--panel-alt-rgb), 0.78);
  color: var(--text);
  transition:
    transform 0.18s,
    background 0.18s,
    color 0.18s,
    border-color 0.18s,
    box-shadow 0.18s;
}

.grocery-expense__icon-btn--primary {
  border-color: transparent;
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
  color: #fff;
}

.grocery-expense__icon-btn--primary:hover,
.grocery-expense__icon-btn--primary:focus-visible {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
}

.grocery-expense__icon-btn:hover,
.grocery-expense__icon-btn:focus-visible {
  outline: none;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
}

.grocery-expense__icon-btn:disabled {
  opacity: 0.55;
  cursor: default;
  transform: none;
  box-shadow: none;
}

.grocery-expense__icon-btn i {
  font-size: 0.9rem;
  line-height: 1;
}

.grocery-expense__action-btn,
.grocery-expense__toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.grocery-expense__action-btn:hover,
.grocery-expense__action-btn:focus-visible,
.grocery-expense__toggle-btn:hover,
.grocery-expense__toggle-btn:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.4);
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember-strong);
  outline: none;
}

.grocery-expense__action-btn i {
  font-size: 0.88rem;
  color: currentColor;
}

.grocery-expense__action-btn {
  width: 30px;
  min-width: 30px;
}

.grocery-expense__toggle-btn {
  width: 30px;
  min-width: 30px;
  padding: 0;
}

.grocery-expense__toggle-btn i {
  font-size: 0.82rem;
  color: currentColor;
}

.grocery-expense__action-btn.is-spin i {
  animation: grocery-expense-spin 0.8s linear infinite;
}

.grocery-expense__icon-btn--edit {
  border-color: rgba(var(--ember-rgb), 0.18);
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember-strong);
}

.grocery-expense__icon-btn--edit:hover,
.grocery-expense__icon-btn--edit:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.34);
  background: rgba(var(--ember-rgb), 0.16);
  color: var(--ember-strong);
}

.grocery-expense__icon-btn--danger {
  border-color: rgba(var(--danger-rgb), 0.18);
  background: rgba(var(--danger-rgb), 0.08);
  color: var(--danger);
}

.grocery-expense__icon-btn--danger:hover,
.grocery-expense__icon-btn--danger:focus-visible {
  border-color: rgba(var(--danger-rgb), 0.3);
  background: rgba(var(--danger-rgb), 0.14);
  color: var(--danger);
}

.grocery-expense__icon-btn--confirm {
  border-color: rgba(var(--success-rgb), 0.18);
  background: rgba(var(--success-rgb), 0.1);
  color: #166534;
}

.grocery-expense__icon-btn--confirm:hover,
.grocery-expense__icon-btn--confirm:focus-visible {
  border-color: rgba(var(--success-rgb), 0.32);
  background: rgba(var(--success-rgb), 0.18);
  color: #14532d;
}

.grocery-expense__icon-btn--cancel {
  border-color: rgba(var(--line-rgb), 0.9);
  background: rgba(var(--text-rgb), 0.04);
  color: var(--muted);
}

.grocery-expense__icon-btn--cancel:hover,
.grocery-expense__icon-btn--cancel:focus-visible {
  border-color: rgba(var(--text-rgb), 0.14);
  background: rgba(var(--text-rgb), 0.08);
  color: var(--text);
}

.grocery-expense__editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(22, 18, 15, 0.56);
  backdrop-filter: blur(4px);
  overscroll-behavior: contain;
}

.grocery-expense__editor {
  width: min(100%, 460px);
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
}

.grocery-expense__editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.grocery-expense__editor-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text);
}

.grocery-expense__editor-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--text);
}

.grocery-expense__editor-close:hover,
.grocery-expense__editor-close:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.24);
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  outline: none;
}

.grocery-expense__editor-field {
  display: grid;
  gap: 6px;
}

.grocery-expense__editor-field span {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.grocery-expense__editor-input {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.grocery-expense__editor-input--note {
  text-align: left;
}

.grocery-expense__editor-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--muted);
  font-size: 0.82rem;
}

.grocery-expense__editor-preview strong {
  color: var(--ember-strong);
  font-size: 1rem;
  font-weight: 800;
}

.grocery-expense__editor-footer {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
}

.grocery-expense__editor-save {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 639px) {
  :deep(.grocery-expense__table) {
    width: 100%;
    table-layout: fixed;
  }

  .grocery-expense__filters {
    gap: 10px;
  }

  .grocery-expense__field {
    gap: 4px;
  }

  .grocery-expense__field-label {
    min-height: 18px;
  }

  .grocery-expense__input {
    min-height: 38px;
    padding: 0 12px;
    font-size: 0.82rem;
  }

  .grocery-expense__input--search {
    padding-left: 34px;
  }

  .grocery-expense__date-wrap {
    width: 100%;
  }

  .grocery-expense__date-icon {
    display: block;
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    font-size: 0.88rem;
    pointer-events: none;
    z-index: 1;
  }

  .grocery-expense__input--date {
    min-height: 44px;
    padding-left: 30px;
    padding-right: 10px;
    text-align: left;
  }

  .grocery-expense__input--date::-webkit-calendar-picker-indicator {
    opacity: 0;
  }

  :deep(.grocery-expense__th),
  :deep(.grocery-expense__td) {
    padding: 8px 8px;
  }

  :deep(.grocery-expense__th--amount),
  :deep(.grocery-expense__td--amount) {
    width: 132px;
  }

  :deep(.grocery-expense__th--action),
  :deep(.grocery-expense__td--action) {
    width: 92px;
  }

  :deep(.grocery-expense__name) {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  :deep(.grocery-expense__price) {
    min-height: 36px;
    padding: 0 10px;
    font-size: 0.78rem;
  }

  .grocery-expense__row-actions {
    gap: 4px;
  }

  .grocery-expense__icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .grocery-expense__icon-btn i {
    font-size: 0.95rem;
  }

  .grocery-expense__editor-backdrop {
    padding: 0;
    align-items: flex-end;
  }

  .grocery-expense__editor {
    width: 100%;
    max-width: 100%;
    max-height: 94dvh;
    overflow: auto;
    padding: 16px;
    border-radius: 0;
  }

  .grocery-expense__editor-head {
    gap: 10px;
  }

  .grocery-expense__editor-close {
    width: 38px;
    height: 38px;
  }

  .grocery-expense__editor-input {
    padding-top: 12px;
    padding-bottom: 12px;
    font-size: 1rem;
  }

  .grocery-expense__editor-preview {
    align-items: flex-start;
    flex-direction: column;
  }

  .grocery-expense__editor-footer {
    justify-content: flex-start;
  }
}

@media (max-width: 767px) {
  .grocery-expense__header-top {
    flex-wrap: wrap;
  }

  :deep(.grocery-expense__name) {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .grocery-expense__row-actions {
    gap: 4px;
  }

  .grocery-expense__icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .grocery-expense__icon-btn i {
    font-size: 0.95rem;
  }

  .grocery-expense__editor-head {
    flex-wrap: wrap;
  }

  .grocery-expense__editor-close {
    width: 38px;
    height: 38px;
  }

  .grocery-expense__editor-footer {
    justify-content: flex-start;
  }
}

@keyframes grocery-expense-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.grocery-expense-fade-enter-active,
.grocery-expense-fade-leave-active {
  transition: opacity 0.18s ease;
}

.grocery-expense-fade-enter-from,
.grocery-expense-fade-leave-to {
  opacity: 0;
}

.grocery-expense__icon-btn.is-spin i {
  animation: grocery-expense-spin 0.8s linear infinite;
}
</style>
