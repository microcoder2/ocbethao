import { computed, reactive, ref, watch, type ComputedRef, type Ref } from "vue";
import { toggleNoteChip } from "../utils/noteChips";

export type OrderDraftLineItem = {
  key: string;
  itemNameSnapshot: string;
  quantity: number;
  menuItemId?: number | null;
  note?: string | null;
};

type SavePayload = {
  menuItemId?: number;
  quantity: number;
  note?: string;
};

export function formatOrderGuestCountDraft(value?: number | null) {
  const next = Number(value || 0);
  return next > 0 ? String(next) : "";
}

export function parseOrderGuestCountDraft(value: string) {
  const next = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(next) && next > 0 ? next : null;
}

export function buildOrderSaveItemsPayload<TItem extends OrderDraftLineItem>(items: TItem[]): SavePayload[] {
  return items.map((item) => ({
    menuItemId: item.menuItemId ?? undefined,
    quantity: item.quantity,
    note: item.note || undefined,
  }));
}

type PickerStockPool = {
  id?: number | null;
  label?: string | null;
  remainingQuantity?: number | null;
};

type PickerStockLink = {
  stockPool?: PickerStockPool | null;
};

type PickerMenuItem = {
  id: number;
  name: string;
  category?: { name?: string | null } | null;
};

export type OrderItemPickerOption = {
  menuItemId?: number | null;
  isAvailable: boolean;
  availableQuantity?: number | null;
  stockLinks?: PickerStockLink[];
  menuItem: PickerMenuItem;
};

export type OrderItemPickerGroup<TOption extends OrderItemPickerOption> = {
  key: string;
  label: string;
  poolId: number | null;
  remaining: number | null;
  items: TOption[];
};

export type OrderItemPickerCategory<TOption extends OrderItemPickerOption> = {
  name: string;
  groups: Array<OrderItemPickerGroup<TOption>>;
};

type UseOrderEditorOptions<TOption extends OrderItemPickerOption, TDraftItem extends OrderDraftLineItem> = {
  menuOptions: Ref<TOption[]> | ComputedRef<TOption[]>;
  draft: Ref<TDraftItem[] | null>;
  editableItems: ComputedRef<TDraftItem[]>;
  ensureDraft: () => void;
  findExistingDraftIndex: (items: TDraftItem[], option: TOption) => number;
  buildUpdatedDraftItem: (current: TDraftItem, option: TOption) => TDraftItem;
  buildNewDraftItem: (option: TOption) => TDraftItem;
  getDraftItemKey: (item: TDraftItem) => string;
  onItemAdded?: (key: string) => void;
  getItemRemaining?: (item: TOption) => number | null;
  normalizeCategoryLabel?: (value: string) => string;
  categoryOrder?: string[];
  updateQuantity: (item: TDraftItem, nextQuantity: number) => TDraftItem;
};

const DEFAULT_CATEGORY_ORDER = ["Hai mảnh", "Ốc", "Khác"];

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function defaultNormalizeCategoryLabel(value: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("hai manh")) return "Hai mảnh";
  if (normalized.includes("oc")) return "Ốc";
  return String(value || "").trim() || "Khác";
}

function defaultGetItemRemaining<TOption extends OrderItemPickerOption>(item: TOption) {
  const pool = item.stockLinks?.[0]?.stockPool;
  if (pool?.remainingQuantity != null) {
    return pool.remainingQuantity;
  }
  if (item.availableQuantity != null) {
    return item.availableQuantity;
  }
  return null;
}

function defaultMethodLabel<TOption extends OrderItemPickerOption>(item: TOption, ingredientLabel: string) {
  const name = String(item.menuItem?.name || "").trim();
  const label = String(ingredientLabel || "").trim();
  if (!name) return label;

  const normalizedName = normalizeText(name);
  const normalizedLabel = normalizeText(label);
  if (normalizedName.startsWith(normalizedLabel)) {
    const stripped = name.slice(label.length).trim().replace(/^[-·–—\s]+/, "");
    return stripped || name;
  }

  return name;
}

