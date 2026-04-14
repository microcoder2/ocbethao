<template>
  <div class="mi2-page">
    <section class="mi2-toolbar">
      <div class="mi2-toolbar-title-row">
        <div class="mi2-title">Ngân hàng món</div>
        <div class="mi2-toolbar-actions">
          <RouterLink
            class="mi2-mode-btn mi2-mode-btn--icon"
            to="/admin/menu-items/classic"
            title="Giao diện máy tính"
            aria-label="Giao diện máy tính"
          >
            <i class="bi bi-display"></i>
          </RouterLink>
          <button
            class="mi2-mode-btn mi2-mode-btn--icon"
            type="button"
            title="Tải lại"
            aria-label="Tải lại"
            @click="reloadPage"
          >
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button
            class="mi2-mode-btn mi2-mode-btn--icon mi2-mode-btn--primary"
            type="button"
            title="Thêm món"
            aria-label="Thêm món"
            @click="openClassicAddModal"
          >
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>

      <div class="mi2-toolbar-row">
        <select v-model="groupMode" class="mi2-select">
          <option value="ingredient">Nhóm theo nguyên liệu</option>
          <option value="method">Nhóm theo cách chế biến</option>
        </select>
        <button class="mi2-mode-btn mi2-mode-btn--toggle" type="button" @click="toggleShowAllIngredients">
          <i :class="['bi', showAllIngredients ? 'bi-grid-3x3-gap-fill' : 'bi-funnel-fill']"></i>
          {{ showAllIngredients ? "Hiện hết" : "Đang lọc" }}
        </button>
      </div>

      <div v-if="showAllIngredients" class="mi2-search-wrap">
        <i class="bi bi-search mi2-search-icon"></i>
        <input
          v-model="search"
          class="mi2-search"
          :placeholder="`Tìm món, nguyên liệu... (${filteredItems.length} món)`"
          autocomplete="off"
        />
      </div>
    </section>

    <MenuIngredientFilterCard
      :buckets="ingredientBuckets"
      :open-bucket-names="Array.from(openBuckets)"
      :selected-key="selectedGroupKey"
      @toggle-bucket="toggleBucket"
      @select-group="selectIngredientGroup"
    />

    <section class="mi2-groups">
      <MenuItemGroupCard
        v-for="group in visibleGroups"
        :key="group.key"
        :group="group"
        :open="openCards.has(group.key)"
        :delete-confirm-id="deleteConfirmId"
        @toggle-collapse="toggleCard(group.key)"
        @open-add="openAddMethodModal(group)"
        @edit-price="openPriceEditModal"
        @delete-item="openDeleteConfirm"
        @confirm-delete="confirmDeleteMenuItem"
        @cancel-delete="closeDeleteConfirm"
      />
    </section>

    <MenuItemCreateMethodModal
      :open="addMethodModal.open"
      :group-label="addMethodModal.group?.label || ''"
      :method-id="addMethodModal.methodId"
      :price-text="addMethodModal.priceText"
      :preview-name="addMethodPreviewName"
      :saving="addMethodSaving"
      :methods="addMethodOptions"
      @close="closeAddMethodModal"
      @submit="createMethodItem"
      @update:method-id="(value) => (addMethodModal.methodId = value)"
      @update:price-text="(value) => (addMethodModal.priceText = value)"
    />

    <MenuItemFormModal
      :open="menuModal.open"
      :is-edit="menuModal.isEdit"
      :form="menuModal.form"
      :categories="categories"
      :ingredients="ingredients"
      :units="units.items.value"
      :cooking-methods="cookingMethods.items.value"
      :selected-ing-unit="selectedIngUnit"
      :saving="menuModal.saving"
      :uploading="menuModal.uploading"
      :can-submit="canSubmitMenuModal"
      :error-message="menuModal.errorMessage"
      :blank-ingredient-svg="blankIngredientSvg"
      :resolve-img="resolveImg"
      @close="closeClassicAddModal"
      @save="saveClassicAddModal"
      @image-crop="onClassicImageCrop"
    />

    <MenuItemPriceEditModal
      :open="priceEditModal.open"
      :item-name="priceEditModal.item?.name || ''"
      :current-price="priceEditModal.item?.currentPrice || 0"
      :price-text="priceEditModal.priceText"
      :saving="priceEditModal.saving"
      @close="closePriceEditModal"
      @submit="savePriceEditModal"
      @update:price-text="(value) => (priceEditModal.priceText = value)"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import MenuIngredientFilterCard from "../../components/common/MenuIngredientFilterCard.vue";
