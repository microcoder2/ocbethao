<template>
  <Teleport to="body">
    <Transition name="mi2m-fade">
      <div v-if="open" class="mi2m-backdrop" @click.self="$emit('close')">
        <div class="mi2m-modal">
          <div class="mi2m-head">
            <div>
              <div class="mi2m-title">Thêm món</div>
              <div class="mi2m-subtitle">{{ groupLabel }}</div>
            </div>
            <button class="mi2m-close" type="button" @click="$emit('close')">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <div class="mi2m-body">
            <div class="mi2m-row">
              <label class="mi2m-label">Cách chế biến</label>
              <select
                :value="methodId"
                class="mi2m-select"
                @change="$emit('update:method-id', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">Chọn cách chế biến</option>
                <option v-for="method in methods" :key="method.id" :value="method.id">
                  {{ method.name }}
                </option>
              </select>
            </div>

            <div class="mi2m-row">
              <label class="mi2m-label">Giá</label>
              <div class="mi2m-k-wrap">
                <input
                  :value="priceText"
                  class="mi2m-input"
                  inputmode="numeric"
                  @focus="$emit('update:price-text', '')"
                  @input="$emit('update:price-text', ($event.target as HTMLInputElement).value)"
                />
                <span class="mi2m-k">k</span>
              </div>
            </div>

            <div class="mi2m-preview">{{ previewName }}</div>
          </div>

          <div class="mi2m-foot">
            <button class="mi2m-btn mi2m-btn--ghost" type="button" @click="$emit('close')">Đóng</button>
            <button class="mi2m-btn mi2m-btn--primary" type="button" :disabled="saving" @click="$emit('submit')">
              {{ saving ? "Đang tạo..." : "Tạo món" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  groupLabel: string;
  methodId: string;
  priceText: string;
  previewName: string;
  saving: boolean;
  methods: Array<{ id: string; name: string }>;
}>();

defineEmits<{
  close: [];
  submit: [];
  "update:method-id": [value: string];
  "update:price-text": [value: string];
}>();
</script>

<style scoped>
.mi2m-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
  background: rgba(34, 24, 18, 0.44);
}

.mi2m-modal {
  width: 100%;
  max-width: 520px;
  padding: 12px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 18px 18px 0 0;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: var(--shadow);
}

.mi2m-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.mi2m-title {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mi2m-subtitle {
  margin-top: 4px;
  color: var(--text);
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.35;
}

.mi2m-close,
.mi2m-btn,
.mi2m-select,
.mi2m-input {
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
}

.mi2m-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-width: 40px;
  height: 40px;
  border-radius: 10px;
}

.mi2m-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mi2m-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mi2m-label {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mi2m-select,
.mi2m-input {
  width: 100%;
  min-height: 46px;
  padding: 0 12px;
  border-radius: 999px;
  border-color: rgba(var(--ember-rgb), 0.28);
  background: rgba(var(--ember-rgb), 0.08);
  box-shadow: none;
}

.mi2m-select {
  appearance: none;
}

.mi2m-k-wrap {
  position: relative;
  width: 100%;
}

.mi2m-input {
  padding-right: 28px;
  text-align: right;
}

.mi2m-k {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  color: var(--muted);
  font-weight: 700;
}

.mi2m-preview {
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  font-weight: 700;
  line-height: 1.4;
}

.mi2m-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.mi2m-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  transition: background .12s, border-color .12s, color .12s;
}

.mi2m-btn--ghost {
  color: var(--muted);
  background: rgba(var(--text-rgb), 0.04);
}

.mi2m-btn--primary {
  border-color: rgba(var(--ember-rgb), 0.42);
  background: rgba(var(--ember-rgb), 0.14);
  color: var(--ember-strong);
}

.mi2m-btn--ghost:hover,
.mi2m-btn--ghost:focus-visible,
.mi2m-close:hover,
.mi2m-close:focus-visible {
  color: var(--text);
  outline: none;
}

.mi2m-btn--primary:hover:not(:disabled),
.mi2m-btn--primary:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.6);
  background: rgba(var(--ember-rgb), 0.2);
  outline: none;
}

.mi2m-fade-enter-active,
.mi2m-fade-leave-active {
  transition: opacity .18s ease;
}

.mi2m-fade-enter-from,
.mi2m-fade-leave-to {
  opacity: 0;
}

@media (min-width: 768px) {
  .mi2m-modal {
    margin: auto;
    border-radius: 18px;
  }
}
</style>
