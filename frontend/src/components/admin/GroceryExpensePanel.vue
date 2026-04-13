<template>
  <section class="grocery-expense">
    <section class="page-panel grocery-expense__panel">
      <div v-if="notice" class="grocery-expense__notice" :class="`is-${notice.kind}`">
        {{ notice.text }}
      </div>

      <div class="grocery-expense__head">
        <div class="grocery-expense__head-copy">
          <div class="grocery-expense__page-label">GHI TIỀN CHỢ HÔM NAY</div>
          <div class="grocery-expense__page-title">Phiếu ghi tiền chợ theo nguyên liệu hiện có</div>
          <div class="grocery-expense__page-copy">
            Nhập số tiền cho từng nguyên liệu đang có trong kho. Ô nào không ghi thì để trống.
          </div>
        </div>

        <RouterLink class="grocery-expense__back" to="/admin/stock">
          <i class="bi bi-cart-fill"></i>
          <span>Về đi chợ</span>
        </RouterLink>
      </div>

      <div class="grocery-expense__toolbar">
        <label class="grocery-expense__field">
          <span>Ngày ghi</span>
          <input v-model="recordDate" class="form-control" type="date" />
        </label>

        <label class="grocery-expense__field">
          <span>Tìm nguyên liệu</span>
          <div class="grocery-expense__search">
            <i class="bi bi-search"></i>
            <input
              v-model.trim="search"
              class="form-control"
              type="search"
              autocomplete="off"
              spellcheck="false"
              placeholder="Tên, mã, đơn vị..."
            />
          </div>
        </label>
      </div>

      <label class="grocery-expense__field grocery-expense__field--wide">
        <span>Ghi chú</span>
        <textarea
          v-model.trim="note"
          class="form-control grocery-expense__textarea"
          rows="3"
          placeholder="Ví dụ: Mua cá, mực, rau cho buổi sáng"
        ></textarea>
      </label>

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
          header-cell-class="grocery-expense__th"
          body-row-class="grocery-expense__tr"
          body-cell-class="grocery-expense__td"
          empty-cell-class="grocery-expense__empty"
        >
          <template #cell-name="{ row }">
            <div class="grocery-expense__name">{{ row.name }}</div>
            <div class="grocery-expense__sub">
              #{{ row.id }}<span v-if="row.unit"> · {{ row.unit }}</span>
            </div>
          </template>

          <template #cell-remainingQuantity="{ row }">
            <div class="grocery-expense__quantity">
              {{ formatQuantity(row.remainingQuantity) }}
            </div>
          </template>

          <template #cell-amount="{ row }">
            <input
              class="form-control grocery-expense__amount-input"
              type="number"
              min="0"
              step="1000"
              inputmode="numeric"
              placeholder="0"
              :value="drafts[row.id]?.amount ?? ''"
              @input="setAmount(row.id, ($event.target as HTMLInputElement).value)"
            />
          </template>
        </DataTable>
      </div>

      <div class="grocery-expense__summary">
        <div class="grocery-expense__summary-item">
          {{ filteredRows.length }} nguyên liệu
        </div>
        <div class="grocery-expense__summary-item">
          {{ nonZeroCount }} dòng có tiền
        </div>
        <div class="grocery-expense__summary-item is-total">
          Tổng tiền: {{ formatMoney(totalAmount) }}
        </div>
      </div>

      <div class="grocery-expense__footer">
        <button
          class="btn btn-outline-dark"
          type="button"
          :disabled="saving || totalAmount <= 0"
          @click="clearAmounts"
        >
          Xóa số tiền
        </button>
        <button
          class="btn btn-ember"
          type="button"
          :disabled="saving || totalAmount <= 0"
          @click="submitExpense"
        >
          <i v-if="saving" class="bi bi-hourglass-split"></i>
          <span v-else>Lưu tiền chợ</span>
        </button>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
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
  quantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  ingredient: Ingredient | null;
};

type GroceryExpenseRow = {
  id: number;
  name: string;
  slug: string;
  unit: string;
  remainingQuantity: number;
  soldQuantity: number;
};

type GroceryExpenseDraft = {
  amount: string;
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
  }>;
};

