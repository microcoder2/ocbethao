<template>
  <Teleport to="body">
    <Transition name="mi-fade">
      <div v-if="open" class="mi-backdrop mi-backdrop--fullscreen" @click.self="$emit('close')">
        <div class="mi-modal mi-modal--fullscreen">
          <div class="mi-modal-header">
            <span class="mi-modal-title">{{ isEdit ? `Sửa: ${form.name || '—'}` : 'Thêm món mới' }}</span>
            <button class="mi-modal-close mi-modal-close--static" type="button" @click="$emit('close')">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <div class="mi-modal-body">
            <div class="mi-img-wrap" @click="fileInput?.click()">
              <img
                v-if="form.imageUrl && !modalImgFailed"
                :src="resolveImg(form.imageUrl)"
                class="mi-img-preview"
                @error="modalImgFailed = true"
              />
              <div v-else class="mi-img-preview mi-img-preview--blank" v-html="blankIngredientSvg"></div>
              <div class="mi-img-overlay">
                <i v-if="uploading" class="bi bi-hourglass-split"></i>
                <i v-else class="bi bi-camera-fill"></i>
              </div>
              <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
            </div>

            <div class="mi-row2">
              <div class="mi-field">
                <label class="mi-label">Nguyên liệu chính</label>
                <select v-model.number="form.ingredientId" class="mi-select" @change="autoFillName">
                  <option :value="0">-- chọn nguyên liệu --</option>
                  <option v-for="ing in ingredients" :key="ing.id" :value="ing.id">{{ ing.name }}</option>
                </select>
              </div>
              <div class="mi-field">
                <label class="mi-label">Cách chế biến</label>
                <select v-model="form.cookingMethod" class="mi-select" @change="autoFillName">
                  <option value="">-- chọn --</option>
                  <option v-for="m in cookingMethods" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
              </div>
            </div>

            <div class="mi-row2">
              <div class="mi-field mi-field--grow">
                <label class="mi-label">Tên món</label>
                <input v-model="form.name" class="mi-input" placeholder="Ví dụ: Sò huyết xào bơ" @input="autoSlug" />
              </div>
              <div class="mi-field">
                <label class="mi-label">Slug</label>
                <input v-model="form.slug" class="mi-input mi-input--mono" placeholder="so-huyet-xao-bo" />
              </div>
            </div>

            <div class="mi-row3">
              <div class="mi-field">
                <select v-model.number="form.categoryId" class="mi-select" aria-label="Nhóm món">
                  <option :value="0">Nhóm món</option>
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div class="mi-field">
                <input
                  :value="formatPriceInput(form.currentPrice)"
                  class="mi-input"
                  type="text"
                  min="0"
                  placeholder="Giá (đ)"
                  aria-label="Giá hiện hành"
                  inputmode="numeric"
                  autocomplete="off"
                  @input="onPriceInput"
                />
              </div>
              <div class="mi-field">
                <select v-model="form.unit" class="mi-select" aria-label="Đơn vị bán">
                  <option value="">Đơn vị bán</option>
                  <option v-for="u in units" :key="u.id" :value="u.name">{{ u.name }}</option>
                </select>
              </div>
            </div>

            <div class="mi-row2">
              <div class="mi-field">
                <input
                  v-model.number="form.preparationTimeMin"
                  class="mi-input"
                  type="number"
                  min="0"
                  placeholder="Phút chuẩn bị"
                  aria-label="Chuẩn bị (phút)"
                />
              </div>
              <div class="mi-field">
                <input
                  v-model="form.consumeQuantityNote"
                  class="mi-input mi-input--sm"
                  type="text"
                  :disabled="form.ingredientId <= 0"
                  :placeholder="form.ingredientId > 0
                    ? `Ví dụ: 5-6 con lớn / phần${selectedIngUnit ? `, ${selectedIngUnit}` : ''}`
                    : 'Chọn nguyên liệu trước'"
                  aria-label="Ghi chú định lượng"
                  autocomplete="off"
                />
              </div>
            </div>

            <div class="mi-field">
              <label class="mi-label">Mô tả</label>
              <textarea
                v-model="form.description"
                class="mi-input mi-textarea"
                rows="2"
                placeholder="Hương vị, cách phục vụ, ghi chú..."
              ></textarea>
            </div>

            <div class="mi-row-flags">
              <div class="mi-field mi-field--status">
                <select v-model="form.status" class="mi-select mi-select--compact" aria-label="Trạng thái">
                  <option value="">Trạng thái</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div class="mi-flags-center">
                <label class="mi-checkbox-label">
                  <input v-model="form.isAvailable" type="checkbox" />
                  <span>Khả dụng</span>
                </label>
                <label class="mi-checkbox-label">
                  <input v-model="form.isFeatured" type="checkbox" />
                  <span>Nổi bật</span>
                </label>
              </div>
            </div>
          </div>

          <div class="mi-modal-footer">
            <div v-if="errorMessage" class="mi-error-banner">
              <i class="bi bi-exclamation-triangle-fill"></i>
              <span>{{ errorMessage }}</span>
            </div>
            <button class="mi-btn mi-btn--ghost" type="button" @click="$emit('close')">Hủy</button>
            <button class="mi-btn mi-btn--save btn-ember" type="button" :disabled="saving || !canSubmit" @click="$emit('save')">
              <i v-if="saving" class="bi bi-hourglass-split"></i>
              <span v-else>{{ isEdit ? 'Cập nhật' : 'Tạo món' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <CropDialog :file="cropFile" @done="onCropDone" />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import CropDialog from "./CropDialog.vue";

type LocalOption = { id: string; name: string };
type Category = { id: number; name: string };
type Ingredient = { id: number; name: string; unit?: string };

const props = defineProps<{
  open: boolean;
  isEdit: boolean;
  form: Record<string, any>;
  categories: Category[];
  ingredients: Ingredient[];
  units: LocalOption[];
  cookingMethods: LocalOption[];
  selectedIngUnit: string;
  saving: boolean;
  uploading: boolean;
  canSubmit: boolean;
  errorMessage: string;
  blankIngredientSvg: string;
  resolveImg: (url: string) => string;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  "image-crop": [blob: Blob | null];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const cropFile = ref<File | null>(null);
const modalImgFailed = ref(false);

watch(() => props.open, (value) => {
  if (!value) {
    modalImgFailed.value = false;
    if (fileInput.value) fileInput.value.value = "";
    cropFile.value = null;
  }
});

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null;
  if (!file) return;
  if (fileInput.value) fileInput.value.value = "";
  cropFile.value = file;
}

function onCropDone(blob: Blob) {
  cropFile.value = null;
  emit("image-crop", blob);
  if (fileInput.value) fileInput.value.value = "";
}

function formatPriceInput(value: unknown) {
  const digits = String(value ?? "")
    .replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function onPriceInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const digits = target.value.replace(/[^\d]/g, "");
  props.form.currentPrice = digits ? Number(digits) : "";
  target.value = formatPriceInput(digits);
}

function autoSlug() {
  const text = String(props.form.name || "");
  props.form.slug = text
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function autoFillName() {
  const ing = props.ingredients.find((item) => item.id === Number(props.form.ingredientId));
  const method = props.cookingMethods.find((item) => item.id === String(props.form.cookingMethod));
  props.form.name = ing && method ? `${ing.name} ${method.name}` : ing?.name || "";
  autoSlug();
}
</script>

<style scoped>
.mi-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(18, 16, 13, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.mi-backdrop--fullscreen {
  align-items: center;
  padding: 20px;
}

.mi-modal {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.mi-modal--fullscreen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
}

.mi-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  flex-shrink: 0;
}

.mi-modal--fullscreen .mi-modal-header {
  position: static;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  background: #fff;
}

.mi-modal-title {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0;
  padding-right: 0;
}

.mi-modal-close {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.mi-modal-close--static {
  position: static;
  flex: 0 0 auto;
}

.mi-modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

.mi-modal--fullscreen .mi-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 18px 20px;
  overflow: auto;
  overscroll-behavior: contain;
}

.mi-modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.mi-modal--fullscreen .mi-modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  background: #fff;
}

.mi-img-wrap {
  position: relative;
  width: 100%;
  height: 150px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface, #f5f3ef);
  flex-shrink: 0;
}

.mi-img-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mi-img-preview--blank {
  width: 100%;
  height: 100%;
  background: var(--panel-soft);
  color: var(--ember);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mi-img-preview--blank :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.mi-img-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.4rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.mi-img-wrap:hover .mi-img-overlay {
  opacity: 1;
}

.mi-row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.mi-row3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.mi-row-flags {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.mi-field--status {
  min-width: 180px;
  order: -1;
}

.mi-flags-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.mi-select--compact {
  min-width: 180px;
}

.mi-checkbox-label {
  min-height: 40px;
  align-items: center;
  line-height: 1;
}

.mi-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mi-field--grow {
  flex: 1;
}

.mi-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mi-input,
.mi-select {
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 0.9rem;
  color: var(--text);
  background: rgba(255, 255, 255, 0.9);
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.mi-input:focus,
.mi-select:focus {
  border-color: var(--ember);
}

.mi-select-group {
  display: flex;
  gap: 4px;
}

.mi-select-group .mi-select {
  flex: 1;
  min-width: 0;
}

.mi-input--mono {
  font-family: monospace;
  font-size: 0.82rem;
}

.mi-textarea {
  resize: vertical;
  min-height: 64px;
}

.mi-btn {
  padding: 0 14px;
  min-height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.8);
  color: var(--text);
}

.mi-btn--ghost {
  color: var(--muted);
  background: rgba(var(--text-rgb), 0.04);
}

.mi-error-banner {
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(160, 60, 48, 0.24);
  background: rgba(160, 60, 48, 0.08);
  color: #8d342b;
  font-size: 0.82rem;
  font-weight: 700;
}

.btn-ember {
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
  color: #fff;
  border-color: transparent;
}

.mi-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;
  user-select: none;
}

@media (max-width: 639px) {
  .mi-backdrop--fullscreen {
    align-items: stretch;
    padding: 0;
  }

  .mi-modal--fullscreen {
    max-width: none;
    max-height: none;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
    gap: 0;
    padding: 0;
    border-radius: 0;
    border: 0;
    box-shadow: none;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .mi-modal--fullscreen .mi-modal-header {
    position: sticky;
    top: 0;
    z-index: 2;
    padding: max(10px, env(safe-area-inset-top)) 12px 10px;
    border-bottom: 1px solid rgba(var(--line-rgb), 0.9);
    background: rgba(var(--panel-rgb), 0.98);
  }

  .mi-modal--fullscreen .mi-modal-body {
    padding: 2px 12px calc(40px + env(safe-area-inset-bottom));
    gap: 10px;
  }

  .mi-modal--fullscreen .mi-modal-footer {
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(var(--line-rgb), 0.9);
    background: rgba(var(--panel-rgb), 0.98);
  }

  .mi-error-banner {
    width: 100%;
    margin-right: 0;
    min-height: 36px;
    justify-content: flex-start;
  }

  .mi-row2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .mi-row3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
