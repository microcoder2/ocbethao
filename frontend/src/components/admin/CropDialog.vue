<template>
  <Teleport to="body">
    <div v-if="open" class="crop-overlay" @mouseup="stopDrag" @mousemove="onMouseMove" @mouseleave="stopDrag">
      <div class="crop-popup">
        <div class="crop-popup-title">
          Chỉnh vùng ảnh <span class="crop-tag">4 : 3</span>
          <span class="crop-tag crop-scale-tag">{{ Math.round(state.scale * 100) }}%</span>
        </div>

        <div
          ref="vpRef"
          class="crop-viewport"
          @mousedown.prevent="startDrag"
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        >
          <img :src="state.blobUrl" :style="imgStyle" draggable="false" class="crop-img" />
          <div class="crop-guide crop-guide-h" style="top:33.33%"></div>
          <div class="crop-guide crop-guide-h" style="top:66.66%"></div>
          <div class="crop-guide crop-guide-v" style="left:33.33%"></div>
          <div class="crop-guide crop-guide-v" style="left:66.66%"></div>
        </div>

        <div class="crop-controls">
          <div class="crop-zoom-btns">
            <button class="crop-zoom-btn" @click="zoomBy(0.8)"><i class="bi bi-dash-lg"></i></button>
            <button class="crop-zoom-btn" @click="zoomFit">Fit</button>
            <button class="crop-zoom-btn" @click="zoomFill">Fill</button>
            <button class="crop-zoom-btn" @click="zoomBy(1.25)"><i class="bi bi-plus-lg"></i></button>
          </div>
          <p class="crop-hint"><i class="bi bi-arrows-move"></i> Kéo · cuộn để zoom</p>
        </div>

        <div class="crop-actions">
          <button class="crop-btn-skip" @click="useDefault">Dùng mặc định</button>
          <button class="crop-btn-confirm" :disabled="state.saving" @click="confirm">
            <i v-if="state.saving" class="bi bi-hourglass-split"></i>
            <span v-else>Lưu vùng này</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from "vue";

const props = defineProps<{ file: File | null }>();
const emit  = defineEmits<{ done: [blob: Blob] }>();

// ── internal state ────────────────────────────────────────────

const open  = ref(false);
const vpRef = ref<HTMLElement | null>(null);

const state = reactive({
  blobUrl:  "",
  naturalW: 0,
  naturalH: 0,
  vpW: 0,
  vpH: 0,
  scale:    1,
  imgX:     0,
  imgY:     0,
  dragging: false,
  dragMX: 0, dragMY: 0,
  dragOX: 0, dragOY: 0,
  saving:   false,
});

let pinchDist  = 0;
let sourceFile: File | null = null;

// ── watch prop to open ────────────────────────────────────────

watch(() => props.file, async (file) => {
  if (!file) return;
  sourceFile = file;
  const blobUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    state.naturalW = img.naturalWidth;
    state.naturalH = img.naturalHeight;
    state.blobUrl  = blobUrl;
    state.saving   = false;
    open.value     = true;
    await nextTick();
    if (vpRef.value) {
      const r = vpRef.value.getBoundingClientRect();
      state.vpW = r.width;
      state.vpH = r.height;
      initLayout();
      vpRef.value.addEventListener("wheel", onWheel, { passive: false });
    }
  };
  img.src = blobUrl;
});

// ── layout helpers ────────────────────────────────────────────

function coverScale() { return Math.max(state.vpW / state.naturalW, state.vpH / state.naturalH); }
function fitScale()   { return Math.min(state.vpW / state.naturalW, state.vpH / state.naturalH); }

function initLayout() {
  state.scale = coverScale();
  center();
}

function center() {
  state.imgX = (state.vpW - state.naturalW * state.scale) / 2;
  state.imgY = (state.vpH - state.naturalH * state.scale) / 2;
}

function setScale(s: number, cx = state.vpW / 2, cy = state.vpH / 2) {
  s = Math.max(fitScale() * 0.25, Math.min(coverScale() * 8, s));
  const fx = (cx - state.imgX) / (state.naturalW * state.scale);
  const fy = (cy - state.imgY) / (state.naturalH * state.scale);
  state.imgX  = cx - fx * state.naturalW * s;
  state.imgY  = cy - fy * state.naturalH * s;
  state.scale = s;
}

function zoomBy(factor: number) { setScale(state.scale * factor); }
function zoomFit()  { state.scale = fitScale();   center(); }
function zoomFill() { state.scale = coverScale(); center(); }

// ── image style ───────────────────────────────────────────────

const imgStyle = computed(() => ({
  position:        "absolute" as const,
  top: "0", left: "0",
  width:           `${state.naturalW}px`,
  height:          `${state.naturalH}px`,
  transform:       `translate(${state.imgX}px,${state.imgY}px) scale(${state.scale})`,
  transformOrigin: "0 0",
  willChange:      "transform",
  cursor:          state.dragging ? "grabbing" : "grab",
  userSelect:      "none" as const,
  pointerEvents:   "none" as const,
}));

// ── wheel ─────────────────────────────────────────────────────

function onWheel(e: WheelEvent) {
  e.preventDefault();
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  setScale(state.scale * (e.deltaY < 0 ? 1.1 : 0.91), e.clientX - r.left, e.clientY - r.top);
}

// ── drag ─────────────────────────────────────────────────────

