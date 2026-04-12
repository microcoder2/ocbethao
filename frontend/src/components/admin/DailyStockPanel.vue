<template>
  <div class="dsp-wrap">
    <section class="dsp-filter-panel">
      <div class="dsp-filter-head">
        <div class="dsp-filter-head-copy">
          <div class="dsp-filter-label">KHO HÔM NAY</div>
          <div class="dsp-filter-count-row">
            <div class="dsp-filter-count">
              <i class="bi bi-basket"></i>
              <span>{{ sortedIngredients.length }} nguyên liệu</span>
            </div>
            <div class="dsp-filter-meta">
              <slot name="filter-meta"></slot>
            </div>
          </div>
        </div>

        <div class="dsp-filter-head-actions">
          <button
            class="dsp-view-toggle"
            type="button"
            :aria-pressed="displayMode === 'table' ? 'true' : 'false'"
            :title="displayMode === 'grid' ? 'Đổi sang dạng bảng' : 'Đổi sang dạng lưới'"
            @click="displayMode = displayMode === 'grid' ? 'table' : 'grid'"
          >
            <i :class="['bi', displayMode === 'grid' ? 'bi-grid-3x3-gap' : 'bi-view-list']"></i>
            <span>{{ displayMode === 'grid' ? 'Dạng lưới' : 'Dạng bảng' }}</span>
          </button>

          <button
            class="dsp-filter-toggle"
            type="button"
            :aria-expanded="panelOpen ? 'true' : 'false'"
            :aria-label="panelOpen ? 'Thu gọn khối' : 'Mở rộng khối'"
            :title="panelOpen ? 'Thu gọn khối' : 'Mở rộng khối'"
            @click="panelOpen = !panelOpen"
          >
            <i :class="['bi', panelOpen ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
          </button>
        </div>
      </div>

      <div v-show="panelOpen" class="dsp-filter-body">
        <div class="dsp-topbar">
          <div class="dsp-topbar-main">
            <div class="dsp-search-wrap">
              <i class="bi bi-search dsp-search-icon"></i>
              <input
                v-model="search"
                class="dsp-search"
                type="text"
                placeholder="Tìm nguyên liệu..."
                autocomplete="off"
              />
            </div>
            <button
              v-if="displayMode === 'table'"
              class="dsp-add-inline-btn"
              type="button"
              aria-label="Thêm nguyên liệu"
              title="Thêm nguyên liệu"
              @click="openNewForm"
            >
              <i class="bi bi-clipboard-plus"></i>
            </button>
          </div>
          <div class="dsp-filter-body-actions">
            <slot name="filter-actions"></slot>
          </div>
        </div>
      </div>
    </section>

      <div v-if="errorMessage" class="dsp-error">{{ errorMessage }}</div>

      <div v-if="loading" class="dsp-loading">
        <i class="bi bi-hourglass-split"></i> Đang tải...
      </div>

      <div v-if="!loading" class="dsp-content">
        <div v-if="displayMode === 'grid'" class="dsp-add-card">
          <button class="dsp-add-trigger" type="button" @click="openNewForm">
            <i class="bi bi-clipboard-plus"></i>
            <span>Thêm nguyên liệu</span>
          </button>
        </div>

        <div v-if="displayMode === 'grid'" class="dsp-grid">
          <StockIngredientCard
            v-for="ing in sortedIngredients"
            :key="ing.id"
            :ing="ing"
            :draft="drafts[ing.id]"
            :uploading-img="uploadingImgFor === ing.id"
            :show-img="showImg"
            @toggle="toggleIngredient(ing)"
            @qty-change="changeQty(ing.id, $event)"
            @qty-input="setDraftQuantity(ing.id, $event)"
            @img-pick="handleIngImg(ing, $event)"
            @delete="deleteIngredient(ing)"
          />
        </div>

        <div v-if="displayMode === 'table'" class="dsp-table-shell">
          <DataTable
            :columns="tableColumns"
            :items="sortedIngredients"
            row-key="id"
            :loading="false"
            empty-text="Không có nguyên liệu nào."
            responsive-class="dsp-table-wrap"
            table-class="dsp-table"
            header-cell-class="dsp-th"
            body-row-class="dsp-tr"
            body-cell-class="dsp-td"
            action-header-class="dsp-th dsp-th--actions"
            action-cell-class="dsp-td dsp-td--actions"
            empty-cell-class="dsp-empty"
          >
            <template #cell-name="{ row }">
              <div class="dsp-table-name">{{ row.name }}</div>
              <div class="dsp-table-sub">Đã dùng: {{ formatQuantity(Number(drafts[row.id]?.soldQuantity || 0)) }}</div>
            </template>

            <template #cell-quantity="{ row }">
              <div class="dsp-qty-cell">
                <div class="dsp-row-qty">
                  <button
                    class="dsp-table-qty-btn"
                    type="button"
                    :disabled="drafts[row.id]?.saving"
                    @click="changeQty(row.id, -1)"
                  >
                    <i class="bi bi-dash"></i>
                  </button>
                  <input
                    class="dsp-table-qty-input"
                    type="number"
                    min="0"
                    :value="drafts[row.id]?.quantity ?? 0"
                    :disabled="drafts[row.id]?.saving"
                    @input="setDraftQuantity(row.id, ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    class="dsp-table-qty-btn"
                    type="button"
                    :disabled="drafts[row.id]?.saving"
                    @click="changeQty(row.id, 1)"
                  >
                    <i class="bi bi-plus"></i>
                  </button>
                </div>
                <div class="dsp-save-slot">
                  <button
                    class="dsp-table-save"
                    :class="{
                      'is-saving': drafts[row.id]?.saving,
                      'is-hidden': deleteConfirmId === row.id || !(isDraftDirty(row.id) || drafts[row.id]?.saving),
                    }"
                    type="button"
                    :disabled="drafts[row.id]?.saving || deleteConfirmId === row.id || !isDraftDirty(row.id)"
                    title="Lưu thay đổi"
                    @click="saveIngredient(row)"
                  >
                    <i :class="['bi', drafts[row.id]?.saving ? 'bi-hourglass-split' : 'bi-floppy']"></i>
                  </button>
                </div>
              </div>
            </template>

            <template #row-actions="{ row }">
              <div v-if="deleteConfirmId === row.id" class="dsp-row-confirm">
                <button class="dsp-table-confirm dsp-table-confirm--yes" type="button" title="Xác nhận xóa" @click="confirmDeleteIngredient(row)">
                  <i class="bi bi-check-lg"></i>
                </button>
                <button class="dsp-table-confirm dsp-table-confirm--no" type="button" title="Hủy" @click="cancelDeleteIngredient()">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
              <div v-else class="dsp-row-actions">
                <button
                  class="dsp-table-delete"
                  type="button"
                  title="Xóa"
                  :disabled="drafts[row.id]?.saving"
                  @click="requestDeleteIngredient(row)"
                >
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </div>

  <div
    v-if="newForm.open"
    class="dsp-modal-backdrop"
    role="presentation"
    @click.self="cancelNewForm"
  >
    <div
      class="dsp-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dsp-new-ingredient-title"
    >
      <div class="dsp-modal-header">
        <div id="dsp-new-ingredient-title" class="dsp-modal-title">Tạo nguyên liệu</div>
        <button class="dsp-modal-close" type="button" title="Đóng" @click="cancelNewForm">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="dsp-modal-body">
        <div class="dsp-add-form">
          <div class="dsp-add-field dsp-add-field--full">
            <input
              ref="newNameRef"
              v-model="newForm.name"
              class="dsp-add-input"
              type="text"
              placeholder="Tên nguyên liệu"
              autofocus
              @keydown.enter="createIngredient"
            />
          </div>

          <div class="dsp-add-field dsp-add-field--full dsp-unit-panel">
            <div class="dsp-unit-chips">
              <button
                v-for="unit in unitPresets"
                :key="unit"
                class="dsp-unit-chip"
                :class="{ 'is-active': newForm.unit === unit }"
                type="button"
                @click="newForm.unit = unit"
              >
                {{ unit }}
              </button>
            </div>
            <input
              v-model="newForm.unit"
              class="dsp-add-input dsp-add-input--unit"
              type="text"
              placeholder="Đơn vị"
            />
          </div>

          <div class="dsp-add-img-wrap" @click="newImgRef?.click()">
            <img v-if="newForm.imagePreview" :src="newForm.imagePreview" class="dsp-add-img" />
            <div v-else class="dsp-add-img-placeholder">
              <i class="bi bi-camera"></i>
            </div>
            <div class="dsp-add-img-overlay">
              <i v-if="newForm.imageUploading" class="bi bi-hourglass-split"></i>
              <i v-else class="bi bi-camera-fill"></i>
            </div>
            <input ref="newImgRef" type="file" accept="image/*" class="dsp-file-hidden" @change="handleNewImg" />
          </div>
        </div>
      </div>
      <div class="dsp-modal-footer">
        <button class="dsp-add-cancel" type="button" @click="cancelNewForm">Hủy</button>
        <button
          class="dsp-save-btn btn-ember"
          :disabled="!newForm.name.trim() || newForm.saving || newForm.imageUploading"
          @click="createIngredient"
        >
          <i v-if="newForm.saving" class="bi bi-hourglass-split"></i>
          <span v-else>Tạo & Bật</span>
        </button>
      </div>
      <div v-if="newForm.error" class="dsp-add-error dsp-add-error--modal">{{ newForm.error }}</div>
    </div>
  </div>

  <CropDialog :file="cropFile" @done="onCropDone" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, reactive, watch } from "vue";
