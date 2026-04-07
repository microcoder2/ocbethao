<template>
  <article :class="['order-card', `is-status-${tone}`, { 'is-collapsed': collapsed }]">
    <div class="order-card-head">
      <div class="order-head-main">
        <slot name="head-main"></slot>
      </div>
      <div class="order-head-side">
        <div v-if="hasInfo" ref="infoTriggerRef" class="order-info-wrap">
          <button
            class="order-info-trigger"
            type="button"
            :aria-label="infoAriaLabel"
            @click.stop="toggleInfo"
          >
            <i class="bi bi-info-circle"></i>
          </button>
          <div v-if="infoOpen" class="order-info-popup" role="tooltip">
            <div v-for="line in normalizedInfoLines" :key="line">{{ line }}</div>
          </div>
        </div>
        <div class="order-total">{{ totalText }}</div>
        <button
          class="order-collapse-btn"
          type="button"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? 'Mở rộng đơn' : 'Thu gọn đơn'"
          :title="collapsed ? 'Mở rộng' : 'Thu gọn'"
          @click="$emit('update:collapsed', !collapsed)"
        >
          <i :class="['bi', collapsed ? 'bi-chevron-down' : 'bi-chevron-up']"></i>
        </button>
      </div>
    </div>

    <div :class="['order-status-line', statusLineClass]">
      <span class="order-arrival-chip"><i class="bi bi-clock"></i> {{ arrivalText }}</span>
      <span v-if="guestCountText" class="order-pill is-muted">{{ guestCountText }}</span>
      <span v-if="statusMetaText" class="order-pill is-muted">{{ statusMetaText }}</span>
      <span class="order-item-count-chip">{{ itemCountText }}</span>
      <span :class="['order-pill', `is-${tone}`]">{{ statusText }}</span>
      <button
        v-if="showDelete"
        class="order-delete-inline"
        type="button"
        :disabled="deleteDisabled"
        :title="deleteTitle"
        @click="$emit('delete')"
      >
        <i class="bi bi-trash3"></i>
      </button>
    </div>

    <div v-show="!collapsed" class="order-collapsible">
      <slot></slot>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  collapsed?: boolean;
  tone?: string;
  totalText: string;
  infoAriaLabel?: string;
  infoLines?: string[];
  arrivalText: string;
  guestCountText?: string;
  itemCountText: string;
  statusText: string;
  statusMetaText?: string | null;
  showDelete?: boolean;
  deleteDisabled?: boolean;
  deleteTitle?: string;
}>(), {
  collapsed: false,
  tone: "pending",
  infoAriaLabel: "Thông tin đơn",
  infoLines: () => [],
  guestCountText: "",
  statusMetaText: "",
  showDelete: false,
  deleteDisabled: false,
  deleteTitle: "Xóa đơn",
});

defineEmits<{
  "update:collapsed": [value: boolean];
  delete: [];
}>();

const infoOpen = ref(false);
const infoTriggerRef = ref<HTMLElement | null>(null);

const normalizedInfoLines = computed(() =>
  props.infoLines
    .map((line) => String(line || "").trim())
    .filter(Boolean)
);
const hasInfo = computed(() => normalizedInfoLines.value.length > 0);
const statusLineClass = computed(() => ({
  "has-meta": Boolean(props.statusMetaText),
  "has-delete": props.showDelete,
}));

function toggleInfo() {
  if (!hasInfo.value) return;
  infoOpen.value = !infoOpen.value;
}

function closeInfoOnOutside(event: MouseEvent) {
  if (infoTriggerRef.value && !infoTriggerRef.value.contains(event.target as Node)) {
    infoOpen.value = false;
  }
}

watch(infoOpen, (isOpen) => {
  if (isOpen) {
    document.addEventListener("click", closeInfoOnOutside);
  } else {
    document.removeEventListener("click", closeInfoOnOutside);
  }
});

