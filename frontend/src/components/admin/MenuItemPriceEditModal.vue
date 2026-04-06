<template>
  <Teleport to="body">
    <Transition name="mi2p-fade">
      <div v-if="open" class="mi2p-backdrop" @click.self="$emit('close')">
        <div class="mi2p-modal" role="dialog" aria-modal="true">
          <div class="mi2p-head">
            <div>
              <div class="mi2p-title">Sửa giá</div>
              <div class="mi2p-subtitle">{{ itemName }}</div>
            </div>
            <button class="mi2p-close" type="button" @click="$emit('close')">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <div class="mi2p-body">
            <div class="mi2p-row">
              <label class="mi2p-label">Giá hiện tại</label>
              <div class="mi2p-current">{{ formatMoneyK(currentPrice) }}</div>
            </div>

            <div class="mi2p-row">
              <label class="mi2p-label">Giá mới</label>
              <div class="mi2p-k-wrap">
                <input
                  :value="priceText"
                  class="mi2p-input"
                  inputmode="numeric"
                  placeholder="Nhập số k"
                  @focus="$emit('update:price-text', '')"
                  @input="$emit('update:price-text', ($event.target as HTMLInputElement).value)"
                  @keyup.enter="$emit('submit')"
                />
                <span class="mi2p-k">k</span>
              </div>
            </div>
          </div>

          <div class="mi2p-foot">
            <button class="mi2p-btn mi2p-btn--ghost" type="button" @click="$emit('close')">Đóng</button>
            <button class="mi2p-btn mi2p-btn--primary" type="button" :disabled="saving" @click="$emit('submit')">
              {{ saving ? "Đang lưu..." : "Lưu giá" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";

const props = defineProps<{
  open: boolean;
  itemName: string;
  currentPrice: number;
  priceText: string;
  saving: boolean;
}>();

defineEmits<{
  close: [];
  submit: [];
  "update:price-text": [value: string];
}>();

function formatMoneyK(value: number | null | undefined) {
  const amount = Number(value || 0);
  return `${Math.round(amount / 1000)}k`;
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? "hidden" : "";
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.body.style.overflow = "";
});
</script>

<style scoped>
.mi2p-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
  background: rgba(34, 24, 18, 0.5);
  overscroll-behavior: contain;
}

.mi2p-modal {
  width: 100%;
  max-width: 520px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 18px 18px 0 0;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: var(--shadow);
  padding: 12px;
}

.mi2p-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.mi2p-title {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mi2p-subtitle {
  margin-top: 4px;
  color: var(--text);
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.35;
}

.mi2p-close,
.mi2p-btn,
.mi2p-input {
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
}

.mi2p-close {
  width: 40px;
  min-width: 40px;
  height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mi2p-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mi2p-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mi2p-label {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mi2p-current {
  min-height: 46px;
  border-radius: 999px;
  border: 1px solid rgba(var(--ember-rgb), 0.18);
  background: rgba(var(--ember-rgb), 0.08);
  padding: 0 12px;
  display: flex;
  align-items: center;
  color: var(--ember-strong);
  font-weight: 800;
}

.mi2p-k-wrap {
  position: relative;
}

.mi2p-input {
  width: 100%;
  min-height: 46px;
  border-radius: 999px;
  border-color: rgba(var(--ember-rgb), 0.28);
  background: rgba(var(--ember-rgb), 0.08);
  box-shadow: none;
  padding: 0 28px 0 12px;
  text-align: right;
}

.mi2p-k {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  color: var(--muted);
  font-weight: 700;
}

.mi2p-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.mi2p-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.mi2p-btn--ghost {
  color: var(--muted);
  background: rgba(var(--text-rgb), 0.04);
}

.mi2p-btn--primary {
  border-color: rgba(var(--ember-rgb), 0.42);
  background: rgba(var(--ember-rgb), 0.14);
  color: var(--ember-strong);
}

.mi2p-btn--primary:hover:not(:disabled),
.mi2p-btn--primary:focus-visible,
.mi2p-btn--ghost:hover,
.mi2p-btn--ghost:focus-visible,
.mi2p-close:hover,
.mi2p-close:focus-visible {
  outline: none;
}

.mi2p-fade-enter-active,
.mi2p-fade-leave-active {
  transition: opacity .18s ease;
}

.mi2p-fade-enter-from,
.mi2p-fade-leave-to {
  opacity: 0;
}

@media (min-width: 768px) {
  .mi2p-modal {
    margin: auto;
    border-radius: 18px;
  }
}
</style>
