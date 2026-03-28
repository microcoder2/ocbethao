<template>
  <div class="stock-shell">
    <div class="stock-header">
      <h1 class="stock-title">hôm nay bé Thảo đi chợ có gì nè? 🛒</h1>
      <div class="stock-search-wrap">
        <i class="bi bi-search stock-search-icon"></i>
        <input
          v-model="search"
          class="stock-search"
          type="text"
          placeholder="Tìm tên hoặc #tag..."
          autocomplete="off"
        />
      </div>
    </div>

    <div v-if="errorMessage" class="stock-error">{{ errorMessage }}</div>

    <div v-if="loading" class="stock-loading">
      <i class="bi bi-hourglass-split"></i> Đang tải...
    </div>

    <div v-else class="stock-grid">
      <!-- ── add new card (always first) ── -->
      <div class="stock-card stock-card-new" :class="{ 'is-open': newForm.open }">
        <template v-if="!newForm.open">
          <button class="stock-new-trigger" @click="openNewForm">
            <i class="bi bi-plus-lg"></i>
            <span>Thêm món mới</span>
          </button>
        </template>
        <template v-else>
          <div class="stock-new-form">
            <div class="stock-new-img-wrap" @click="newImgRef!.click()">
              <img v-if="newForm.imagePreview" :src="newForm.imagePreview" class="stock-new-img" />
              <div v-else class="stock-new-img-placeholder">
                <i class="bi bi-camera"></i>
              </div>
              <div class="stock-new-img-overlay">
                <i v-if="newForm.imageUploading" class="bi bi-hourglass-split"></i>
                <i v-else class="bi bi-camera-fill"></i>
              </div>
              <input ref="newImgRef" type="file" accept="image/*" class="stock-file-hidden" @change="handleNewImg" />
            </div>
            <div class="stock-new-field">
              <label class="stock-new-label">Tên món</label>
              <input ref="newNameRef" v-model="newForm.name" class="stock-new-input" type="text" placeholder="VD: Sò huyết" />
            </div>
            <div class="stock-new-field">
              <label class="stock-new-label">Đơn vị</label>
              <input v-model="newForm.unit" class="stock-new-input stock-new-input--sm" type="text" placeholder="kg / con / phần..." />
            </div>
            <div class="stock-new-actions">
              <button class="stock-new-cancel" @click="cancelNewForm">Hủy</button>
              <button class="stock-save-btn btn-ember" :disabled="!newForm.name.trim() || newForm.saving" @click="createIngredient">
                <i v-if="newForm.saving" class="bi bi-hourglass-split"></i>
                <span v-else>Tạo & Bật</span>
              </button>
            </div>
            <div v-if="newForm.error" class="stock-new-error">{{ newForm.error }}</div>
          </div>
        </template>
      </div>

      <!-- ── ingredient cards ── -->
      <StockIngredientCard
        v-for="ing in sortedIngredients"
        :key="ing.id"
        :ing="ing"
        :draft="drafts[ing.id]"
        :uploading-img="uploadingImgFor === ing.id"
        @toggle="toggleIngredient(ing)"
        @qty-change="changeQty(ing.id, $event)"
        @qty-input="drafts[ing.id].quantity = $event"
        @save="saveIngredient(ing)"
        @img-pick="handleIngImg(ing, $event)"
        @delete="deleteIngredient(ing)"
      />
    </div>
  </div>

  <CropDialog :file="cropFile" @done="onCropDone" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, reactive } from "vue";
import { api } from "../../api";
import CropDialog from "../../components/admin/CropDialog.vue";
import StockIngredientCard from "../../components/admin/StockIngredientCard.vue";

// ── types ──────────────────────────────────────────────────────

type Ingredient    = { id: number; name: string; slug: string; unit: string; imageUrl: string | null };
type StockPool     = { id: number; quantity: number; soldQuantity: number; isAvailable: boolean; label: string | null; ingredient: Ingredient | null };
type DailyMenuItem = { id: number; menuItemId: number | null; isAvailable: boolean; overridePrice: number | null; highlightLabel: string | null };
type DailyMenu     = { id: number; title: string; serviceDate: string; status: string; stockPools: StockPool[]; items: DailyMenuItem[] };
type Draft         = { active: boolean; quantity: string; saving: boolean };

// ── helpers ────────────────────────────────────────────────────

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

// ── core state ─────────────────────────────────────────────────