import { api } from "../../api";
import { API_BASE_URL } from "../../config";
import { socket } from "../../socket";
import blankIngredientSvg from "../../assets/blank_ingredient.svg?raw";
import CropDialog from "./CropDialog.vue";
import DataTable from "../common/DataTable.vue";
import StockIngredientCard from "./StockIngredientCard.vue";

// ── types ──────────────────────────────────────────────────────────────────

type Ingredient = { id: number; name: string; slug: string; unit: string; imageUrl: string | null };
type StockPool  = {
  id: number;
  ingredientId?: number | null;
  quantity: number;
  soldQuantity?: number;
  remainingQuantity?: number;
  isAvailable: boolean;
  label?: string | null;
  note?: string | null;
};
type Draft      = {
  active: boolean;
  quantity: string;
  poolId: number | null;
  soldQuantity: number;
  label: string;
  note: string;
  saving: boolean;
  baseActive: boolean;
  baseQuantity: number;
};

export type PoolSummary = {
  id: number | null;
  ingredientId: number;
  label: string;
  quantity: number;
  soldQuantity: number;
  isAvailable: boolean;
  note: string;
};

// ── emits ──────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{ serviceDate?: string }>(), {
  serviceDate: "",
});

const emit = defineEmits<{
  updated: [pools: PoolSummary[]];
}>();