watch(hasInfo, (value) => {
  if (!value) {
    infoOpen.value = false;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", closeInfoOnOutside);
});
</script>

<style scoped>
.order-card {
  --order-status-surface: rgba(var(--panel-rgb), 0.96);
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  margin-bottom: 6px;
  background: var(--order-status-surface);
}

.order-card:last-child { margin-bottom: 0; }
.order-card.is-collapsed { gap: 8px; }
.order-collapsible { display: grid; gap: 14px; }

.order-card.is-status-pending   { --order-status-surface: rgba(203, 165, 81, 0.12); }
.order-card.is-status-confirmed { --order-status-surface: rgba(201, 126, 71, 0.1); }
.order-card.is-status-completed { --order-status-surface: rgba(66, 133, 104, 0.11); }
.order-card.is-status-cancelled { --order-status-surface: rgba(148, 88, 88, 0.1); }

.order-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-head-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.order-head-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  text-align: right;
}

.order-info-wrap {
  position: relative;
  display: inline-flex;
}

.order-info-popup {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(30, 20, 14, 0.92);
  color: #fff;
  font-size: 0.8rem;
  line-height: 1.6;
  white-space: nowrap;
  z-index: 200;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.order-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  transition: color 0.18s, border-color 0.18s, background 0.18s;
}

.order-info-trigger:hover,
.order-info-trigger:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}

.order-info-trigger i { font-size: 0.95rem; }

.order-collapse-btn {
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
}

.order-collapse-btn:hover,
.order-collapse-btn:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(201, 88, 44, 0.32);
  background: rgba(255, 247, 241, 0.92);
  outline: none;
}

.order-collapse-btn i { font-size: 0.82rem; }

.order-status-line {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.order-status-line.has-meta {
  grid-template-columns: minmax(0, 1fr) repeat(3, auto);
}

.order-status-line.has-delete {
  grid-template-columns: minmax(0, 1fr) repeat(3, auto);
}

.order-status-line.has-meta.has-delete {
  grid-template-columns: minmax(0, 1fr) repeat(4, auto);
}

.order-delete-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--bs-danger, #dc3545);
  opacity: 0.7;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}

.order-delete-inline:hover {
  opacity: 1;
  background: rgba(220, 53, 69, 0.08);
}

.order-delete-inline i { font-size: 0.82rem; }

.order-item-count-chip {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
}

.order-arrival-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px 0 0;
  color: var(--ember-strong);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  justify-self: start;
  z-index: 0;
}

.order-arrival-chip i { margin-right: 4px; }

.order-arrival-chip::before {
  content: "";
  position: absolute;
  inset: 0;
  left: -10px;
  border-radius: 999px;
  background: rgba(246, 233, 220, 0.9);
  z-index: -1;
}

.order-total {
  font-weight: 800;
  color: var(--ember-strong);
}

.order-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  white-space: nowrap;
  flex-shrink: 0;
  justify-self: end;
}

.order-pill.is-pending   { background: rgba(203, 165, 81, 0.18); color: #8b6517; }
.order-pill.is-confirmed { background: rgba(201, 126, 71, 0.16); color: #8a451f; }
.order-pill.is-completed { background: rgba(66, 133, 104, 0.15); color: var(--green); }
.order-pill.is-cancelled { background: rgba(148, 88, 88, 0.14); color: #8f2f15; }
.order-pill.is-unpaid    { background: rgba(var(--ember-rgb), 0.12); color: var(--ember-strong); }
.order-pill.is-paid      { background: rgba(var(--green-rgb), 0.14); color: var(--green); }
.order-pill.is-refunded  { background: rgba(var(--text-rgb), 0.08); color: var(--text); }
.order-pill.is-muted     { background: rgba(var(--text-rgb), 0.06); color: var(--muted); }

@media (max-width: 767px) {
  .order-card { padding: 16px; }
  .order-card-head { gap: 12px; }
  .order-head-side { min-width: 96px; }
}
</style>
