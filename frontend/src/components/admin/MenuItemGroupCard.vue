<template>
  <div class="mi2c-card">
    <div class="mi2c-head" role="button" tabindex="0" @click="$emit('toggleCollapse')" @keydown.enter.prevent="$emit('toggleCollapse')" @keydown.space.prevent="$emit('toggleCollapse')">
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
        @click.stop="$emit('openAdd')"
      >
        <i class="bi bi-journal-plus"></i>
      </button>

      <button
        class="mi2c-collapse-btn"
        type="button"
        :title="open ? 'Thu gọn' : 'Mở rộng'"
        :aria-label="open ? 'Thu gọn' : 'Mở rộng'"
        @click.stop="$emit('toggleCollapse')"
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
          <strong class="mi2c-price-text">{{ formatMoneyK(item.currentPrice) }}</strong>
          <button class="mi2c-icon-btn" type="button" title="Sửa giá" @click="$emit('editPrice', item)">
            <i class="bi bi-pencil"></i>
          </button>
          <template v-if="deleteConfirmId === item.id">
            <button class="mi2c-icon-btn mi2c-icon-btn--yes" type="button" title="Xác nhận xóa" @click="$emit('confirmDelete', item)">
              <i class="bi bi-check-lg"></i>
            </button>
            <button class="mi2c-icon-btn mi2c-icon-btn--no" type="button" title="Hủy" @click="$emit('cancelDelete')">
              <i class="bi bi-x-lg"></i>
            </button>
          </template>
          <button
            v-else
            class="mi2c-icon-btn mi2c-icon-btn--danger"
            type="button"
            title="Xóa món"
            @click="$emit('deleteItem', item)"
          >
            <i class="bi bi-trash3"></i>
          </button>
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
  deleteConfirmId?: number | null;
}>();

defineEmits<{
  toggleCollapse: [];
  openAdd: [];
  editPrice: [item: CardItem];
  deleteItem: [item: CardItem];
  confirmDelete: [item: CardItem];
  cancelDelete: [];
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
  width: 28px;
  min-width: 28px;
  height: 28px;
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

.mi2c-icon-btn--accent {
  color: var(--ember-strong);
}

.mi2c-icon-btn--danger {
  color: #9c3b31;
}

.mi2c-icon-btn--yes {
  background: rgba(var(--success-rgb), 0.1);
  color: #166534;
  border-color: rgba(var(--success-rgb), 0.3);
}

.mi2c-icon-btn--no {
  background: rgba(0, 0, 0, 0.05);
  color: var(--muted);
  border-color: var(--line);
}
</style>