const columns = [
  { key: "name", title: "Nguyên liệu" },
  {
    key: "remainingQuantity",
    title: "Tồn hiện có",
    thClass: "grocery-expense__th--quantity",
    tdClass: "grocery-expense__td--quantity",
  },
  {
    key: "amount",
    title: "Tiền chợ",
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
const drafts = reactive<Record<number, GroceryExpenseDraft>>({});

let loadSeq = 0;

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

function setNotice(kind: GroceryExpenseNotice["kind"], text: string) {
  notice.value = { kind, text };
}

function syncDrafts(nextRows: GroceryExpenseRow[]) {
  const nextIds = new Set(nextRows.map((row) => row.id));

  for (const key of Object.keys(drafts)) {
    const id = Number(key);
    if (!nextIds.has(id)) {
      delete drafts[id];
    }
  }

  for (const row of nextRows) {
    if (!drafts[row.id]) {
      drafts[row.id] = {
        amount: "",
      };
    }
  }
}

function clearAmounts() {
  for (const row of rows.value) {
    if (!drafts[row.id]) {
      drafts[row.id] = { amount: "" };
    }
    drafts[row.id].amount = "";
  }
}

function setAmount(rowId: number, value: string) {
  if (!drafts[rowId]) {
    drafts[rowId] = { amount: "" };
  }
  drafts[rowId].amount = normalizeAmountInput(value);
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

const totalAmount = computed(() =>
  rows.value.reduce((sum, row) => sum + normalizeMoney(drafts[row.id]?.amount), 0)
);

const nonZeroCount = computed(
  () => rows.value.filter((row) => normalizeMoney(drafts[row.id]?.amount) > 0).length
);

async function loadData() {
  const requestId = ++loadSeq;
  loading.value = true;

  try {
    const [ingredientsRes, stocksRes] = await Promise.all([
      api.get("/ingredients?activeOnly=true"),
      api.get("/ingredient-stocks"),
    ]);

    if (requestId !== loadSeq) {
      return;
    }

    const ingredients = Array.isArray(ingredientsRes.data)
      ? (ingredientsRes.data as Ingredient[])
      : [];
    const stocks = Array.isArray(stocksRes.data)
      ? (stocksRes.data as IngredientStock[])
      : [];
    const stockMap = new Map(stocks.map((stock) => [Number(stock.ingredientId || 0), stock]));
    const nextRows = ingredients
      .map((ingredient) => {
        const stock = stockMap.get(ingredient.id);
        const remainingQuantity = stock
          ? Math.max(Number(stock.remainingQuantity ?? Number(stock.quantity || 0) - Number(stock.soldQuantity || 0)), 0)
          : 0;

        return {
          id: ingredient.id,
          name: ingredient.name,
          slug: ingredient.slug,
          unit: ingredient.unit || "",
          remainingQuantity,
          soldQuantity: Number(stock?.soldQuantity || 0),
        } satisfies GroceryExpenseRow;
      })
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
    if (requestId === loadSeq) {
      loading.value = false;
    }
  }
}

function handleStockUpdate() {
  void loadData();
}

async function submitExpense() {
  const breakdown = rows.value
    .map((row) => ({
      ingredientId: row.id,
      ingredientName: row.name,
      unit: row.unit || null,
      remainingQuantity: row.remainingQuantity,
      amount: normalizeMoney(drafts[row.id]?.amount),
    }))
    .filter((item) => item.amount > 0);

  if (!breakdown.length) {
    setNotice("error", "Hãy nhập số tiền cho ít nhất một nguyên liệu.");
    return;
  }

  saving.value = true;

  try {
    const amount = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const { data } = await api.post("/inventory-movements/grocery-expense", {
      amount,
      note: note.value.trim() || undefined,
      date: recordDate.value,
      breakdown,
    });
    const response = data as GroceryExpenseResponse;

    setNotice(
      "success",
      `Đã ghi tiền chợ ngày ${formatDateLabel(response.recordedAt)} với tổng ${formatMoney(response.amount)}.`
    );
    note.value = "";
    clearAmounts();
  } catch (error) {
    setNotice("error", getErrorMessage(error, "Không ghi được tiền chợ."));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadData();
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

.grocery-expense__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.grocery-expense__head-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.grocery-expense__page-label {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.grocery-expense__page-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text);
}

.grocery-expense__page-copy {
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.5;
}

.grocery-expense__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.grocery-expense__back:hover,
.grocery-expense__back:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.28);
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  outline: none;
}

.grocery-expense__back i {
  font-size: 0.96rem;
}

.grocery-expense__toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
  align-items: end;
}

.grocery-expense__field {
  display: grid;
  gap: 6px;
}

.grocery-expense__field span {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
}

.grocery-expense__field--wide {
  width: 100%;
}

.grocery-expense__search {
  position: relative;
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

.grocery-expense__search input {
  padding-left: 36px;
}

.grocery-expense__textarea {
  min-height: 88px;
  resize: vertical;
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
  overflow-x: auto;
}

:deep(.grocery-expense__table-responsive) {
  overflow-x: auto;
}

:deep(.grocery-expense__table) {
  width: 100%;
  min-width: 920px;
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

:deep(.grocery-expense__th--quantity),
:deep(.grocery-expense__td--quantity) {
  width: 180px;
  white-space: nowrap;
}

:deep(.grocery-expense__th--amount),
:deep(.grocery-expense__td--amount) {
  width: 260px;
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
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.grocery-expense__sub) {
  margin-top: 2px;
  font-size: 0.68rem;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

:deep(.grocery-expense__quantity) {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

:deep(.grocery-expense__amount-input) {
  width: 100%;
  min-width: 160px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.grocery-expense__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.grocery-expense__summary-item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.84);
  color: var(--ember-strong);
  font-size: 0.78rem;
  font-weight: 800;
}

.grocery-expense__summary-item.is-total {
  background: rgba(var(--ember-rgb), 0.12);
}

.grocery-expense__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 991px) {
  .grocery-expense__toolbar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .grocery-expense__head {
    flex-wrap: wrap;
  }

  .grocery-expense__back {
    width: 100%;
    justify-content: center;
  }

  .grocery-expense__footer {
    flex-direction: column-reverse;
  }

  .grocery-expense__footer > * {
    width: 100%;
  }
}
</style>