import MenuItemCreateMethodModal from "../../components/admin/MenuItemCreateMethodModal.vue";
import MenuItemFormModal from "../../components/admin/MenuItemFormModal.vue";
import MenuItemPriceEditModal from "../../components/admin/MenuItemPriceEditModal.vue";
import MenuItemGroupCard from "../../components/admin/MenuItemGroupCard.vue";
import { api } from "../../api";
import { API_BASE_URL } from "../../config";
import blankIngredientSvg from "../../assets/blank_ingredient.svg?raw";
import { DEFAULT_COOKING_METHODS, DEFAULT_MENU_ITEM_UNITS } from "../../constants/menuItemFormOptions";

type Category = { id: number; name: string };
type Ingredient = { id: number; name: string; unit?: string; slug?: string };
type IngredientPreset = { ingredientId: number; consumeQuantity: number; note?: string | null; ingredient?: Ingredient | null };
type MenuItem = {
  id: number;
  name: string;
  slug: string;
  currentPrice: number;
  status: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
  spicyLevel?: number;
  preparationTimeMin?: number;
  isFeatured?: boolean;
  isAvailable?: boolean;
  category?: Category | null;
  ingredientPresets?: IngredientPreset[];
};
type MethodInfo = { id: string; name: string; count: number };
type EnrichedItem = MenuItem & {
  ingredientId: number | null;
  ingredientName: string;
  categoryName: string;
  methodId: string;
  methodName: string;
};
type IngredientGroup = {
  key: string;
  label: string;
  ingredientId: number | null;
  categoryName: string;
  items: EnrichedItem[];
  methods: MethodInfo[];
};
type DisplayGroup = {
  key: string;
  label: string;
  meta: string;
  items: EnrichedItem[];
  ingredientId: number | null;
  groupKind: "ingredient" | "method";
  categoryId: number | null;
};

type LocalOption = { id: string; name: string };

function makeLocalList(storageKey: string, defaults: LocalOption[]) {
  const stored = localStorage.getItem(storageKey);
  const data: LocalOption[] = stored ? JSON.parse(stored) : defaults.map((item) => ({ ...item }));
  const items = ref(data);

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(items.value));
  }

  return { items, persist };
}

const categories = ref<Category[]>([]);
const ingredients = ref<Ingredient[]>([]);
const items = ref<MenuItem[]>([]);
const loading = ref(false);
const addMethodSaving = ref(false);
const cookingMethods = makeLocalList("oc_cooking_methods_v2", DEFAULT_COOKING_METHODS);
const units = makeLocalList("oc_units_v2", DEFAULT_MENU_ITEM_UNITS);
const search = ref("");
const groupMode = ref<"ingredient" | "method">("ingredient");
const selectedGroupKey = ref<string | null>(null);
const showAllIngredients = ref(true);
const openBuckets = ref<Set<string>>(new Set());
const openCards = ref<Set<string>>(new Set());
const initializedGroupModes = ref<Set<"ingredient" | "method">>(new Set());
const menuModal = reactive<{
  open: boolean;
  isEdit: boolean;
  saving: boolean;
  uploading: boolean;
  errorMessage: string;
  originalImageUrl: string;
  form: {
    id: number | null;
    name: string;
    slug: string;
    description: string;
    currentPrice: number;
    categoryId: number;
    unit: string;
    spicyLevel: number;
    preparationTimeMin: number;
    status: string;
    isAvailable: boolean;
    isFeatured: boolean;
    imageUrl: string;
    ingredientId: number;
    consumeQuantity: number;
    consumeQuantityNote: string;
    cookingMethod: string;
  };
}>({
  open: false,
  isEdit: false,
  saving: false,
  uploading: false,
  errorMessage: "",
  originalImageUrl: "",
  form: {
    id: null,
    name: "",
    slug: "",
    description: "",
    currentPrice: "",
    categoryId: 0,
    unit: "",
    spicyLevel: 0,
    preparationTimeMin: "",
    status: "",
    isAvailable: true,
    isFeatured: false,
    imageUrl: "",
    ingredientId: 0,
    consumeQuantity: "",
    consumeQuantityNote: "",
    cookingMethod: "",
  },
});
const priceEditModal = reactive<{
  open: boolean;
  item: EnrichedItem | null;
  priceText: string;
  saving: boolean;
}>({
  open: false,
  item: null,
  priceText: "0",
  saving: false,
});