// ── helpers ────────────────────────────────────────────────────────────────

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function resolveIngredientImage(imageUrl: string | null) {
  if (!imageUrl) return "";
  return imageUrl.startsWith("/") ? `${API_BASE_URL}${imageUrl}` : imageUrl;
}

function toSlug(name: string): string {
  const map: Record<string, string> = {
    à:"a",á:"a",â:"a",ã:"a",ả:"a",ạ:"a",ă:"a",ắ:"a",ặ:"a",ằ:"a",ẳ:"a",ẵ:"a",
    ầ:"a",ấ:"a",ậ:"a",ẩ:"a",ẫ:"a",
    è:"e",é:"e",ê:"e",ẽ:"e",ẻ:"e",ẹ:"e",ế:"e",ề:"e",ệ:"e",ể:"e",ễ:"e",
    ì:"i",í:"i",ĩ:"i",ỉ:"i",ị:"i",
    ò:"o",ó:"o",ô:"o",õ:"o",ỏ:"o",ọ:"o",ơ:"o",ố:"o",ồ:"o",ộ:"o",ổ:"o",
    ỗ:"o",ớ:"o",ờ:"o",ợ:"o",ở:"o",ỡ:"o",
    ù:"u",ú:"u",ũ:"u",ủ:"u",ụ:"u",ư:"u",ứ:"u",ừ:"u",ự:"u",ử:"u",ữ:"u",
    ỳ:"y",ý:"y",ỹ:"y",ỷ:"y",ỵ:"y",đ:"d",
  };
  return name.toLowerCase().split("").map(c => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getLocalDateValue(base = new Date()) {
  const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const targetDate = computed(() => props.serviceDate || getLocalDateValue());
const isLiveDate = computed(() => targetDate.value === getLocalDateValue());

// ── state ──────────────────────────────────────────────────────────────────

const ingredients = ref<Ingredient[]>([]);
const search      = ref("");
const panelOpen = ref(true);
const displayMode = ref<"grid" | "table">("table");
const loading         = ref(false);
const errorMessage    = ref("");
const drafts          = ref<Record<number, Draft>>({});
const uploadingImgFor = ref<number | null>(null);
const deleteConfirmId = ref<number | null>(null);

const showImg    = ref(true);
const newNameRef = ref<HTMLInputElement | null>(null);
const newImgRef  = ref<HTMLInputElement | null>(null);
const rowImgRefs = ref<Record<number, HTMLInputElement | null>>({});
const unitPresets = ["phần", "kg", "con", "set", "hộp", "tô"];
const newForm = reactive({
  open: false, name: "", unit: "",
  imageUrl: "", imagePreview: "", imageUploading: false,
  saving: false, error: "",
});

// ── crop ───────────────────────────────────────────────────────────────────

const cropFile = ref<File | null>(null);
let _cropCb: ((blob: Blob) => Promise<void>) | null = null;

function openCrop(file: File, cb: (blob: Blob) => Promise<void>) {
  _cropCb = cb;
  cropFile.value = file;
}

async function onCropDone(blob: Blob) {
  cropFile.value = null;
  const cb = _cropCb;
  _cropCb = null;
  await cb?.(blob);
}

async function focusNewNameInput() {
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  newNameRef.value?.focus({ preventScroll: true });
  newNameRef.value?.select?.();
}

// ── computed ───────────────────────────────────────────────────────────────

const activeCount = computed(() => Object.values(drafts.value).filter(d => d.active).length);
const allActive   = computed(() => ingredients.value.length > 0 && ingredients.value.every(i => drafts.value[i.id]?.active));

const sortedIngredients = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = ingredients.value;
  if (q) {
    const tag = q.startsWith("#") ? q.slice(1) : q;
    list = list.filter(ing => ing.name.toLowerCase().includes(tag) || ing.slug.includes(tag));
  }
  return list;
});

const tableColumns = computed(() => [
  { key: "name", title: "Tên" },
  {
    key: "quantity",
    title: "Số lượng",
    thClass: "dsp-th--quantity",
    tdClass: "dsp-td--quantity",
  },
]);

function formatQuantity(value: number) {
  const amount = Number(value || 0);
  return amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function normalizeQuantity(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

function buildDraftsFromStocks(stocks: StockPool[]) {
  const stockMap = new Map(stocks.map((pool) => [Number(pool.ingredientId ?? 0), pool]));
  const init: Record<number, Draft> = {};

  for (const ing of ingredients.value) {
    const pool = stockMap.get(ing.id);
    const remainingQuantity = pool
      ? Math.max(
          Number(
            pool.remainingQuantity ??
              Number(pool.quantity || 0) - Number(pool.soldQuantity || 0)
          ),
          0
        )
      : 0;
    const active = pool ? Boolean(pool.isAvailable || remainingQuantity > 0) : false;

    init[ing.id] = {
      active,
      quantity: String(remainingQuantity),
      baseActive: active,
      baseQuantity: remainingQuantity,
      poolId: pool?.id ?? null,
      soldQuantity: Number(pool?.soldQuantity || 0),
      label: String(pool?.label || ing.name),
      note: String(pool?.note || ing.unit || ""),
      saving: false,
    };
  }

  return init;
}

function isDraftDirty(ingId: number) {
  const draft = drafts.value[ingId];
  if (!draft) return false;
  return normalizeQuantity(draft.quantity) !== draft.baseQuantity || draft.active !== draft.baseActive;
}

function setDraftQuantity(ingId: number, value: string | number) {
  const draft = drafts.value[ingId];
  if (!draft) return;
  draft.quantity = String(value);
  emitUpdated();
}

function syncDraftFromSavedStock(ingId: number, stock: StockPool | null | undefined) {
  const draft = drafts.value[ingId];
  if (!draft) return;

  const quantity = stock
    ? Math.max(
        Number(
          stock.remainingQuantity ??
            Number(stock.quantity || 0) - Number(stock.soldQuantity || 0)
        ),
        0
      )
    : Math.max(Number(draft.quantity || 0), 0);
  const active = stock ? Boolean(stock.isAvailable || quantity > 0) : draft.active;

  draft.quantity = String(quantity);
  draft.active = active;
  draft.baseQuantity = quantity;
  draft.baseActive = active;
  draft.poolId = stock?.id ?? draft.poolId;
  draft.soldQuantity = Number(stock?.soldQuantity || draft.soldQuantity || 0);
  draft.label = String(stock?.label || draft.label);
  draft.note = String(stock?.note || draft.note);
  draft.saving = false;
}

// ── data loading ───────────────────────────────────────────────────────────

let loadSeq = 0;

async function loadData() {
  const requestId = ++loadSeq;
  loading.value = true;
  errorMessage.value = "";
  try {
    const [ingRes, menuRes] = await Promise.all([
      api.get("/ingredients?activeOnly=true"),
      api.get("/ingredient-stocks"),
    ]);
    if (requestId !== loadSeq) return;
    ingredients.value = ingRes.data as Ingredient[];
    drafts.value = buildDraftsFromStocks(menuRes.data as StockPool[]);
    deleteConfirmId.value = null;
    emitUpdated();
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không tải được dữ liệu.");
  } finally {
    if (requestId === loadSeq) {
      loading.value = false;
    }
  }
}

function handleStockUpdate() {
  if (!isLiveDate.value) return;
  void loadData();
}

watch(targetDate, () => {
  void loadData();
}, { immediate: true });

onMounted(() => {
  socket.on("stock:update", handleStockUpdate);
});

onBeforeUnmount(() => {
  socket.off("stock:update", handleStockUpdate);
});

function toggleImg() { showImg.value = !showImg.value; }
function setRowImgRef(ingId: number, el: HTMLInputElement | null) {
  if (el) {
    rowImgRefs.value[ingId] = el;
  } else {
    delete rowImgRefs.value[ingId];
  }
}

function bindRowImgRef(ingId: number) {
  return (el: Element | null) => {
    setRowImgRef(ingId, el instanceof HTMLInputElement ? el : null);
  };
}

function openImagePicker(ingId: number) {
  rowImgRefs.value[ingId]?.click();
}
defineExpose({ showImg, allActive, toggleAll, toggleImg, reload: loadData });

// ── ingredient list ────────────────────────────────────────────────────────

// ── pool emit ──────────────────────────────────────────────────────────────

function emitUpdated() {
  const pools: PoolSummary[] = ingredients.value.map(ing => ({
    id: drafts.value[ing.id]?.poolId ?? null,
    ingredientId: ing.id,
    label: drafts.value[ing.id]?.label || ing.name,
    quantity: normalizeQuantity(drafts.value[ing.id]?.quantity),
    soldQuantity: normalizeQuantity(drafts.value[ing.id]?.soldQuantity),
    isAvailable: drafts.value[ing.id]?.active ?? false,
    note: drafts.value[ing.id]?.note || ing.unit || "",
  }));
  emit("updated", pools);
}

// ── ingredient list ────────────────────────────────────────────────────────

function toggleAll() {
  const next = !allActive.value;
  for (const ing of ingredients.value) {
    const d = drafts.value[ing.id];
    if (!d) continue;
    d.active = next;
    if (next && Number(d.quantity) <= 0) d.quantity = "1";
  }
  emitUpdated();
}

function toggleIngredient(ing: Ingredient) {
  const d = drafts.value[ing.id];
  if (!d) return;
  d.active = !d.active;
  if (d.active && Number(d.quantity) <= 0) d.quantity = "1";
  emitUpdated();
}

function changeQty(ingId: number, delta: number) {
  const d = drafts.value[ingId];
  if (!d) return;
  const base = normalizeQuantity(d.quantity);
  setDraftQuantity(ingId, Math.max(0, base + delta));
}

async function saveIngredient(ing: Ingredient) {
  const draft = drafts.value[ing.id];
  if (!draft || draft.saving || !isDraftDirty(ing.id)) {
    return;
  }

  draft.saving = true;
  errorMessage.value = "";

  try {
    const quantity = normalizeQuantity(draft.quantity);
    const { data } = await api.put("/ingredient-stocks", [
      {
        ingredientId: ing.id,
        label: draft.label,
        quantity,
        isAvailable: draft.active,
        note: draft.note,
      },
    ]);
    const stocks = data as StockPool[];
    const savedStock = stocks.find((pool) => Number(pool.ingredientId ?? 0) === ing.id);
    syncDraftFromSavedStock(ing.id, savedStock);
    deleteConfirmId.value = null;
    emitUpdated();
  } catch (e) {
    draft.saving = false;
    errorMessage.value = getErrorMessage(e, "Không lưu được tồn kho.");
  }
}

function requestDeleteIngredient(ing: Ingredient) {
  deleteConfirmId.value = ing.id;
}

function cancelDeleteIngredient() {
  deleteConfirmId.value = null;
}

async function confirmDeleteIngredient(ing: Ingredient) {
  deleteConfirmId.value = null;
  await deleteIngredient(ing);
}

// ── upload ─────────────────────────────────────────────────────────────────

async function uploadBlob(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  const { data } = await api.post("/uploads/images", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return (data as { url: string }).url;
}

// ── image handlers ─────────────────────────────────────────────────────────

function handleIngImg(ing: Ingredient, file: File) {
  openCrop(file, async (blob) => {
    uploadingImgFor.value = ing.id;
    errorMessage.value = "";
    try {
      const url = await uploadBlob(blob);
      await api.put(`/ingredients/${ing.id}`, { name: ing.name, slug: ing.slug, unit: ing.unit, imageUrl: url, isActive: true });
      ingredients.value = ingredients.value.map(i => i.id === ing.id ? { ...i, imageUrl: url } : i);
    } catch (e) {
      errorMessage.value = getErrorMessage(e, "Không tải ảnh được.");
    } finally {
      uploadingImgFor.value = null;
    }
  });
}

function handleRowImg(ing: Ingredient, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (event.target as HTMLInputElement).value = "";
  handleIngImg(ing, file);
}

function handleNewImg(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (event.target as HTMLInputElement).value = "";
  openCrop(file, async (blob) => {
    newForm.imageUploading = true;
    let uploadedUrl = "";
    const previewUrl = URL.createObjectURL(blob);
    try {
      newForm.imagePreview = previewUrl;
      uploadedUrl = await uploadBlob(blob);
      if (!newForm.open) {
        return;
      }
      newForm.imageUrl = uploadedUrl;
    } catch (e) {
      newForm.error = getErrorMessage(e, "Không tải ảnh được.");
      if (newForm.imagePreview === previewUrl) {
        URL.revokeObjectURL(previewUrl);
        newForm.imagePreview = "";
      }
      newForm.imageUrl = "";
    } finally {
      newForm.imageUploading = false;
      if (!newForm.open && newForm.imagePreview === previewUrl) {
        URL.revokeObjectURL(previewUrl);
        newForm.imagePreview = "";
      }
      if (!newForm.open && uploadedUrl) {
        api.delete("/uploads/images", { data: { url: uploadedUrl } }).catch(() => {});
      }
    }
  });
}

// ── delete ingredient ──────────────────────────────────────────────────────

async function deleteIngredient(ing: Ingredient) {
  errorMessage.value = "";
  try {
    await api.delete(`/ingredients/${ing.id}`);
    ingredients.value = ingredients.value.filter(i => i.id !== ing.id);
    delete drafts.value[ing.id];
    emitUpdated();
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không xóa được nguyên liệu.");
  }
}

// ── new ingredient form ────────────────────────────────────────────────────

async function openNewForm() {
  resetNewFormState();
  newForm.open = true;
  await focusNewNameInput();
}

function resetNewFormState() {
  if (newForm.imagePreview) {
    URL.revokeObjectURL(newForm.imagePreview);
  }
  newForm.open = false;
  newForm.name = "";
  newForm.unit = "";
  newForm.imageUrl = "";
  newForm.imagePreview = "";
  newForm.imageUploading = false;
  newForm.error = "";
  newForm.saving = false;
}

async function cancelNewForm() {
  if (!newForm.imageUploading && newForm.imageUrl) {
    try { await api.delete("/uploads/images", { data: { url: newForm.imageUrl } }); } catch { /* best-effort */ }
  }
  resetNewFormState();
}

async function createIngredient() {
  const name = newForm.name.trim();
  if (!name) return;
  newForm.saving = true; newForm.error = "";
  try {
    const slug = toSlug(name);
    const unit = newForm.unit.trim() || "phần";
    const body: Record<string, unknown> = { name, slug, unit, isActive: true };
    if (newForm.imageUrl) body.imageUrl = newForm.imageUrl;
    const { data } = await api.post("/ingredients", body);
    const created = data as Ingredient;
    ingredients.value = [...ingredients.value, created];
    drafts.value[created.id] = {
      active: true,
      quantity: "1",
      baseActive: true,
      baseQuantity: 1,
      poolId: null,
      soldQuantity: 0,
      label: created.name,
      note: created.unit || "",
      saving: false,
    };
    resetNewFormState();
    emitUpdated();
  } catch (e) {
    newForm.error = getErrorMessage(e, "Không tạo được nguyên liệu.");
  } finally {
    newForm.saving = false;
  }
}
</script>

<style scoped>
.dsp-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

/* ── topbar ── */
.dsp-filter-panel {
  display: grid;
  gap: 10px;
  padding: 12px 14px 14px;
  border: none;
  border-radius: 0;
  background: rgba(var(--panel-rgb), 0.96);
  width: 100%;
}

.dsp-filter-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dsp-filter-head-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.dsp-filter-count-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dsp-filter-meta {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.dsp-filter-label {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

:deep(.dsp-th) {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-family: inherit;
  white-space: nowrap;
  background: transparent;
}

.dsp-filter-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  color: var(--ember-strong);
  font-size: 0.8rem;
  font-weight: 800;
}

.dsp-filter-count i {
  font-size: 0.86rem;
}

.dsp-filter-toggle {
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
  padding: 0;
}

.dsp-filter-toggle:hover,
.dsp-filter-toggle:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}

.dsp-filter-toggle i {
  font-size: 0.82rem;
}

.dsp-filter-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dsp-view-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 700;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.dsp-view-toggle:hover,
.dsp-view-toggle:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.4);
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember-strong);
  outline: none;
}

.dsp-view-toggle i {
  font-size: 0.88rem;
}

.dsp-filter-body {
  display: grid;
  gap: 10px;
  width: 100%;
}

.dsp-filter-body-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dsp-content {
  display: grid;
  gap: 12px;
  width: 100%;
}

.dsp-table-shell {
  width: 100%;
  padding: 0 5px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: rgba(var(--panel-rgb), 0.76);
  border: none;
  border-radius: 0;
}

.dsp-table {
  width: 100%;
  min-width: 680px;
  table-layout: fixed;
  border-collapse: collapse;
  color: var(--muted);
}

:deep(.dsp-th),
:deep(.dsp-td) {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  text-align: left;
  vertical-align: middle;
}

:deep(.dsp-td) {
  font-size: 0.76rem;
  color: var(--muted);
}

:deep(.dsp-th--quantity),
:deep(.dsp-td--quantity) {
  width: 168px;
  white-space: nowrap;
}

:deep(.dsp-th--actions),
:deep(.dsp-td--actions) {
  width: 96px;
  text-align: right;
  white-space: nowrap;
}

:deep(.dsp-tr:hover) {
  background: rgba(var(--ember-rgb), 0.03);
}

:deep(.dsp-row-actions),
:deep(.dsp-row-confirm) {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

:deep(.dsp-qty-cell) {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

:deep(.dsp-row-qty) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

:deep(.dsp-save-slot) {
  flex: 0 0 28px;
  width: 28px;
  min-width: 28px;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

:deep(.dsp-empty) {
  padding: 18px 12px;
}

:deep(.dsp-table-image-btn) {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 14px;
  padding: 0;
  background: rgba(var(--panel-rgb), 0.9);
  overflow: hidden;
  cursor: pointer;
}

:deep(.dsp-table-image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

:deep(.dsp-table-image--blank) {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-soft);
  color: var(--ember);
}

:deep(.dsp-table-image--blank svg) {
  width: 62%;
  aspect-ratio: 4 / 3;
  display: block;
}

:deep(.dsp-table-name) {
  display: block;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.dsp-table-sub) {
  margin-top: 2px;
  font-size: 0.68rem;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.92;
}

:deep(.dsp-table-qty) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.dsp-table-qty-btn) {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(var(--panel-rgb), 0.82);
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0;
  flex-shrink: 0;
}

:deep(.dsp-table-qty-btn:hover) {
  background: rgba(var(--ember-rgb), 0.08);
  border-color: rgba(var(--ember-rgb), 0.3);
}

:deep(.dsp-table-qty-input) {
  width: 56px;
  min-height: 30px;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 4px 6px;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--muted);
  background: rgba(var(--panel-rgb), 0.82);
  outline: none;
  -moz-appearance: textfield;
}

:deep(.dsp-table-qty-input::-webkit-outer-spin-button),
:deep(.dsp-table-qty-input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
}

:deep(.dsp-table-qty-input:focus) {
  border-color: var(--ember);
}

:deep(.dsp-table-delete) {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(var(--danger-rgb), 0.18);
  border-radius: 8px;
  background: rgba(var(--danger-rgb), 0.06);
  color: var(--danger);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

:deep(.dsp-table-delete:hover) {
  background: rgba(var(--danger-rgb), 0.12);
}

:deep(.dsp-table-save) {
  width: 28px;
  height: 28px;
  margin-left: 0;
  border: 1px solid rgba(var(--green-rgb), 0.2);
  border-radius: 8px;
  background: rgba(var(--green-rgb), 0.08);
  color: var(--green);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s ease;
}

:deep(.dsp-table-save:hover) {
  background: rgba(var(--green-rgb), 0.14);
}

:deep(.dsp-table-save.is-saving) {
  opacity: 0.8;
}

:deep(.dsp-table-save.is-hidden) {
  visibility: hidden;
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
}

:deep(.dsp-table-confirm) {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  cursor: pointer;
}

:deep(.dsp-table-confirm--yes) {
  color: var(--green);
  background: rgba(var(--green-rgb), 0.08);
  border-color: rgba(var(--green-rgb), 0.2);
}

:deep(.dsp-table-confirm--yes:hover) {
  background: rgba(var(--green-rgb), 0.14);
}

:deep(.dsp-table-confirm--no) {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.08);
  border-color: rgba(var(--danger-rgb), 0.2);
}

:deep(.dsp-table-confirm--no:hover) {
  background: rgba(var(--danger-rgb), 0.14);
}

.dsp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  flex-wrap: nowrap;
}

.dsp-topbar-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 280px;
  min-width: 0;
}

