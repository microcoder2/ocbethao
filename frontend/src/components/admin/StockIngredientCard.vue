<template>
  <div class="stock-card-wrap">
    <button class="stock-card-del-btn" title="Xóa" @click="showConfirm = true">
      <i class="bi bi-x-lg"></i>
    </button>

    <div class="stock-card" :class="{ 'is-active': draft.active }">
      <div v-if="showImg" class="stock-card-img-wrap" :title="ing.imageUrl ? 'Đổi ảnh' : 'Thêm ảnh'" @click="fileRef?.click()">
        <img v-if="hasImg" :src="resolvedUrl" class="stock-card-img" @error="onImgError" />
        <div v-else class="stock-card-img stock-card-img--blank" v-html="blankIngredientSvg"></div>
        <div class="stock-card-img-overlay">
          <i v-if="uploadingImg" class="bi bi-hourglass-split"></i>
          <i v-else class="bi bi-camera-fill"></i>
        </div>
      </div>
      <input ref="fileRef" type="file" accept="image/*" class="stock-file-hidden" @change="onFileChange" />

      <div class="stock-card-top">
        <div class="stock-card-info">
          <span class="stock-card-name">{{ ing.name }}</span>
          <span class="stock-card-unit">{{ ing.unit }}</span>
          <div v-if="draft.active" class="stock-card-stats">
            <span class="stock-card-stat">Còn {{ remainingQuantity }}</span>
            <span v-if="soldQuantity > 0" class="stock-card-stat stock-card-stat--muted">
              Đã dùng {{ soldQuantity }}
            </span>
          </div>
        </div>
        <button class="stock-toggle" :class="{ on: draft.active }" @click="emit('toggle')">
          <span class="stock-toggle-knob"></span>
        </button>
      </div>

      <div v-if="draft.active" class="stock-card-body">
        <button class="stock-qty-btn" @click="emit('qtyChange', -1)"><i class="bi bi-dash"></i></button>
        <input
          class="stock-qty-input"
          type="number"
          min="0"
          :value="draft.quantity"
          @input="emit('qtyInput', ($event.target as HTMLInputElement).value)"
        />
        <button class="stock-qty-btn" @click="emit('qtyChange', 1)"><i class="bi bi-plus"></i></button>
      </div>
    </div>

    <!-- confirm overlay -->
    <Transition name="del-confirm">
      <div v-if="showConfirm" class="stock-del-overlay">
        <i class="bi bi-trash3 stock-del-icon"></i>
        <p class="stock-del-text">Xóa <strong>{{ ing.name }}</strong>?</p>
        <div class="stock-del-actions">
          <button class="stock-del-no" title="Hủy" @click="showConfirm = false">
            <i class="bi bi-x-lg"></i>
          </button>
          <button class="stock-del-yes" title="Xác nhận xóa" @click="confirmDelete">
            <i class="bi bi-check-lg"></i>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { API_BASE_URL } from "../../config";
import blankIngredientSvg from "../../assets/blank_ingredient.svg?raw";

type Ingredient = { id: number; name: string; slug: string; unit: string; imageUrl: string | null };
type Draft      = { active: boolean; quantity: string; saving: boolean; soldQuantity?: number };

const props = defineProps<{ ing: Ingredient; draft: Draft; uploadingImg: boolean; showImg?: boolean }>();
const emit  = defineEmits<{
  toggle:    [];
  qtyChange: [delta: number];
  qtyInput:  [value: string];
  imgPick:   [file: File];
  delete:    [];
}>();

const fileRef     = ref<HTMLInputElement | null>(null);
const showConfirm = ref(false);
const imgFailed   = ref(false);

const hasImg = computed(() => !!props.ing.imageUrl && !imgFailed.value);
const remainingQuantity = computed(() => Math.max(Number(props.draft.quantity || 0), 0));
const soldQuantity = computed(() => Math.max(Number(props.draft.soldQuantity || 0), 0));
const resolvedUrl = computed(() => {
  const url = props.ing.imageUrl;
  if (!url) return "";
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
});

function onImgError() { imgFailed.value = true; }

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (e.target as HTMLInputElement).value = "";
  emit("imgPick", file);
}

function confirmDelete() {
  showConfirm.value = false;
  emit("delete");
}
</script>

<style scoped>
/* ── wrapper (allows X button to overflow the card) ── */
.stock-card-wrap {
  position: relative;
  min-width: 0;
  width: 100%;
}