const deleteConfirmModal = reactive<{
  open: boolean;
  item: EnrichedItem | null;
}>({
  open: false,
  item: null,
});
const deleteConfirmId = computed(() => (deleteConfirmModal.open ? deleteConfirmModal.item?.id ?? null : null));

const addMethodModal = reactive<{
  open: boolean;
  group: DisplayGroup | null;
  methodId: string;
  priceText: string;
}>({
  open: false,
  group: null,
  methodId: "",
  priceText: "0",
});

const normalizedMethods = [...DEFAULT_COOKING_METHODS].sort((a, b) => b.name.length - a.name.length);

function resolveMethod(item: MenuItem) {
  const lowerName = item.name.toLowerCase();
  const lowerSlug = item.slug.toLowerCase();
  const match = normalizedMethods.find((method) => lowerSlug.includes(method.id) || lowerName.includes(method.name.toLowerCase()));
  return match || { id: "khac", name: "Khác" };
}

function stripVietnameseMarks(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const filteredItems = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return items.value;
  return items.value.filter((item) => {
    const ing = item.ingredientPresets?.[0]?.ingredient?.name || "";
    return [item.name, item.slug, ing].join(" ").toLowerCase().includes(keyword);
  });
});

const enrichedItems = computed<EnrichedItem[]>(() =>
  filteredItems.value.map((item) => {
    const preset = item.ingredientPresets?.[0];
    const method = resolveMethod(item);
    return {
      ...item,
      ingredientId: preset?.ingredientId ?? null,
      ingredientName: preset?.ingredient?.name || "Chưa gắn nguyên liệu",
      categoryName: item.category?.name || "Khác",
      methodId: method.id,
      methodName: method.name,
    };
  })
);

function normalizeBucketName(name: string) {
  const normalized = stripVietnameseMarks(name).toLowerCase();
  if (normalized.includes("hai manh")) return "Hai mảnh";
  if (normalized.includes("oc")) return "Ốc";
  return "Khác";
}

const BUCKET_ORDER = ["Hai mảnh", "Ốc", "Khác"];

const ingredientGroups = computed<IngredientGroup[]>(() => {
  const map = new Map<string, IngredientGroup>();
  for (const item of enrichedItems.value) {
    const key = item.ingredientId != null ? `ingredient:${item.ingredientId}` : `fallback:${item.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: item.ingredientName,
        ingredientId: item.ingredientId,
        categoryName: normalizeBucketName(item.categoryName),
        items: [],
        methods: [],
      });
    }
    map.get(key)!.items.push(item);
  }

  for (const group of map.values()) {
    const methodMap = new Map<string, MethodInfo>();
    for (const item of group.items) {
      const current = methodMap.get(item.methodId);
      if (current) current.count += 1;
      else methodMap.set(item.methodId, { id: item.methodId, name: item.methodName, count: 1 });
    }
    group.methods = Array.from(methodMap.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
    group.items.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
});

const ingredientBuckets = computed(() => {
  const buckets = new Map<string, IngredientGroup[]>();
  for (const group of ingredientGroups.value) {
    const bucket = group.categoryName || "Khác";
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(group);
  }
  return Array.from(buckets.entries())
    .map(([name, groups]) => ({
      name,
      groups: groups.sort((a, b) => a.label.localeCompare(b.label, "vi")),
    }))
    .sort((left, right) => {
      const leftRank = BUCKET_ORDER.indexOf(left.name);
      const rightRank = BUCKET_ORDER.indexOf(right.name);

      if (leftRank !== rightRank) {
        return (leftRank === -1 ? BUCKET_ORDER.length : leftRank) - (rightRank === -1 ? BUCKET_ORDER.length : rightRank);
      }

      return left.name.localeCompare(right.name, "vi");
    });
});

const displayGroups = computed<DisplayGroup[]>(() => {
  if (groupMode.value === "ingredient") {
    return ingredientGroups.value.map((group) => ({
      key: group.key,
      label: group.label,
      meta: `${group.methods.length} kiểu`,
      items: group.items,
      ingredientId: group.ingredientId,
      groupKind: "ingredient" as const,
      categoryId: group.items[0]?.category?.id ?? null,
    }));
  }

  const map = new Map<string, DisplayGroup>();
  for (const item of enrichedItems.value) {
    const key = `method:${item.methodId}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: item.methodName,
        meta: "",
        items: [],
        ingredientId: null,
        groupKind: "method",
        categoryId: null,
      });
    }
    map.get(key)!.items.push(item);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      meta: `${group.items.length} món`,
      items: [...group.items].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
});

