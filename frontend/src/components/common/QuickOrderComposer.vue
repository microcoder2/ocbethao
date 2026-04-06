<template>
  <div class="quick-order-composer">
    <OrderDraftPanel
      :title="title"
      :summary="summary"
      :lines="lines"
      :arrival-time="arrivalTime"
      :arrival-mode="arrivalMode"
      :note="note"
      :disabled="disabled"
      :submit-disabled="submitDisabled"
      :submitting="submitting"
      :sticky="sticky"
      :compact="compact"
      :framed="framed"
      :show-header="showHeader"
      :show-summary="showSummary"
      :submit-label="submitLabel"
      :submitting-label="submittingLabel"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      @change-qty="$emit('change-qty', $event)"
      @update-line-note="$emit('update-line-note', $event)"
      @remove-line="$emit('remove-line', $event)"
      @update:arrival-time="$emit('update:arrival-time', $event)"
      @update:arrival-mode="$emit('update:arrival-mode', $event)"
      @update:note="$emit('update:note', $event)"
      @submit="$emit('submit')"
    >
      <template #before-lines>
        <slot name="before-picker"></slot>

        <div v-if="metaChips.length" class="quick-order-composer__meta">
          <span
            v-for="chip in metaChips"
            :key="`${chip.icon || 'text'}-${chip.text}`"
            class="quick-order-composer__meta-chip"
          >
            <i v-if="chip.icon" :class="['bi', chip.icon]"></i>
            {{ chip.text }}
          </span>
        </div>

        <div v-if="bannerText" class="quick-order-composer__banner">
          {{ bannerText }}
        </div>

        <div v-if="menuOptions.length" class="quick-order-picker">
          <MenuIngredientFilterCard
            :buckets="pickerBuckets"
            :open-bucket-names="Array.from(openCats)"
            :selected-key="selectedGroupKey"
            @toggle-bucket="toggleCat"
            @select-group="handleSelectGroup"
          />

          <fieldset
            v-if="selectedGroup"
            class="quick-order-picker__fieldset quick-order-picker__fieldset--methods"
          >
            <legend class="quick-order-picker__legend quick-order-picker__legend--methods">
              Cách nấu
            </legend>
            <div class="quick-order-picker__methods">
              <button
                v-for="item in pickerIngredientItems"
                :key="item.id"
                type="button"
                class="quick-order-picker__method"
                :disabled="disabled || submitting || !canSelectItem(item)"
                @click="$emit('select-item', item)"
              >
                <span>{{ methodLabel(item, selectedGroup.label) }}</span>
                <span class="quick-order-picker__price">{{ formatMoneyShort(item.sellingPrice) }}</span>
              </button>
            </div>
          </fieldset>
        </div>

        <div v-else-if="emptyMenuHint" class="quick-order-composer__hint">
          {{ emptyMenuHint }}
        </div>
      </template>
    </OrderDraftPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import OrderDraftPanel from "./OrderDraftPanel.vue";
import MenuIngredientFilterCard from "./MenuIngredientFilterCard.vue";
import { formatMoneyShort } from "../../utils/format";

type DraftLine = {
  key: string | number;
  name: string;
  price: number;
  quantity: number;
  note?: string | null;
};

type QuickOrderMenuOption = {
  id: number;
  sellingPrice: number;
  isAvailable: boolean;
  menuItem?: {
    id: number;
    name: string;
    category?: { name: string } | null;
  } | null;
  stockLinks?: Array<{
    stockPool?: {
      id?: number;
      label?: string | null;
      remainingQuantity?: number | null;
    } | null;
  }>;
};

type MetaChip = {
  icon?: string;
  text: string;
};

type PickerGroup = {
  key: string;
  label: string;
  poolId: number | null;
  remaining: number | null;
  items: QuickOrderMenuOption[];
};

type PickerCategory = {
  name: string;
  groups: PickerGroup[];
};

const props = withDefaults(
  defineProps<{
    title: string;
    summary?: string;
    lines: DraftLine[];
    arrivalTime: string;
    arrivalMode?: "scheduled" | "unknown" | "arrived";
    note: string;
    menuOptions: QuickOrderMenuOption[];
    bannerText?: string;
    metaChips?: MetaChip[];
    stockRemainingMap?: Record<number, number>;
    disabled?: boolean;
    submitDisabled?: boolean;
    submitting?: boolean;
    submitLabel?: string;
    submittingLabel?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyMenuHint?: string;
    sticky?: boolean;
    showHeader?: boolean;
    showSummary?: boolean;
    compact?: boolean;
    framed?: boolean;
    accordion?: boolean;
    autoOpenCategories?: boolean;
  }>(),
  {
    summary: "",
    bannerText: "",
    metaChips: () => [],
    stockRemainingMap: () => ({}),
    arrivalMode: "unknown",
    disabled: false,
    submitDisabled: false,
    submitting: false,
    submitLabel: "Gửi đơn",
    submittingLabel: "Đang xử lý...",
    emptyTitle: "Chưa có món",
    emptyDescription: "Thêm món để bắt đầu tạo đơn.",
    emptyMenuHint: "",
    sticky: false,
    showHeader: false,
    showSummary: false,
    compact: true,
    framed: false,
    accordion: false,
    autoOpenCategories: true,
  }
);