const ingredients     = ref<Ingredient[]>([]);
const todayMenu       = ref<DailyMenu | null>(null);
const search          = ref("");
const loading         = ref(false);
const errorMessage    = ref("");
const drafts          = ref<Record<number, Draft>>({});
const uploadingImgFor = ref<number | null>(null);

const newNameRef = ref<HTMLInputElement | null>(null);
const newImgRef  = ref<HTMLInputElement | null>(null);
const newForm = reactive({
  open: false, name: "", unit: "phần",
  imageUrl: "", imagePreview: "", imageUploading: false,
  saving: false, error: "",
});

// ── crop bridge ────────────────────────────────────────────────

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

// ── data loading ───────────────────────────────────────────────

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadData() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [ingRes, menuRes] = await Promise.all([
      api.get("/ingredients?activeOnly=true"),
      api.get(`/daily-menus?date=${todayDate()}`),
    ]);
    ingredients.value = ingRes.data as Ingredient[];
    const menus = menuRes.data as DailyMenu[];
    todayMenu.value = menus.length > 0 ? menus[0] : null;

    const init: Record<number, Draft> = {};
    for (const ing of ingredients.value) {
      const pool = todayMenu.value?.stockPools.find(p => p.ingredient?.id === ing.id);
      init[ing.id] = { active: pool?.isAvailable ?? false, quantity: pool ? String(pool.quantity) : "1", saving: false };
    }
    drafts.value = init;
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không tải được dữ liệu.");
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// ── ingredient list ────────────────────────────────────────────

const sortedIngredients = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = ingredients.value;
  if (q) {
    const tag = q.startsWith("#") ? q.slice(1) : q;
    list = list.filter(ing => ing.name.toLowerCase().includes(tag) || ing.slug.includes(tag));
  }
  return [...list].sort((a, b) => (drafts.value[b.id]?.active ? 1 : 0) - (drafts.value[a.id]?.active ? 1 : 0));
});

function toggleIngredient(ing: Ingredient) {
  const d = drafts.value[ing.id];
  if (!d) return;
  d.active = !d.active;
  if (d.active && Number(d.quantity) <= 0) d.quantity = "1";
}

function changeQty(ingId: number, delta: number) {
  const d = drafts.value[ingId];
  if (!d) return;
  d.quantity = String(Math.max(1, (Number(d.quantity) || 1) + delta));
}

async function saveIngredient(ing: Ingredient) {
  const d = drafts.value[ing.id];
  if (!d) return;
  d.saving = true;
  errorMessage.value = "";
  try {
    // Re-sync: menu may exist in DB from another session/tab
    if (!todayMenu.value) {
      const { data: check } = await api.get(`/daily-menus?date=${todayDate()}`);
      const found = (check as DailyMenu[])[0] ?? null;
      if (found) todayMenu.value = found;
    }

    const qty = Math.max(1, Number(d.quantity) || 1);
    const existing = todayMenu.value?.stockPools ?? [];
    const others = existing
      .filter(p => p.ingredient?.id !== ing.id)
      .map(p => ({ id: p.id, ingredientId: p.ingredient!.id, quantity: Number(p.quantity), isAvailable: p.isAvailable }));
    const thisOne = existing.find(p => p.ingredient?.id === ing.id);
    const pool: Record<string, unknown> = { ingredientId: ing.id, quantity: qty, isAvailable: d.active };
    if (thisOne) pool.id = thisOne.id;

    const body = {
      title: todayMenu.value?.title ?? `Kho ${todayDate()}`,
      serviceDate: todayMenu.value?.serviceDate ?? todayDate(),
      stockPools: [...others, pool],
      items: (todayMenu.value?.items ?? []).map(item => ({
        id: item.id, menuItemId: item.menuItemId,
        isAvailable: item.isAvailable, overridePrice: item.overridePrice, highlightLabel: item.highlightLabel,
      })),
    };

    let updated: DailyMenu;
    if (todayMenu.value) {
      const { data } = await api.put(`/daily-menus/${todayMenu.value.id}`, body);
      updated = data as DailyMenu;
    } else {
      const { data } = await api.post("/daily-menus", body);
      updated = data as DailyMenu;
    }
    todayMenu.value = updated;
    const newPool = updated.stockPools.find(p => p.ingredient?.id === ing.id);
    if (newPool) { d.quantity = String(newPool.quantity); d.active = newPool.isAvailable; }
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không lưu được.");
  } finally {
    d.saving = false;
  }
}

// ── upload ─────────────────────────────────────────────────────

