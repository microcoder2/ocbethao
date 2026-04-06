<template>
  <div class="mi2c-card">
    <div class="mi2c-head">
      <div class="mi2c-title-wrap">
        <div class="mi2c-title">{{ group.label }}</div>
        <div class="mi2c-meta">{{ group.items.length }} món · {{ group.meta }}</div>
      </div>

      <button
        v-if="group.groupKind === 'ingredient'"
        class="mi2c-add-btn"
        type="button"
        title="Thêm món"
        aria-label="Thêm món"
        @click="$emit('openAdd')"
      >
        <i class="bi bi-journal-plus"></i>
      </button>

      <button
        class="mi2c-collapse-btn"
        type="button"
        :title="open ? 'Thu gọn' : 'Mở rộng'"
        :aria-label="open ? 'Thu gọn' : 'Mở rộng'"
        @click="$emit('toggleCollapse')"
      >
        <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </button>
    </div>

    <div v-if="open" class="mi2c-body">
      <div v-for="item in group.items" :key="item.id" class="mi2c-item-row">
        <div class="mi2c-item-main">
          <div class="mi2c-item-name">{{ item.name }}</div>
        </div>

        <div class="mi2c-item-price">
          <template v-if="editingPriceId === item.id">
            <div class="mi2c-k-input-wrap mi2c-k-input-wrap--sm">
              <input
                :value="editingPriceText"
                class="mi2c-k-input"
                inputmode="numeric"
                @focus="$emit('clearEditPrice')"
                @input="$emit('update:editingPriceText', ($event.target as HTMLInputElement).value)"
                @keyup.enter="$emit('saveInlinePrice', item)"
              />
              <span class="mi2c-k-suffix">k</span>
            </div>
            <button class="mi2c-icon-btn mi2c-icon-btn--accent" type="button" title="Lưu giá" @click="$emit('saveInlinePrice', item)">
              <i class="bi bi-floppy-fill"></i>
            </button>
          </template>
          <template v-else>
            <strong class="mi2c-price-text">{{ formatMoneyK(item.currentPrice) }}</strong>
            <button class="mi2c-icon-btn" type="button" title="Sửa giá" @click="$emit('startInlinePrice', item)">
              <i class="bi bi-pencil"></i>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type CardItem = {
  id: number;
  name: string;
  currentPrice: number;
};

defineProps<{
  group: {
    key: string;
    label: string;
    meta: string;
    items: CardItem[];
    groupKind: "ingredient" | "method";
  };
  open: boolean;
  editingPriceId: number | null;
  editingPriceText: string;
}>();

defineEmits<{
  toggleCollapse: [];
  openAdd: [];
  clearEditPrice: [];
  "update:editingPriceText": [value: string];
  startInlinePrice: [item: CardItem];
  saveInlinePrice: [item: CardItem];
}>();

function formatMoneyK(value: number | null | undefined) {
  const amount = Number(value || 0);
  return `${Math.round(amount / 1000)}k`;
}
</script>

<style scoped>
.mi2c-card {
  background: rgba(var(--panel-rgb), 0.94);
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  box-shadow: var(--shadow);
  color: var(--muted);
}

.mi2c-head,
.mi2c-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mi2c-head {
  padding: 8px 12px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.mi2c-title-wrap {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mi2c-title {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mi2c-meta {
  color: var(--muted);
  font-size: 0.78rem;
  white-space: nowrap;
}

.mi2c-add-btn,
.mi2c-icon-btn {
  border: 1px solid rgba(var(--muted-rgb), 0.14);
  background: rgba(var(--muted-rgb), 0.06);
  color: var(--muted);
  box-shadow: inset 0 2px 4px rgba(var(--text-rgb), 0.08);
}

.mi2c-add-btn,
.mi2c-icon-btn {
  width: 32px;
  min-width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mi2c-add-btn {
  justify-self: center;
}

.mi2c-collapse-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 0;
  display: inline-flex;
  align-items: center;
}

.mi2c-collapse-btn i {
  color: var(--muted);
  font-size: 0.95rem;
}

.mi2c-collapse-btn:hover,
.mi2c-collapse-btn:focus-visible,
.mi2c-icon-btn:hover,
.mi2c-icon-btn:focus-visible,
.mi2c-add-btn:hover,
.mi2c-add-btn:focus-visible {
  color: var(--text);
  outline: none;
  transform: translateY(-1px);
}

.mi2c-body {
  padding: 2px 10px 8px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mi2c-item-row {
  min-height: 42px;
  border-bottom: 1px dashed rgba(var(--line-rgb), 0.7);
  padding-bottom: 8px;
}

.mi2c-item-main {
  flex: 1;
  min-width: 0;
}

.mi2c-item-name,
.mi2c-price-text {
  color: var(--muted);
  font-weight: 700;
  font-size: 0.76rem;
}

.mi2c-item-name {
  line-height: 1.35;
}

.mi2c-item-price {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mi2c-k-input-wrap {
  position: relative;
}

.mi2c-k-input-wrap--sm {
  width: 82px;
  flex: 0 0 82px;
}

.mi2c-k-input {
  width: 100%;
  min-height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
  box-shadow: none;
  text-align: right;
  padding: 0 28px 0 12px;
}

.mi2c-k-suffix {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  color: var(--muted);
  font-weight: 700;
}

.mi2c-icon-btn--accent {
  color: var(--ember-strong);
}
</style>
