<template>
  <div class="stock-shell">
    <div class="stock-header">
      <h1 class="stock-title">Danh sách nguyên liệu</h1>
      <div class="stock-search-wrap">
        <i class="bi bi-search stock-search-icon"></i>
        <input
          v-model="search"
          class="stock-search"
          type="text"
          placeholder="Tìm tên nguyên liệu..."
          autocomplete="off"
        />
      </div>
    </div>

    <div v-if="errorMessage" class="stock-error">{{ errorMessage }}</div>

    <div v-if="loading" class="stock-loading">
      <i class="bi bi-hourglass-split"></i> Đang tải...
    </div>

    <div v-else class="stock-grid">
      <!-- ── add new card ── -->
      <div class="stock-card stock-card-new" :class="{ 'is-open': newForm.open }">
        <template v-if="!newForm.open">
          <button class="stock-new-trigger" @click="openNewForm">
            <i class="bi bi-plus-lg"></i>
            <span>Thêm nguyên liệu</span>
          </button>
        </template>
        <template v-else>
          <div class="stock-new-form">
            <div class="stock-img-wrap" @click="newImgRef?.click()">
              <img v-if="newForm.imagePreview" :src="newForm.imagePreview" class="stock-img" />
              <div v-else class="stock-img-blank"><i class="bi bi-camera"></i></div>
              <div class="stock-img-overlay">
                <i v-if="newForm.imageUploading" class="bi bi-hourglass-split"></i>
                <i v-else class="bi bi-camera-fill"></i>
              </div>
              <input ref="newImgRef" type="file" accept="image/*" class="stock-file-hidden" @change="handleNewImg" />
            </div>
            <div class="stock-new-field">
              <label class="stock-new-label">Tên nguyên liệu</label>
              <input ref="newNameRef" v-model="newForm.name" class="stock-new-input" type="text" placeholder="VD: Sò huyết" @keydown.enter="createIngredient" />
            </div>
            <div class="stock-new-field">
              <label class="stock-new-label">Đơn vị</label>
              <input v-model="newForm.unit" class="stock-new-input stock-new-input--sm" type="text" placeholder="kg / con / phần..." />
            </div>
            <div class="stock-new-actions">
              <button class="stock-new-cancel" @click="cancelNewForm">Hủy</button>
              <button
                class="stock-save-btn btn-ember"
                :disabled="!newForm.name.trim() || newForm.saving"
                @click="createIngredient"
              >
                <i v-if="newForm.saving" class="bi bi-hourglass-split"></i>
                <span v-else>Tạo</span>
              </button>
            </div>
            <div v-if="newForm.error" class="stock-new-error">{{ newForm.error }}</div>
          </div>
        </template>
      </div>

      <!-- ── ingredient cards ── -->
      <div
        v-for="ing in filteredIngredients"
        :key="ing.id"
        class="stock-card-wrap"
      >
        <div class="stock-card" :class="{ 'is-editing': editingId === ing.id }">

          <!-- image -->
          <div class="stock-img-wrap" :title="ing.imageUrl ? 'Đổi ảnh' : 'Thêm ảnh'" @click="handlePickImg(ing)">
            <img v-if="ing.imageUrl && !imgErrors.has(ing.id)" :src="resolveImg(ing.imageUrl)" class="stock-img" @error="imgErrors.add(ing.id)" />
            <div v-else class="stock-img-blank" v-html="blankIngredientSvg"></div>
            <div class="stock-img-overlay">
              <i v-if="uploadingImgFor === ing.id" class="bi bi-hourglass-split"></i>
              <i v-else class="bi bi-camera-fill"></i>
            </div>
            <input :ref="el => fileRefs[ing.id] = el as HTMLInputElement" type="file" accept="image/*" class="stock-file-hidden" @change="e => onFileChange(e, ing)" />
          </div>

          <!-- normal view -->
          <template v-if="editingId !== ing.id">
            <div class="stock-card-info">
              <span class="stock-card-name">{{ ing.name }}</span>
              <span class="stock-card-unit">{{ ing.unit }}</span>
            </div>
            <div class="stock-card-actions">
              <button class="stock-action-btn" @click="startEdit(ing)">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="stock-action-btn stock-action-btn--del" @click="deletingId = ing.id">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          </template>

          <!-- edit view -->
          <template v-else>
            <div class="stock-edit-form">
              <input v-model="editForm.name" class="stock-edit-input" type="text" placeholder="Tên nguyên liệu" @keydown.enter="saveEdit(ing)" @keydown.esc="editingId = null" />
              <input v-model="editForm.unit" class="stock-edit-input stock-edit-input--sm" type="text" placeholder="Đơn vị" />
              <div class="stock-edit-actions">
                <button class="stock-new-cancel" @click="editingId = null">Hủy</button>
                <button class="stock-save-btn btn-ember" :disabled="!editForm.name.trim() || editSaving" @click="saveEdit(ing)">
                  <i v-if="editSaving" class="bi bi-hourglass-split"></i>
                  <span v-else>Lưu</span>
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- delete confirm overlay -->
        <Transition name="del-confirm">
          <div v-if="deletingId === ing.id" class="stock-del-overlay">
            <i class="bi bi-trash3 stock-del-icon"></i>
            <p class="stock-del-text">Xóa <strong>{{ ing.name }}</strong>?</p>
            <div class="stock-del-actions">
              <button class="stock-del-no" @click="deletingId = null"><i class="bi bi-x-lg"></i></button>
              <button class="stock-del-yes" @click="deleteIngredient(ing)"><i class="bi bi-check-lg"></i></button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>

  <CropDialog :file="cropFile" @done="onCropDone" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, reactive } from "vue";
