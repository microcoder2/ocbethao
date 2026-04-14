import { reactive, ref, type ComputedRef, type Ref } from "vue";
import { toggleNoteChip } from "../utils/noteChips";

type DraftLineItem = {
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

type UseOrderDraftLineEditorOptions<TItem extends DraftLineItem> = {
  draft: Ref<TItem[] | null>;
  editableItems: ComputedRef<TItem[]>;
  ensureDraft: () => void;
  updateQuantity: (item: TItem, nextQuantity: number) => TItem;
};

export function formatOrderGuestCountDraft(value?: number | null) {
  const next = Number(value || 0);
  return next > 0 ? String(next) : "";
}

export function parseOrderGuestCountDraft(value: string) {
  const next = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(next) && next > 0 ? next : null;
}

export function buildOrderSaveItemsPayload<TItem extends DraftLineItem>(items: TItem[]): SavePayload[] {
  return items.map((item) => ({
    menuItemId: item.menuItemId ?? undefined,
    quantity: item.quantity,
    note: item.note || undefined,
  }));
}

export function useOrderDraftLineEditor<TItem extends DraftLineItem>(
  options: UseOrderDraftLineEditorOptions<TItem>
) {
  const highlightedKey = ref<string | null>(null);
  const openItemNoteKeys = ref<Set<string>>(new Set());
  const removeDialog = reactive({
    visible: false,
    index: -1,
    itemName: "",
  });

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

  function syncOpenItemNoteKeys(items: TItem[]) {
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

  return {
    highlightedKey,
    openItemNoteKeys,
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