/* ── X delete button ── */
.stock-card-del-btn {
  position: absolute;
  top: -11px; right: -11px;
  z-index: 3;
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: rgba(var(--danger-rgb), 0.85);
  color: #fff;
  font-size: 0.6rem;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.18s, background 0.18s, transform 0.15s;
  padding: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.stock-card-wrap:hover .stock-card-del-btn {
  opacity: 1;
}
.stock-card-del-btn:hover {
  background: var(--danger);
  transform: scale(1.15);
}

/* ── card ── */
.stock-card {
  background: rgba(var(--panel-rgb), 0.7); border: 1px solid var(--line); border-radius: 20px;
  padding: 14px; display: flex; flex-direction: column; gap: 10px; opacity: 0.55;
  transition: opacity 0.2s, border-color 0.2s, box-shadow 0.2s; position: relative; overflow: hidden;
}
.stock-card.is-active {
  opacity: 1; border-color: rgba(var(--ember-rgb), 0.38);
  box-shadow: 0 6px 24px rgba(var(--ember-rgb), 0.12); background: rgba(var(--sidebar-fg-rgb), 0.95);
}

.stock-card-img-wrap {
  position: relative; width: 100%; aspect-ratio: 4/3; border-radius: 12px;
  overflow: hidden; cursor: pointer; flex-shrink: 0; background: var(--surface,#f5f3ef);
}
.stock-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stock-card-img--blank {
  display: flex; align-items: center; justify-content: center;
  background: var(--panel-soft); color: var(--ember);
}
.stock-card-img--blank :deep(svg) { width: 55%; aspect-ratio: 4/3; display: block; }
.stock-card-img-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.32);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.1rem; opacity: 0; transition: opacity 0.18s;
}
.stock-card-img-wrap:hover .stock-card-img-overlay { opacity: 1; }
.stock-file-hidden { display: none; }

.stock-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.stock-card-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stock-card-name { font-weight: 700; font-size: 0.97rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stock-card-unit { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.stock-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.stock-card-stat {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ember-strong);
  background: rgba(var(--ember-rgb), 0.1);
  border-radius: 999px;
  padding: 2px 7px;
}
.stock-card-stat--muted {
  color: var(--muted);
  background: rgba(0, 0, 0, 0.06);
}

.stock-toggle { flex-shrink: 0; width: 44px; height: 24px; border-radius: 999px; border: none; background: var(--line); cursor: pointer; position: relative; transition: background 0.2s; padding: 0; }
.stock-toggle.on { background: linear-gradient(135deg, var(--ember), var(--ember-strong)); }
.stock-toggle-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.18); }
.stock-toggle.on .stock-toggle-knob { transform: translateX(20px); }

.stock-card-body { display: flex; align-items: center; gap: 4px; padding: 0 2px; }
.stock-qty-btn {
  width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.7); color: var(--text);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.9rem; padding: 0; flex-shrink: 0;
}
.stock-qty-btn:hover { background: rgba(var(--ember-rgb), 0.08); border-color: rgba(var(--ember-rgb), 0.3); }
.stock-qty-input {
  width: 52px; text-align: center; border: 1px solid var(--line); border-radius: 8px;
  padding: 4px 6px; font-size: 0.95rem; font-weight: 600; color: var(--text);
  background: rgba(255,255,255,0.8); outline: none; -moz-appearance: textfield;
}
.stock-qty-input::-webkit-outer-spin-button,
.stock-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; }
.stock-qty-input:focus { border-color: var(--ember); }

.stock-save-btn {
  flex-shrink: 0; padding: 5px 14px; border-radius: 10px; font-size: 0.88rem;
  font-weight: 700; cursor: pointer; min-width: 48px;
  display: inline-flex; align-items: center; justify-content: center;
}
.stock-save-btn:disabled { opacity: 0.6; cursor: default; }

/* ── confirm overlay ── */
.stock-del-overlay {
  position: absolute; inset: 0; z-index: 2;
  background: rgba(18, 16, 13, 0.88);
  border-radius: 20px;
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
  font-size: 0.85rem; font-weight: 700; cursor: pointer;
  transition: background 0.15s;
}
.stock-del-yes:hover { background: var(--danger); }

/* ── confirm transition ── */
.del-confirm-enter-active, .del-confirm-leave-active { transition: opacity 0.15s; }
.del-confirm-enter-from, .del-confirm-leave-to { opacity: 0; }
</style>