defineEmits<{
  "change-qty": [payload: { key: string | number; delta: number }];
  "remove-line": [key: string | number];
  "update:arrival-time": [value: string];
  "update:arrival-mode": [value: "scheduled" | "unknown" | "arrived"];
  "update:note": [value: string];
  "update-line-note": [payload: { key: string | number; note: string }];
  "select-item": [item: QuickOrderMenuOption];
  submit: [];
}>();

const selectedGroupKey = ref<string | null>(null);
const openCats = ref<Set<string>>(new Set());

const pickerCategories = computed((): PickerCategory[] => {
  const categories = new Map<
    string,
    Map<string, Omit<PickerGroup, "remaining">>
  >();

  for (const option of props.menuOptions) {
    const categoryName = option.menuItem?.category?.name ?? "Khác";
    if (!categories.has(categoryName)) {
      categories.set(categoryName, new Map());
    }

    const pool = option.stockLinks?.[0]?.stockPool;
    const label = pool?.label || "Khác";
    const poolId = pool?.id ?? null;
    const groupKey = `${categoryName}::${label}::${poolId ?? "none"}`;
    const groups = categories.get(categoryName)!;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { key: groupKey, label, poolId, items: [] });
    }

    groups.get(groupKey)!.items.push(option);
  }

  return Array.from(categories.entries()).map(([name, groups]) => ({
    name,
    groups: Array.from(groups.values()).map((group) => ({
      ...group,
      remaining: group.poolId != null ? props.stockRemainingMap[group.poolId] ?? null : null,
    })),
  }));
});

const selectedGroup = computed((): PickerGroup | null => {
  if (!selectedGroupKey.value) return null;

  for (const category of pickerCategories.value) {
    const group = category.groups.find((entry) => entry.key === selectedGroupKey.value);
    if (group) {
      return group;
    }
  }

  return null;
});

const pickerIngredientItems = computed(() => selectedGroup.value?.items ?? []);

const pickerBuckets = computed(() =>
  pickerCategories.value.map((category) => ({
    name: category.name,
    groups: category.groups.map((group) => ({
      key: group.key,
      label: group.label,
      badge: group.remaining,
      items: group.items,
    })),
  }))
);

function handleSelectGroup(key: string) {
  selectedGroupKey.value = selectedGroupKey.value === key ? null : key;
}

watch(
  pickerCategories,
  (categories) => {
    const nextOpenCats = new Set(
      [...openCats.value].filter((name) =>
        categories.some((category) => category.name === name)
      )
    );

    if (props.autoOpenCategories) {
      for (const category of categories) {
        nextOpenCats.add(category.name);
      }
    }

    openCats.value = nextOpenCats;

    if (
      selectedGroupKey.value &&
      !categories.some((category) =>
        category.groups.some((group) => group.key === selectedGroupKey.value)
      )
    ) {
      selectedGroupKey.value = null;
    }
  },
  { immediate: true }
);

function getItemRemaining(item: QuickOrderMenuOption) {
  const poolId = item.stockLinks?.[0]?.stockPool?.id;
  if (poolId == null) {
    return null;
  }

  const liveRemaining = props.stockRemainingMap[poolId];
  if (liveRemaining != null) {
    return liveRemaining;
  }

  return item.stockLinks?.[0]?.stockPool?.remainingQuantity ?? null;
}

function canSelectItem(item: QuickOrderMenuOption) {
  const remaining = getItemRemaining(item);
  return Boolean(item.isAvailable) && remaining !== 0;
}

function toggleCat(name: string) {
  const next = new Set(openCats.value);
  if (next.has(name)) {
    next.delete(name);
    const category = pickerCategories.value.find((entry) => entry.name === name);
    if (category?.groups.some((group) => group.key === selectedGroupKey.value)) {
      selectedGroupKey.value = null;
    }
  } else {
    if (props.accordion) {
      next.clear();
    }
    next.add(name);
  }
  openCats.value = next;
}

function methodLabel(item: QuickOrderMenuOption, ingredientLabel: string) {
  const name = item.menuItem?.name ?? "";
  const stripped = name.replace(new RegExp(`^${ingredientLabel}\\s*`, "i"), "").trim();
  return stripped || name;
}
</script>

<style scoped>
.quick-order-composer {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.quick-order-composer__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.quick-order-composer__meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.72);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.quick-order-composer__banner,
.quick-order-composer__hint {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--text);
  font-size: 0.82rem;
}

.quick-order-composer__banner {
  background: rgba(var(--ember-rgb), 0.08);
  font-weight: 600;
}

.quick-order-composer__hint {
  border: 1px dashed rgba(var(--line-rgb), 0.72);
  background: rgba(var(--panel-rgb), 0.72);
  color: var(--muted);
}

.quick-order-picker {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}

.quick-order-picker__fieldset--methods {
  display: grid;
  padding: 0;
  margin: 0;
  border: 1px solid rgba(var(--ember-rgb), 0.25);
  border-radius: 10px;
  background: rgba(var(--ember-rgb), 0.03);
}

.quick-order-picker__legend--methods {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ember-strong);
  cursor: default;
  user-select: none;
}

.quick-order-picker__methods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
}

.quick-order-picker__method {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(var(--muted-rgb), 0.18);
  border-radius: 10px;
  background: rgba(var(--panel-rgb), 0.9);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
}

.quick-order-picker__price {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(var(--muted-rgb), 0.08);
}

.quick-order-picker__method:hover:not(:disabled) {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.4);
  color: var(--ember-strong);
  transform: translateY(-1px);
}

.quick-order-picker__method:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