import { api } from "../../api";
import { API_BASE_URL } from "../../config";
import CropDialog from "../../components/admin/CropDialog.vue";
import blankIngredientSvg from "../../assets/blank_ingredient.svg?raw";

// ── types ──────────────────────────────────────────────────────────────────

type Ingredient = { id: number; name: string; slug: string; unit: string; imageUrl: string | null };

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

function resolveImg(url: string) {
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

// ── state ──────────────────────────────────────────────────────────────────

const ingredients     = ref<Ingredient[]>([]);
const search          = ref("");
const loading         = ref(false);
const errorMessage    = ref("");
const uploadingImgFor = ref<number | null>(null);
const imgErrors       = ref(new Set<number>());

// edit state
const editingId   = ref<number | null>(null);
const editSaving  = ref(false);
const deletingId  = ref<number | null>(null);
const editForm    = reactive({ name: "", unit: "" });

// new form
const newNameRef = ref<HTMLInputElement | null>(null);
const newImgRef  = ref<HTMLInputElement | null>(null);
const newForm = reactive({
  open: false, name: "", unit: "phần",
  imageUrl: "", imagePreview: "", imageUploading: false,
  saving: false, error: "",
});

// per-ingredient file input refs
const fileRefs: Record<number, HTMLInputElement | null> = {};

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

const filteredIngredients = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return ingredients.value;
  return ingredients.value.filter(ing => ing.name.toLowerCase().includes(q) || ing.slug.includes(q));
});

// ── data loading ───────────────────────────────────────────────────────────

async function loadData() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const { data } = await api.get("/ingredients");
    ingredients.value = data as Ingredient[];
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không tải được danh sách nguyên liệu.");
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// ── upload ─────────────────────────────────────────────────────────────────