.dsp-search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}
.dsp-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 0.9rem;
  pointer-events: none;
}
.dsp-search {
  width: 100%;
  min-height: 46px;
  padding: 0 14px 0 36px;
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
.dsp-search:focus {
  border-color: var(--ember);
  background: rgba(255, 255, 255, 0.92);
}

.dsp-add-inline-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 46px;
  min-width: 46px;
  height: 46px;
  padding: 0;
  border: 1px solid rgba(var(--ember-rgb), 0.14);
  border-radius: 16px;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.dsp-add-inline-btn:hover,
.dsp-add-inline-btn:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.28);
  background: rgba(var(--ember-rgb), 0.14);
  color: var(--ember-strong);
  outline: none;
}

.dsp-add-inline-btn i {
  font-size: 1rem;
  color: currentColor;
}

/* ── error / loading ── */
.dsp-error {
  background: rgba(var(--ember-rgb), 0.1);
  border: 1px solid rgba(var(--ember-rgb), 0.28);
  border-radius: 12px;
  padding: 10px 14px;
  color: var(--ember-strong);
  font-size: 0.88rem;
  width: 100%;
}
.dsp-loading {
  color: var(--muted);
  font-size: 0.92rem;
  padding: 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* ── grid ── */
.dsp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  width: 100%;
}
@media (max-width: 639px) {
  .dsp-filter-head {
    flex-wrap: wrap;
  }

  .dsp-filter-head-actions {
    margin-left: auto;
  }
}

