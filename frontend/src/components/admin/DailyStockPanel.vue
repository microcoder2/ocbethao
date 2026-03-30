<template>
  <div class="dsp-wrap">
    <!-- topbar: search + count -->
    <div class="dsp-topbar">
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
      <span class="dsp-count">{{ activeCount }}/{{ ingredients.length }} bật</span>
    </div>

    <div v-if="errorMessage" class="dsp-error">{{ errorMessage }}</div>

    <div v-if="loading" class="dsp-loading">
      <i class="bi bi-hourglass-split"></i> Đang tải...
    </div>

    <div v-else class="dsp-grid">
      <!-- add new ingredient card -->
      <div class="dsp-add-card" :class="{ 'is-open': newForm.open }">
        <template v-if="!newForm.open">
          <button class="dsp-add-trigger" @click="openNewForm">
            <i class="bi bi-plus-lg"></i>
            <span>Thêm nguyên liệu</span>
          </button>
        </template>
        <template v-else>
          <div class="dsp-add-form">
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
            <div class="dsp-add-field">
              <label class="dsp-add-label">Tên nguyên liệu</label>
              <input ref="newNameRef" v-model="newForm.name" class="dsp-add-input" type="text" placeholder="VD: Sò huyết" @keydown.enter="createIngredient" />
            </div>
            <div class="dsp-add-field">
              <label class="dsp-add-label">Đơn vị</label>
              <input v-model="newForm.unit" class="dsp-add-input dsp-add-input--sm" type="text" placeholder="kg / con / phần..." />
            </div>
            <div class="dsp-add-actions">
              <button class="dsp-add-cancel" @click="cancelNewForm">Hủy</button>
              <button
                class="dsp-save-btn btn-ember"
                :disabled="!newForm.name.trim() || newForm.saving"
                @click="createIngredient"
              >
                <i v-if="newForm.saving" class="bi bi-hourglass-split"></i>
                <span v-else>Tạo & Bật</span>
              </button>
            </div>
            <div v-if="newForm.error" class="dsp-add-error">{{ newForm.error }}</div>
          </div>
        </template>
      </div>

      <!-- ingredient cards -->
      <StockIngredientCard
        v-for="ing in sortedIngredients"
        :key="ing.id"
        :ing="ing"
        :draft="drafts[ing.id]"
        :uploading-img="uploadingImgFor === ing.id"
        :show-img="showImg"
        @toggle="toggleIngredient(ing)"
        @qty-change="changeQty(ing.id, $event)"
        @qty-input="drafts[ing.id].quantity = $event"
        @img-pick="handleIngImg(ing, $event)"
        @delete="deleteIngredient(ing)"
      />
    </div>
  </div>

  <CropDialog :file="cropFile" @done="onCropDone" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, reactive, watch } from "vue";
import { api } from "../../api";
import { socket } from "../../socket";
import CropDialog from "./CropDialog.vue";
import StockIngredientCard from "./StockIngredientCard.vue";

// ── types ──────────────────────────────────────────────────────────────────