export function useOrderEditor<TOption extends OrderItemPickerOption, TDraftItem extends OrderDraftLineItem>(
  options: UseOrderEditorOptions<TOption, TDraftItem>
) {
  const highlightedKey = ref<string | null>(null);
  const openItemNoteKeys = ref<Set<string>>(new Set());
  const removeDialog = reactive({
    visible: false,
    index: -1,
    itemName: "",
  });
  const addPickerOpen = ref(false);
  const multiSelectMode = ref(false);
  const selectedGroupKey = ref<string | null>(null);
  const openCats = ref<Set<string>>(new Set());

  const resolveItemRemaining = options.getItemRemaining ?? defaultGetItemRemaining<TOption>;
  const resolveCategoryLabel = options.normalizeCategoryLabel ?? defaultNormalizeCategoryLabel;
  const categoryOrder = options.categoryOrder ?? DEFAULT_CATEGORY_ORDER;

  const pickerCategories = computed((): Array<OrderItemPickerCategory<TOption>> => {
    const categories = new Map<string, Map<string, Omit<OrderItemPickerGroup<TOption>, "remaining">>>();

    for (const option of options.menuOptions.value) {
      const categoryName = resolveCategoryLabel(option.menuItem?.category?.name ?? "Khác");
      if (!categories.has(categoryName)) {
        categories.set(categoryName, new Map());
      }

      const pool = option.stockLinks?.[0]?.stockPool;
      const label = String(pool?.label || "Khác").trim() || "Khác";
      const poolId = pool?.id ?? null;
      const groupKey = `${categoryName}::${label}::${poolId ?? "none"}`;
      const groups = categories.get(categoryName)!;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { key: groupKey, label, poolId, items: [] });
      }

      groups.get(groupKey)!.items.push(option);
    }

    const groupedCategories = Array.from(categories.entries()).map(([name, groups]) => ({
      name,
      groups: Array.from(groups.values()).map((group) => ({
        ...group,
        remaining: group.items.length > 0 ? resolveItemRemaining(group.items[0]) : null,
      })),
    }));

    return groupedCategories.sort((left, right) => {
      const leftRank = categoryOrder.indexOf(left.name);
      const rightRank = categoryOrder.indexOf(right.name);

      if (leftRank !== rightRank) {
        return (leftRank === -1 ? categoryOrder.length : leftRank) - (rightRank === -1 ? categoryOrder.length : rightRank);
      }

      return left.name.localeCompare(right.name, "vi");
    });
  });

  const selectedGroup = computed((): OrderItemPickerGroup<TOption> | null => {
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

  function flashItem(key: string) {
    highlightedKey.value = key;
    window.setTimeout(() => {
      if (highlightedKey.value === key) {
        highlightedKey.value = null;
      }
    }, 1200);
  }

  function setItemNote(index: number, note: string) {
    options.ensureDraft();
    const item = options.draft.value?.[index];
    if (!item) return;
    options.draft.value![index] = {
      ...item,
      note,
    };
  }

  function toggleItemNoteChip(index: number, chip: string) {
    const item = options.editableItems.value[index];
    if (!item) return;
    setItemNote(index, toggleNoteChip(item.note || "", chip));
  }

  function isItemNoteEditorOpen(key: string) {
    return openItemNoteKeys.value.has(key);
  }

  function toggleItemNoteEditor(key: string) {
    const next = new Set(openItemNoteKeys.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    openItemNoteKeys.value = next;
  }

  function openItemNoteEditor(key: string) {
    const next = new Set(openItemNoteKeys.value);
    next.add(key);
    openItemNoteKeys.value = next;
  }

  function syncOpenItemNoteKeys(items: TDraftItem[]) {
    const validKeys = new Set(items.map((item) => item.key));
    openItemNoteKeys.value = new Set(
      Array.from(openItemNoteKeys.value).filter((key) => validKeys.has(key))
    );
  }

  function resetLineEditorState() {
    highlightedKey.value = null;
    openItemNoteKeys.value = new Set();
    removeDialog.visible = false;
    removeDialog.index = -1;
    removeDialog.itemName = "";
  }

  function changeQty(index: number, delta: number) {
    options.ensureDraft();
    const item = options.draft.value?.[index];
    if (!item) return;

    const nextQuantity = item.quantity + delta;
    if (nextQuantity <= 0) {
      removeDialog.visible = true;
      removeDialog.index = index;
      removeDialog.itemName = item.itemNameSnapshot;
      return;
    }

    options.draft.value![index] = options.updateQuantity(item, nextQuantity);
  }

  function confirmRemove() {
    if (options.draft.value && removeDialog.index >= 0) {
      options.draft.value = options.draft.value.filter((_, index) => index !== removeDialog.index);
    }

    removeDialog.visible = false;
    removeDialog.index = -1;
    removeDialog.itemName = "";
  }

  function openAddPicker() {
    addPickerOpen.value = true;
    multiSelectMode.value = false;
  }

  function closeAddPicker() {
    addPickerOpen.value = false;
    multiSelectMode.value = false;
    selectedGroupKey.value = null;
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
      next.add(name);
    }
    openCats.value = next;
  }

  function handleSelectGroup(key: string) {
    selectedGroupKey.value = selectedGroupKey.value === key ? null : key;
  }

  function canSelectItem(item: TOption) {
    const remaining = resolveItemRemaining(item);
    return Boolean(item.isAvailable) && remaining !== 0;
  }

  function methodLabel(item: TOption, ingredientLabel: string) {
    return defaultMethodLabel(item, ingredientLabel);
  }

  function addMenuItem(option: TOption) {
    if (!canSelectItem(option)) return;

    options.ensureDraft();
    const items = options.draft.value;
    if (!items) return;

    const existingIndex = options.findExistingDraftIndex(items, option);
    if (existingIndex >= 0) {
      const nextItem = options.buildUpdatedDraftItem(items[existingIndex], option);
      items[existingIndex] = nextItem;
      options.onItemAdded?.(options.getDraftItemKey(nextItem));
    } else {
      const nextItem = options.buildNewDraftItem(option);
      items.push(nextItem);
      options.onItemAdded?.(options.getDraftItemKey(nextItem));
    }

    if (!multiSelectMode.value) {
      closeAddPicker();
    }
  }

  watch(
    pickerCategories,
    (categories) => {
      const nextOpenCats = new Set(
        [...openCats.value].filter((name) => categories.some((category) => category.name === name))
      );

      for (const category of categories) {
        nextOpenCats.add(category.name);
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

  return {
    addPickerOpen,
    multiSelectMode,
    selectedGroupKey,
    openCats,
    pickerCategories,
    selectedGroup,
    pickerIngredientItems,
    pickerBuckets,
    openAddPicker,
    closeAddPicker,
    toggleCat,
    handleSelectGroup,
    canSelectItem,
    methodLabel,
    addMenuItem,
    highlightedKey,
    removeDialog,
    flashItem,
    toggleItemNoteChip,
    isItemNoteEditorOpen,
    toggleItemNoteEditor,
    openItemNoteEditor,
    syncOpenItemNoteKeys,
    resetLineEditorState,
    changeQty,
    confirmRemove,
  };
}