const visibleGroups = computed(() => {
  if (groupMode.value !== "ingredient") return displayGroups.value;
  if (showAllIngredients.value) return displayGroups.value;
  if (selectedGroupKey.value == null) return [];
  return displayGroups.value.filter((group) => group.key === selectedGroupKey.value);
});

watch(displayGroups, (groups) => {
  if (!groups.length) {
    openCards.value = new Set();
    return;
  }

  if (!initializedGroupModes.value.has(groupMode.value)) {
    openCards.value = new Set(groups.map((group) => group.key));
    initializedGroupModes.value = new Set(initializedGroupModes.value).add(groupMode.value);
    return;
  }
  const next = new Set<string>();
  for (const group of groups) {
    if (openCards.value.has(group.key)) next.add(group.key);
  }
  openCards.value = next;
}, { immediate: true });

watch(ingredientBuckets, (buckets) => {
  const next = new Set<string>();
  for (const bucket of buckets) {
    if (openBuckets.value.has(bucket.name)) next.add(bucket.name);
  }
  openBuckets.value = next;
}, { immediate: true });

const addMethodOptions = computed(() => DEFAULT_COOKING_METHODS);
const addMethodPreviewName = computed(() => {
  const group = addMethodModal.group;
  if (!group) return "";
  const method = DEFAULT_COOKING_METHODS.find((entry) => entry.id === addMethodModal.methodId);
  return [group.label, method?.name].filter(Boolean).join(" ");
});

const selectedIngUnit = computed(() => {
  const selected = ingredients.value.find((item) => item.id === menuModal.form.ingredientId);
  return selected?.unit || "";
});