/* ── add card ── */
.dsp-add-card {
  width: 100%;
  background: rgba(var(--panel-rgb), 0.6);
  border: 1.5px dashed var(--line);
  border-radius: 18px;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: border-color 0.2s;
}

.dsp-add-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  background: none;
  border: none;
  color: var(--ember-strong);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  padding: 12px 8px;
  transition: color 0.15s, opacity 0.15s;
}
.dsp-add-trigger:hover { color: var(--ember-strong); opacity: 0.92; }
.dsp-add-trigger i { font-size: 1rem; color: currentColor; }

/* ── add form ── */
.dsp-add-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dsp-add-field--full {
  width: 100%;
}

.dsp-add-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface, #f5f3ef);
  border: 1px dashed var(--line);
}
.dsp-add-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dsp-add-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--line);
  font-size: 1.5rem;
}
.dsp-add-img-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.26);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.95rem;
  opacity: 0;
  transition: opacity 0.15s;
}
.dsp-add-img-wrap:hover .dsp-add-img-overlay { opacity: 1; }
.dsp-file-hidden { display: none; }

.dsp-add-field { display: flex; flex-direction: column; gap: 3px; }
.dsp-add-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.dsp-add-input {
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 6px 9px;
  font: inherit;
  font-size: 0.9rem;
  color: var(--text);
  background: rgba(255, 255, 255, 0.85);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.dsp-add-input--sm { width: 90px; }
.dsp-add-input--unit {
  margin-top: 8px;
}
.dsp-add-input:focus { border-color: var(--ember); }

.dsp-unit-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dsp-unit-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(var(--ember-rgb), 0.12);
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.04);
  color: var(--ember-strong);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.dsp-unit-chip:hover,