async function uploadBlob(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  const { data } = await api.post("/uploads/images", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return (data as { url: string }).url;
}

// ── image handlers ─────────────────────────────────────────────────────────

function handlePickImg(ing: Ingredient) {
  fileRefs[ing.id]?.click();
}

function onFileChange(e: Event, ing: Ingredient) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (e.target as HTMLInputElement).value = "";
  openCrop(file, async (blob) => {
    uploadingImgFor.value = ing.id;
    errorMessage.value = "";
    try {
      const url = await uploadBlob(blob);
      await api.put(`/ingredients/${ing.id}`, { name: ing.name, slug: ing.slug, unit: ing.unit, imageUrl: url, isActive: true });
      ingredients.value = ingredients.value.map(i => i.id === ing.id ? { ...i, imageUrl: url } : i);
      imgErrors.value.delete(ing.id);
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

// ── CRUD ───────────────────────────────────────────────────────────────────

async function deleteIngredient(ing: Ingredient) {
  errorMessage.value = "";
  deletingId.value = null;
  try {
    await api.delete(`/ingredients/${ing.id}`);
    ingredients.value = ingredients.value.filter(i => i.id !== ing.id);
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không xóa được nguyên liệu.");
  }
}

function startEdit(ing: Ingredient) {
  editingId.value = ing.id;
  editForm.name = ing.name;
  editForm.unit = ing.unit;
}

async function saveEdit(ing: Ingredient) {
  const name = editForm.name.trim();
  if (!name) return;
  editSaving.value = true;
  errorMessage.value = "";
  try {
    const slug = toSlug(name);
    const unit = editForm.unit.trim() || ing.unit;
    await api.put(`/ingredients/${ing.id}`, { name, slug, unit, imageUrl: ing.imageUrl, isActive: true });
    ingredients.value = ingredients.value.map(i => i.id === ing.id ? { ...i, name, slug, unit } : i);
    editingId.value = null;
  } catch (e) {
    errorMessage.value = getErrorMessage(e, "Không lưu được.");
  } finally {
    editSaving.value = false;
  }
}

// ── new form ───────────────────────────────────────────────────────────────

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
    ingredients.value = [...ingredients.value, data as Ingredient];
    closeNewForm();
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

.stock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }

/* ── add new card ── */
.stock-card {
  background: rgba(var(--panel-rgb), 0.7); border: 1px solid var(--line); border-radius: 20px;
  overflow: hidden; display: flex; flex-direction: column;
  transition: box-shadow 0.2s;
}
.stock-card-new {
  border-style: dashed;
  min-height: 80px;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}
.stock-card-new.is-open { border-style: solid; border-color: rgba(var(--ember-rgb), 0.3); padding: 14px; }

.stock-new-trigger {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 100%; background: none; border: none; color: var(--muted);
  font-size: 0.92rem; font-weight: 600; cursor: pointer; padding: 20px 12px; transition: color 0.18s;
}
.stock-new-trigger:hover { color: var(--ember); }
.stock-new-trigger i { font-size: 1.1rem; }

.stock-new-form { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.stock-new-field { display: flex; flex-direction: column; gap: 4px; }
.stock-new-label { font-size: 0.7rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.stock-new-input {
  border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px;
  font-size: 0.93rem; color: var(--text); background: rgba(255,255,255,0.85);
  outline: none; width: 100%; box-sizing: border-box; font: inherit; transition: border-color 0.18s;
}
.stock-new-input--sm { width: 100px; }
.stock-new-input:focus { border-color: var(--ember); }
.stock-new-actions { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.stock-new-cancel {
  flex: 1; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); font-size: 0.88rem; cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.stock-new-cancel:hover { border-color: var(--text); color: var(--text); }
.stock-new-actions .stock-save-btn { flex: 1; }
.stock-new-error { font-size: 0.82rem; color: var(--ember-strong); }

/* ── image area ── */
.stock-img-wrap {
  position: relative; width: 100%; aspect-ratio: 4/3;
  overflow: hidden; cursor: pointer; background: var(--surface, #f5f3ef); flex-shrink: 0;
}
.stock-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stock-img-blank {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  color: var(--ember); font-size: 1.4rem;
}
.stock-img-blank :deep(svg) { width: 55%; aspect-ratio: 4/3; display: block; }
.stock-img-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.1rem; opacity: 0; transition: opacity 0.18s;
}
.stock-img-wrap:hover .stock-img-overlay { opacity: 1; }
.stock-file-hidden { display: none; }

/* ── card body ── */
.stock-card-wrap { position: relative; }

.stock-card-info {
  padding: 10px 12px 4px;
  display: flex; flex-direction: column; gap: 2px;
}
.stock-card-name { font-weight: 700; font-size: 0.97rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stock-card-unit { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }

.stock-card-actions {
  padding: 6px 10px 10px;
  display: flex; gap: 6px; justify-content: flex-end;
}
.stock-action-btn {
  width: 30px; height: 30px; border-radius: 9px; border: 1px solid var(--line);
  background: transparent; color: var(--muted); cursor: pointer; font-size: 0.8rem;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.stock-action-btn:hover { background: rgba(var(--ember-rgb), 0.08); border-color: rgba(var(--ember-rgb), 0.3); color: var(--ember); }
.stock-action-btn--del:hover { background: rgba(var(--danger-rgb), 0.1); border-color: rgba(var(--danger-rgb), 0.3); color: var(--danger); }

/* ── edit form (inline on card) ── */
.stock-card.is-editing .stock-img-wrap { pointer-events: none; opacity: 0.7; }

.stock-edit-form {
  padding: 10px 12px 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.stock-edit-input {
  border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px;
  font: inherit; font-size: 0.9rem; color: var(--text);
  background: rgba(255,255,255,0.85); outline: none;
  width: 100%; box-sizing: border-box; transition: border-color 0.15s;
}
.stock-edit-input--sm { width: 100px; }
.stock-edit-input:focus { border-color: var(--ember); }
.stock-edit-actions { display: flex; gap: 8px; }
.stock-edit-actions .stock-save-btn { flex: 1; }
.stock-edit-actions .stock-new-cancel { flex: 1; }

/* ── save button ── */
.stock-save-btn {
  flex-shrink: 0; padding: 5px 14px; border-radius: 10px; font-size: 0.88rem;
  font-weight: 700; cursor: pointer; min-width: 48px;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
}
.stock-save-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }

/* ── delete confirm overlay ── */
.stock-del-overlay {
  position: absolute; inset: 0; z-index: 2;
  background: rgba(18, 16, 13, 0.88); border-radius: 20px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 16px;
}
.stock-del-icon { font-size: 1.4rem; color: rgba(245,240,232,0.6); }
.stock-del-text { margin: 0; font-size: 0.88rem; color: rgba(245,240,232,0.85); text-align: center; }
.stock-del-text strong { color: #f5f0e8; }
.stock-del-actions { display: flex; gap: 8px; width: 100%; }
.stock-del-no {
  flex: 1; padding: 6px 10px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.18); background: transparent;
  color: rgba(245,240,232,0.65); font-size: 0.85rem; cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.stock-del-no:hover { border-color: rgba(255,255,255,0.4); color: #f5f0e8; }
.stock-del-yes {
  flex: 1; padding: 6px 10px; border-radius: 10px; border: none;
  background: rgba(var(--danger-rgb), 0.85); color: #fff;
  font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: background 0.15s;
}
.stock-del-yes:hover { background: var(--danger); }

.del-confirm-enter-active, .del-confirm-leave-active { transition: opacity 0.15s; }
.del-confirm-enter-from, .del-confirm-leave-to { opacity: 0; }
</style>