function resolveImg(url: string) {
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

function parsePriceKInput(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return Number(digits || 0) * 1000;
}

function formatPriceKInput(value: number | null | undefined) {
  return String(Math.round(Number(value || 0) / 1000));
}

function openPriceEditModal(item: EnrichedItem) {
  priceEditModal.open = true;
  priceEditModal.item = item;
  priceEditModal.priceText = formatPriceKInput(item.currentPrice);
}

function closePriceEditModal() {
  priceEditModal.open = false;
  priceEditModal.item = null;
  priceEditModal.priceText = "0";
  priceEditModal.saving = false;
}

function openDeleteConfirm(item: EnrichedItem) {
  deleteConfirmModal.open = true;
  deleteConfirmModal.item = item;
}

function closeDeleteConfirm() {
  deleteConfirmModal.open = false;
  deleteConfirmModal.item = null;
}

function toggleBucket(bucketName: string) {
  const next = new Set(openBuckets.value);
  if (next.has(bucketName)) next.delete(bucketName);
  else next.add(bucketName);
  openBuckets.value = next;
}

function selectIngredientGroup(key: string) {
  selectedGroupKey.value = key;
  showAllIngredients.value = false;
  openCards.value = new Set([key]);
}

function toggleShowAllIngredients() {
  const nextValue = !showAllIngredients.value;
  showAllIngredients.value = nextValue;
  if (nextValue) {
    selectedGroupKey.value = null;
    openBuckets.value = new Set();
    openCards.value = new Set(displayGroups.value.map((group) => group.key));
  } else {
    selectedGroupKey.value = null;
    openBuckets.value = new Set(ingredientBuckets.value.map((bucket) => bucket.name));
    openCards.value = new Set();
  }
}

function reloadPage() {
  window.location.reload();
}

function toggleCard(key: string) {
  const next = new Set(openCards.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  openCards.value = next;
}

function buildPayload(item: EnrichedItem, nextPrice: number) {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description || "",
    currentPrice: nextPrice,
    categoryId: item.category?.id || categories.value[0]?.id,
    unit: item.unit || "phần",
    spicyLevel: item.spicyLevel || 0,
    preparationTimeMin: item.preparationTimeMin || 10,
    status: item.status,
    isAvailable: item.isAvailable ?? true,
    isFeatured: item.isFeatured ?? false,
    imageUrl: item.imageUrl || "",
    ingredientPresets: item.ingredientPresets?.map((preset, index) => ({
      ingredientId: preset.ingredientId,
      consumeQuantity: preset.consumeQuantity,
      sortOrder: index,
      note: preset.note || "",
    })) || [],
  };
}

async function savePriceEditModal() {
  const item = priceEditModal.item;
  if (!item) return;

  const rawPrice = priceEditModal.priceText.trim();
  const nextPrice = rawPrice ? parsePriceKInput(rawPrice) : item.currentPrice;
  priceEditModal.saving = true;
  try {
    await api.put(`/menu-items/${item.id}`, buildPayload(item, nextPrice));
    closePriceEditModal();
    await loadData();
  } finally {
    priceEditModal.saving = false;
  }
}

function resetClassicForm() {
  menuModal.errorMessage = "";
  Object.assign(menuModal.form, {
    id: null,
    name: "",
    slug: "",
    description: "",
    currentPrice: "",
    categoryId: 0,
    unit: "",
    spicyLevel: 0,
    preparationTimeMin: "",
    status: "",
    isAvailable: true,
    isFeatured: false,
    imageUrl: "",
    ingredientId: 0,
    consumeQuantity: "",
    consumeQuantityNote: "",
    cookingMethod: "",
  });
}

function openClassicAddModal() {
  menuModal.isEdit = false;
  menuModal.originalImageUrl = "";
  menuModal.errorMessage = "";
  resetClassicForm();
  menuModal.open = true;
}

async function closeClassicAddModal() {
  const tempUrl =
    !menuModal.uploading &&
    menuModal.form.imageUrl &&
    menuModal.form.imageUrl !== menuModal.originalImageUrl
      ? menuModal.form.imageUrl
      : "";

  menuModal.open = false;
  menuModal.uploading = false;
  menuModal.errorMessage = "";

  if (tempUrl) {
    menuModal.form.imageUrl = "";
    try {
      await api.delete("/uploads/images", { data: { url: tempUrl } });
    } catch {
      /* best-effort */
    }
  }
}

async function onClassicImageCrop(blob: Blob | null) {
  if (!blob) return;
  menuModal.uploading = true;
  try {
    const fd = new FormData();
    fd.append("file", new File([blob], "image.jpg", { type: "image/jpeg" }));
    const { data } = await api.post("/uploads/images", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    menuModal.form.imageUrl = data.url;
  } finally {
    menuModal.uploading = false;
  }
}

async function saveClassicAddModal() {
  const validation = validateMenuModal();
  if (validation) {
    menuModal.errorMessage = validation;
    return;
  }
  menuModal.saving = true;
  menuModal.errorMessage = "";
  try {
    const payload = {
      name: menuModal.form.name,
      slug: menuModal.form.slug,
      description: menuModal.form.description,
      currentPrice: Number(menuModal.form.currentPrice) || 0,
      categoryId: menuModal.form.categoryId || categories.value[0]?.id,
      unit: menuModal.form.unit,
      spicyLevel: menuModal.form.spicyLevel,
      preparationTimeMin: Number(menuModal.form.preparationTimeMin) || 0,
      status: menuModal.form.status || "ACTIVE",
      isAvailable: menuModal.form.isAvailable,
      isFeatured: menuModal.form.isFeatured,
      imageUrl: menuModal.form.imageUrl,
      ingredientPresets: menuModal.form.ingredientId > 0
        ? [{
            ingredientId: menuModal.form.ingredientId,
            consumeQuantity: parseConsumeQuantityNote(menuModal.form.consumeQuantityNote),
            sortOrder: 0,
            note: menuModal.form.consumeQuantityNote.trim() || "",
          }]
        : [],
    };

    await api.post("/menu-items", payload);
    menuModal.originalImageUrl = menuModal.form.imageUrl;
    closeClassicAddModal();
    await loadData();
  } catch (error: any) {
    menuModal.errorMessage = getApiErrorMessage(error, "Không thể lưu món");
  } finally {
    menuModal.saving = false;
  }
}

const canSubmitMenuModal = computed(() => !validateMenuModal());

function validateMenuModal() {
  if (!menuModal.form.name.trim()) return "Thiếu tên món";
  if (!menuModal.form.slug.trim()) return "Thiếu slug";
  if (!menuModal.form.categoryId) return "Thiếu nhóm món";
  if (!Number(menuModal.form.currentPrice)) return "Thiếu giá";
  if (!menuModal.form.unit.trim()) return "Thiếu đơn vị bán";
  if (!menuModal.form.ingredientId) return "Thiếu nguyên liệu chính";
  if (!menuModal.form.cookingMethod.trim()) return "Thiếu cách chế biến";
  if (!menuModal.form.status.trim()) return "Thiếu trạng thái";
  return "";
}

function getApiErrorMessage(error: any, fallback: string) {
  const raw = String(error?.response?.data?.message || error?.message || fallback);
  if (raw.includes("MenuItem_slug_key") || raw.toLowerCase().includes("slug")) {
    return "Slug đã tồn tại";
  }
  if (raw.includes("P2002")) {
    return "Dữ liệu bị trùng";
  }
  return raw.replace(/\n+/g, " ").trim() || fallback;
}

function parseConsumeQuantityNote(value: string) {
  const text = String(value || "").trim();
  if (!text) return 1;
  const match = text.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) || 1 : 1;
}

async function confirmDeleteMenuItem() {
  const item = deleteConfirmModal.item;
  if (!item) return;

  try {
    await api.delete(`/menu-items/${item.id}`);
    items.value = items.value.filter((current) => current.id !== item.id);
    deleteConfirmModal.open = false;
    deleteConfirmModal.item = null;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      `Không thể xóa món "${item.name}"`;
    window.alert(message);
  }
}

async function deleteMenuItem(item: { id: number; name: string }) {
  const ok = window.confirm(`Xóa món "${item.name}"?`);
  if (!ok) return;
  await api.delete(`/menu-items/${item.id}`);
  await loadData();
}

function openAddMethodModal(group: DisplayGroup) {
  addMethodModal.open = true;
  addMethodModal.group = group;
  addMethodModal.methodId = "";
  addMethodModal.priceText = "0";
}

function closeAddMethodModal() {
  addMethodModal.open = false;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function createMethodItem() {
  const group = addMethodModal.group;
  if (!group || !group.ingredientId || !addMethodModal.methodId) return;
  addMethodSaving.value = true;
  try {
    const method = DEFAULT_COOKING_METHODS.find((entry) => entry.id === addMethodModal.methodId);
    const name = addMethodPreviewName.value;
    await api.post("/menu-items", {
      name,
      slug: slugify(name),
      description: "",
      currentPrice: parsePriceKInput(addMethodModal.priceText),
      categoryId: group.categoryId || categories.value[0]?.id,
      unit: "ph?n",
      spicyLevel: 0,
      preparationTimeMin: 10,
      status: "ACTIVE",
      isAvailable: true,
      isFeatured: false,
      imageUrl: "",
      ingredientPresets: [{
        ingredientId: group.ingredientId,
        consumeQuantity: 1,
        sortOrder: 0,
        note: method?.name || "",
      }],
    });
    closeAddMethodModal();
    await loadData();
  } finally {
    addMethodSaving.value = false;
  }
}

async function loadData() {
  loading.value = true;
  try {
    const [categoriesRes, ingredientsRes, itemsRes] = await Promise.all([
      api.get("/categories"),
      api.get("/ingredients"),
      api.get("/menu-items"),
    ]);
    categories.value = categoriesRes.data;
    ingredients.value = ingredientsRes.data;
    items.value = itemsRes.data;
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.mi2-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: -24px -24px 0;
  padding: 0;
}

.mi2-toolbar {
  background: rgba(var(--panel-rgb), 0.94);
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  box-shadow: var(--shadow);
  padding: 8px;
}

.mi2-toolbar-title-row,
.mi2-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mi2-toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mi2-title {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mi2-mode-btn {
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
  min-height: 38px;
  border-radius: 10px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 700;
  text-decoration: none;
  transition: background .12s, border-color .12s, color .12s, box-shadow .12s;
}

.mi2-mode-btn--icon {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
}

.mi2-mode-btn--primary {
  border-color: rgba(var(--ember-rgb), 0.28);
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
}

.mi2-mode-btn--primary:hover,
.mi2-mode-btn--primary:focus-visible {
  border-color: rgba(var(--ember-rgb), 0.55);
  background: rgba(var(--ember-rgb), 0.16);
  color: var(--ember-strong);
}

.mi2-mode-btn--toggle {
  min-height: 46px;
  min-width: 116px;
  padding: 0 14px;
  border-radius: 999px;
  flex: 0 0 auto;
  white-space: nowrap;
  border-color: rgba(var(--ember-rgb), 0.44);
  background: rgba(var(--ember-rgb), 0.14);
  color: var(--ember-strong);
  box-shadow: inset 0 0 0 1px rgba(var(--ember-rgb), 0.08);
}

.mi2-mode-btn--toggle .bi {
  font-size: 0.86rem;
}

.mi2-mode-btn:hover,
.mi2-mode-btn:focus-visible {
  color: var(--text);
  outline: none;
}

.mi2-mode-btn--toggle:hover,
.mi2-mode-btn--toggle:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(var(--ember-rgb), 0.6);
  background: rgba(var(--ember-rgb), 0.2);
}

.mi2-search-wrap {
  position: relative;
  margin-top: 8px;
}

.mi2-search-icon {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: #988270;
}

.mi2-search,
.mi2-select {
  width: 100%;
  min-height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
  box-shadow: none;
}

.mi2-search {
  padding: 0 12px 0 36px;
}

.mi2-select {
  padding: 0 12px;
}

.mi2-toolbar-row {
  margin-top: 8px;
}

.mi2-toolbar-row .mi2-select {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  min-height: 46px;
  height: 46px;
  border-radius: 999px;
  padding: 0 34px 0 14px;
  font-weight: 700;
  cursor: pointer;
  appearance: none;
  border-color: rgba(var(--ember-rgb), 0.38);
  background-color: rgba(var(--ember-rgb), 0.12);
  color: var(--ember-strong);
  box-shadow: inset 0 0 0 1px rgba(var(--ember-rgb), 0.06);
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position:
    calc(100% - 18px) calc(50% - 2px),
    calc(100% - 13px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.mi2-toolbar-row .mi2-select:focus-visible {
  outline: none;
  border-color: rgba(var(--ember-rgb), 0.6);
  background-color: rgba(var(--ember-rgb), 0.18);
}

.mi2-groups {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 6px;
}

.mi-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(18, 16, 13, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.mi-modal {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.mi-modal--sm {
  max-width: 420px;
}

.mi-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  font-weight: 700;
  font-size: 1rem;
  color: var(--text);
  flex-shrink: 0;
}

.mi-modal-close {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.mi-modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mi-delete-text {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text);
}

.mi-delete-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 4px;
}

.mi-delete-icon-btn {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  color: var(--muted);
}

.mi-delete-icon-btn--ghost:hover,
.mi-delete-icon-btn--ghost:focus-visible {
  color: var(--text);
  background: rgba(0, 0, 0, 0.05);
}

.mi-delete-icon-btn--danger {
  background: rgba(var(--danger-rgb), 0.1);
  color: var(--danger);
  border-color: rgba(var(--danger-rgb), 0.24);
}

.mi-delete-icon-btn--danger:hover,
.mi-delete-icon-btn--danger:focus-visible {
  background: rgba(var(--danger-rgb), 0.18);
}

@media (min-width: 768px) {
  .mi2-page {
    gap: 12px;
  }
}

</style>