type Ingredient = { id: number; name: string; slug: string; unit: string; imageUrl: string | null };
type StockPool  = {
  id: number;
  quantity: number;
  soldQuantity?: number;
  remainingQuantity?: number;
  isAvailable: boolean;
  label?: string | null;
  note?: string | null;
  ingredient: Ingredient | null;
};
type DailyMenu  = { id: number; stockPools: StockPool[] };
type StockBaseline = {
  ingredientId: number;
  label?: string | null;
  quantity: number;
  isAvailable: boolean;
  note?: string | null;
  sourceServiceDate?: string | null;
};
type Draft      = {
  active: boolean;
  quantity: string;
  poolId: number | null;
  soldQuantity: number;
  label: string;
  note: string;
  saving: boolean;
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
const loading         = ref(false);
const errorMessage    = ref("");
const drafts          = ref<Record<number, Draft>>({});
const uploadingImgFor = ref<number | null>(null);

const showImg    = ref(true);
const newNameRef = ref<HTMLInputElement | null>(null);
const newImgRef  = ref<HTMLInputElement | null>(null);
const newForm = reactive({
  open: false, name: "", unit: "phần",
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

// ── data loading ───────────────────────────────────────────────────────────

let loadSeq = 0;

async function loadData() {
  const requestId = ++loadSeq;
  loading.value = true;
  errorMessage.value = "";
  try {
    const [ingRes, menuRes, baselineRes] = await Promise.all([
      api.get("/ingredients?activeOnly=true"),
      api.get("/daily-menus", {
        params: { date: targetDate.value },
      }),
      api.get("/daily-menus/stock-baseline", {
        params: { date: targetDate.value },
      }),
    ]);
    if (requestId !== loadSeq) return;
    ingredients.value = ingRes.data as Ingredient[];
    const menus = menuRes.data as DailyMenu[];
    const baseline = baselineRes.data as StockBaseline[];
    const currentMenu = menus.length > 0 ? menus[0] : null;
    const baselineMap = new Map(baseline.map((pool) => [pool.ingredientId, pool]));
    const shouldRecoverUnavailablePools = Boolean(currentMenu?.stockPools.length) &&
      currentMenu!.stockPools.every((pool) => !pool.isAvailable) &&
      currentMenu!.stockPools.some((pool) =>
        Math.max(
          Number(
            pool.remainingQuantity ??
              Number(pool.quantity || 0) - Number(pool.soldQuantity || 0)
          ),
          0
        ) > 0
      );

    const init: Record<number, Draft> = {};
    for (const ing of ingredients.value) {
      const pool = currentMenu?.stockPools.find((entry) => entry.ingredient?.id === ing.id);
      const fallback = !pool ? baselineMap.get(ing.id) : null;
      const remainingQuantity = pool
        ? Math.max(
            Number(
              pool.remainingQuantity ??
                Number(pool.quantity || 0) - Number(pool.soldQuantity || 0)
            ),
            0
          )
        : Math.max(Number(fallback?.quantity || 0), 0);

      init[ing.id] = {
        active: pool
          ? Boolean(pool.isAvailable || (shouldRecoverUnavailablePools && remainingQuantity > 0))
          : Boolean(fallback?.isAvailable && remainingQuantity > 0),
        quantity: String(remainingQuantity),
        poolId: pool?.id ?? null,
        soldQuantity: Number(pool?.soldQuantity || 0),
        label: String(pool?.label || fallback?.label || ing.name),
        note: String(pool?.note || fallback?.note || ing.unit || ""),
        saving: false,
      };
    }
    drafts.value = init;
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
defineExpose({ showImg, allActive, toggleAll, toggleImg, reload: loadData });

// ── ingredient list ────────────────────────────────────────────────────────

// ── pool emit ──────────────────────────────────────────────────────────────

function emitUpdated() {
  const pools: PoolSummary[] = ingredients.value.map(ing => ({
    id: drafts.value[ing.id]?.poolId ?? null,
    ingredientId: ing.id,
    label: drafts.value[ing.id]?.label || ing.name,
    quantity: Math.max(Number(drafts.value[ing.id]?.quantity) || 0, 0),
    soldQuantity: Math.max(Number(drafts.value[ing.id]?.soldQuantity) || 0, 0),
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
  d.quantity = String(Math.max(1, (Number(d.quantity) || 1) + delta));
  emitUpdated();
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

function handleNewImg(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (event.target as HTMLInputElement).value = "";
  openCrop(file, async (blob) => {
    newForm.imageUploading = true;
    let uploadedUrl = "";
    try {
      newForm.imagePreview = URL.createObjectURL(blob);
      uploadedUrl = await uploadBlob(blob);
      newForm.imageUrl = uploadedUrl;
    } catch (e) {
      newForm.error = getErrorMessage(e, "Không tải ảnh được.");
      newForm.imagePreview = "";
      newForm.imageUrl = "";
    } finally {
      newForm.imageUploading = false;
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
  newForm.open = true; newForm.name = ""; newForm.unit = "phần";
  newForm.imageUrl = ""; newForm.imagePreview = ""; newForm.imageUploading = false; newForm.error = "";
  await nextTick();
  newNameRef.value?.focus();
}

function closeNewForm() { newForm.open = false; }

async function cancelNewForm() {
  if (!newForm.imageUploading && newForm.imageUrl) {
    try { await api.delete("/uploads/images", { data: { url: newForm.imageUrl } }); } catch { /* best-effort */ }
  }
  if (newForm.imagePreview) URL.revokeObjectURL(newForm.imagePreview);
  newForm.open = false;
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
      poolId: null,
      soldQuantity: 0,
      label: created.name,
      note: created.unit || "",
      saving: false,
    };
    closeNewForm();
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
  gap: 12px;
}

/* ── topbar ── */
.dsp-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dsp-search-wrap {
  position: relative;
  flex: 1;
}
.dsp-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 0.82rem;
  pointer-events: none;
}
.dsp-search {
  width: 100%;
  padding: 8px 12px 8px 32px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(var(--panel-rgb), 0.8);
  color: var(--text);
  font: inherit;
  font-size: 0.88rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.dsp-search:focus { border-color: var(--ember); }

.dsp-count {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

/* ── error / loading ── */
.dsp-error {
  background: rgba(var(--ember-rgb), 0.1);
  border: 1px solid rgba(var(--ember-rgb), 0.28);
  border-radius: 12px;
  padding: 10px 14px;
  color: var(--ember-strong);
  font-size: 0.88rem;
}
.dsp-loading {
  color: var(--muted);
  font-size: 0.92rem;
  padding: 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── grid ── */
.dsp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
@media (max-width: 639px) {
  .dsp-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
}

/* ── add card ── */
.dsp-add-card {
  background: rgba(var(--panel-rgb), 0.6);
  border: 1.5px dashed var(--line);
  border-radius: 18px;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: border-color 0.2s;
}
.dsp-add-card.is-open {
  border-style: solid;
  border-color: rgba(var(--ember-rgb), 0.3);
  padding: 12px;
}

.dsp-add-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  padding: 12px 8px;
  transition: color 0.15s;
}
.dsp-add-trigger:hover { color: var(--ember); }
.dsp-add-trigger i { font-size: 1rem; }

/* ── add form ── */
.dsp-add-form { display: flex; flex-direction: column; gap: 9px; }

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
.dsp-add-input:focus { border-color: var(--ember); }

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
</style>