.dsp-unit-chip:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.24);
  background: rgba(var(--ember-rgb), 0.1);
  outline: none;
}

.dsp-unit-chip.is-active {
  border-color: rgba(var(--ember-rgb), 0.28);
  background: rgba(var(--ember-rgb), 0.14);
  color: var(--ember-strong);
  box-shadow: 0 0 0 1px rgba(var(--ember-rgb), 0.06) inset;
}

.dsp-add-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
}
.dsp-add-cancel {
  flex: 1;
  padding: 5px 8px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.dsp-add-cancel:hover { border-color: var(--text); color: var(--text); }

.dsp-save-btn {
  flex: 1;
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 9px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.dsp-save-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }

.dsp-add-error {
  font-size: 0.8rem;
  color: var(--ember-strong);
}

.dsp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(18, 16, 13, 0.58);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.dsp-modal {
  width: min(560px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}

.dsp-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.dsp-modal-title {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.dsp-modal-close {
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.dsp-modal-close:hover,
.dsp-modal-close:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(var(--ember-rgb), 0.3);
  background: rgba(var(--ember-rgb), 0.08);
  outline: none;
}

.dsp-modal-body {
  padding: 12px 16px 0;
  overflow: auto;
  flex: 1;
}

.dsp-modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 16px 16px;
  border-top: 1px solid var(--line);
}

.dsp-add-error--modal {
  padding: 0 16px 16px;
}
</style>