function startDrag(e: MouseEvent) {
  state.dragging = true;
  state.dragMX = e.clientX; state.dragMY = e.clientY;
  state.dragOX = state.imgX;  state.dragOY = state.imgY;
}
function onMouseMove(e: MouseEvent) {
  if (!state.dragging) return;
  state.imgX = state.dragOX + (e.clientX - state.dragMX);
  state.imgY = state.dragOY + (e.clientY - state.dragMY);
}
function stopDrag() { state.dragging = false; }

// ── touch / pinch ─────────────────────────────────────────────

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    state.dragging = true;
    state.dragMX = t.clientX; state.dragMY = t.clientY;
    state.dragOX = state.imgX;  state.dragOY = state.imgY;
    pinchDist = 0;
  } else if (e.touches.length === 2) {
    state.dragging = false;
    pinchDist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
  }
}
function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 1 && state.dragging) {
    const t = e.touches[0];
    state.imgX = state.dragOX + (t.clientX - state.dragMX);
    state.imgY = state.dragOY + (t.clientY - state.dragMY);
  } else if (e.touches.length === 2 && pinchDist > 0) {
    const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    const r    = vpRef.value!.getBoundingClientRect();
    const cx   = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
    const cy   = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
    setScale(state.scale * (dist / pinchDist), cx, cy);
    pinchDist = dist;
  }
}
function onTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2) pinchDist = 0;
  if (e.touches.length === 0) { state.dragging = false; return; }
  const t = e.touches[0];
  state.dragging = true;
  state.dragMX = t.clientX; state.dragMY = t.clientY;
  state.dragOX = state.imgX;  state.dragOY = state.imgY;
}

// ── confirm / default ─────────────────────────────────────────

function close() {
  vpRef.value?.removeEventListener("wheel", onWheel);
  URL.revokeObjectURL(state.blobUrl);
  open.value    = false;
  state.blobUrl = "";
  sourceFile    = null;
}

async function confirm() {
  state.saving = true;
  try {
    const outW  = 960;
    const outH  = Math.round(outW * state.vpH / state.vpW);
    const scale = outW / state.vpW;

    const img = new Image();
    img.src = state.blobUrl;
    if (!img.complete) await new Promise<void>(r => { img.onload = () => r(); });

    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, 0, 0, state.naturalW, state.naturalH,
      state.imgX * scale, state.imgY * scale,
      state.naturalW * state.scale * scale, state.naturalH * state.scale * scale);

    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error("crop failed")), "image/jpeg", 0.85)
    );
    close();
    emit("done", blob);
  } catch {
    state.saving = false;
  }
}

async function useDefault() {
  const file = sourceFile;
  close();
  if (!file) return;
  const blob = await resizeToBlob(file);
  emit("done", blob);
}

function resizeToBlob(file: File, maxW = 960, maxH = 720): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const r = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const c = document.createElement("canvas");
      c.width  = Math.round(img.naturalWidth  * r);
      c.height = Math.round(img.naturalHeight * r);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? resolve(b) : reject(new Error("resize failed")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")); };
    img.src = url;
  });
}
</script>

<style scoped>
.crop-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.crop-popup {
  background: #1c1a17; border-radius: 20px; padding: 20px;
  display: flex; flex-direction: column; gap: 14px;
  width: min(520px, 100%); box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}
.crop-popup-title {
  font-size: 1rem; font-weight: 700; color: #f5f0e8;
  display: flex; align-items: center; gap: 8px;
}
.crop-tag {
  font-size: 0.75rem; font-weight: 600; color: rgba(245,240,232,0.45);
  background: rgba(255,255,255,0.08); border-radius: 6px; padding: 2px 7px; letter-spacing: 0.08em;
}
.crop-scale-tag { margin-left: auto; color: rgba(245,240,232,0.5); font-variant-numeric: tabular-nums; }
.crop-viewport {
  position: relative; width: 100%; aspect-ratio: 4/3; border-radius: 12px;
  overflow: hidden; background: #000; touch-action: none; cursor: grab;
}
.crop-img { display: block; }
.crop-guide { position: absolute; background: rgba(255,255,255,0.15); pointer-events: none; }
.crop-guide-h { left: 0; right: 0; height: 1px; }
.crop-guide-v { top: 0; bottom: 0; width: 1px; }
.crop-controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.crop-zoom-btns { display: flex; gap: 6px; }
.crop-zoom-btn {
  padding: 5px 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06); color: rgba(245,240,232,0.75);
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s; display: inline-flex; align-items: center;
}
.crop-zoom-btn:hover { background: rgba(255,255,255,0.12); color: #f5f0e8; }
.crop-hint { font-size: 0.8rem; color: rgba(245,240,232,0.35); margin: 0; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.crop-actions { display: flex; gap: 10px; align-items: center; }
.crop-btn-skip {
  flex: 1; padding: 8px 14px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.15); background: transparent;
  color: rgba(245,240,232,0.6); font-size: 0.88rem; cursor: pointer;
  transition: border-color 0.18s, color 0.18s;
}
.crop-btn-skip:hover { border-color: rgba(255,255,255,0.35); color: #f5f0e8; }
.crop-btn-confirm {
  flex: 1; padding: 8px 14px; border-radius: 10px; font-size: 0.88rem; font-weight: 700;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
  color: #fff; border: none;
}
.crop-btn-confirm:disabled { opacity: 0.6; cursor: default; }
</style>