async function uploadBlob(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  const { data } = await api.post("/uploads/images", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return (data as { url: string }).url;
}

// ── image handlers ─────────────────────────────────────────────

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

// ── delete ingredient ─────────────────────────────────────────

async function deleteIngredient(ing: Ingredient) {
  errorMessage.value = "";
  try {
    await api.delete(`/ingredients/${ing.id}`);
    ingredients.value = ingredients.value.filter(i => i.id !== ing.id);
    delete drafts.value[ing.id];
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không xóa được nguyên liệu.");
  }
}

// ── new ingredient form ────────────────────────────────────────

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
    drafts.value[created.id] = { active: true, quantity: "1", saving: false };
    closeNewForm();
    await saveIngredient(created);
  } catch (e) {
    newForm.error = getErrorMessage(e, "Không tạo được nguyên liệu.");
  } finally {
    newForm.saving = false;
  }
}
</script>

<style scoped>
.stock-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 8px 0 32px;
}
.stock-header { margin-bottom: 24px; display: flex; flex-direction: column; gap: 14px; }
.stock-title { font-size: 1.35rem; font-weight: 800; color: var(--text); margin: 0; }

.stock-search-wrap { position: relative; max-width: 360px; }
.stock-search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.9rem; pointer-events: none; }
.stock-search {
  width: 100%; padding: 10px 14px 10px 36px; border: 1px solid var(--line);
  border-radius: 14px; background: rgba(var(--panel-rgb), 0.9); font-size: 0.95rem;
  color: var(--text); outline: none; box-sizing: border-box; transition: border-color 0.18s;
}
.stock-search:focus { border-color: var(--ember); }

.stock-error {
  background: rgba(var(--ember-rgb), 0.1); border: 1px solid rgba(var(--ember-rgb), 0.3);
  border-radius: 14px; padding: 12px 16px; color: var(--ember-strong);
  font-size: 0.9rem; margin-bottom: 16px;
}
.stock-loading { color: var(--muted); padding: 24px 0; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }

.stock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }

/* new card */
.stock-card {
  background: rgba(var(--panel-rgb), 0.7); border: 1px solid var(--line); border-radius: 20px;
  padding: 14px; display: flex; flex-direction: column; gap: 10px; opacity: 0.55;
  transition: opacity 0.2s, border-color 0.2s, box-shadow 0.2s; position: relative; overflow: hidden;
}
.stock-card-new { border-style: dashed; opacity: 0.75; justify-content: center; min-height: 80px; }
.stock-card-new.is-open { opacity: 1; border-style: solid; border-color: rgba(var(--ember-rgb), 0.3); }

.stock-new-trigger {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; background: none; border: none; color: var(--muted);
  font-size: 0.92rem; font-weight: 600; cursor: pointer; padding: 8px 0; transition: color 0.18s;
}
.stock-new-trigger:hover { color: var(--ember); }
.stock-new-trigger i { font-size: 1.1rem; }

.stock-new-form { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.stock-new-img-wrap {
  position: relative; width: 100%; aspect-ratio: 4/3; border-radius: 12px; overflow: hidden;
  cursor: pointer; background: var(--surface,#f5f3ef); border: 1px dashed var(--line); flex-shrink: 0;
}
.stock-new-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stock-new-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--line); font-size: 1.6rem; }
.stock-new-img-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.28);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1rem; opacity: 0; transition: opacity 0.18s;
}
.stock-new-img-wrap:hover .stock-new-img-overlay { opacity: 1; }
.stock-file-hidden { display: none; }

.stock-new-field { display: flex; flex-direction: column; gap: 4px; }
.stock-new-label { font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.stock-new-input {
  border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px;
  font-size: 0.93rem; color: var(--text); background: rgba(255,255,255,0.85);
  outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.18s;
}
.stock-new-input--sm { width: 100px; }
.stock-new-input:focus { border-color: var(--ember); }
.stock-new-actions { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.stock-new-cancel {
  flex: 1; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font-size: 0.88rem; cursor: pointer;
}
.stock-new-cancel:hover { border-color: var(--text); color: var(--text); }
.stock-new-actions .stock-save-btn { flex: 1; }
.stock-new-error { font-size: 0.82rem; color: var(--ember-strong); }

.stock-save-btn {
  flex-shrink: 0; padding: 5px 14px; border-radius: 10px; font-size: 0.88rem;
  font-weight: 700; cursor: pointer; min-width: 48px;
  display: inline-flex; align-items: center; justify-content: center;
}
.stock-save-btn:disabled { opacity: 0.6; cursor: default; }
</style>
