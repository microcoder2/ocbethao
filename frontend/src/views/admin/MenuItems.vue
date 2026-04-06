<template>
  <div class="mi-shell">

    <!-- ── Header ── -->
    <div class="mi-header">
      <div class="mi-header-top">
        <div class="mi-header-title">
          <div class="mi-title">Ngân hàng món</div>
        </div>
        <div class="mi-header-btns">
          <button class="mi-icon-btn" :class="{ 'mi-icon-btn--spin': loading }" title="Làm mới" @click="loadData">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="mi-icon-btn mi-icon-btn--primary" title="Thêm món mới" @click="openAdd">
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>
      <div class="mi-header-filters">
        <div class="mi-search-wrap">
          <i class="bi bi-search mi-search-icon"></i>
          <input
            v-model="search"
            class="mi-search"
            :placeholder="searchPlaceholder"
            autocomplete="off"
          />
        </div>
        <select v-model.number="filterCategoryId" class="mi-filter-select">
          <option :value="0">Tất cả nhóm</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>

    <!-- ── Table ── -->
    <div class="mi-list-card">

      <DataTable
        :columns="tableColumns"
        :items="pagedItems"
        row-key="id"
        :loading="loading"
        empty-text="Không tìm thấy món nào."
        responsive-class="mi-table-wrap"
        table-class="mi-table"
        header-cell-class="mi-th"
        body-row-class="mi-row"
        body-cell-class="mi-td"
        action-header-class="mi-th mi-th--actions"
        action-cell-class="mi-td mi-td--actions"
        empty-cell-class="mi-td mi-td--center"
      >
        <template #cell-image="{ row }">
          <div class="mi-table-thumbcell">
            <img
              v-if="row.imageUrl && !failedImgs[row.id]"
              :src="resolveImg(row.imageUrl)"
              class="mi-thumb"
              @error="failedImgs[row.id] = true"
            />
            <div v-else class="mi-thumb mi-thumb--blank" v-html="blankIngredientSvg"></div>
          </div>
        </template>

        <template #cell-name="{ row }">
          <div class="mi-table-namecell">
            <div class="mi-name">{{ row.name }}</div>
            <div class="mi-slug">{{ row.slug }}</div>
            <div class="mi-mobile-meta">
              <span v-if="row.category" class="mi-badge">{{ row.category.name }}</span>
              <span class="mi-status" :class="`mi-status--${(row.status || '').toLowerCase()}`">
                {{ row.status }}
              </span>
            </div>
          </div>
        </template>

        <template #cell-category="{ row }">
          <span v-if="row.category" class="mi-badge">{{ row.category.name }}</span>
          <span v-else class="mi-muted">—</span>
        </template>

        <template #cell-ingredient="{ row }">
          <template v-if="row.ingredientPresets?.[0]">
            <div class="mi-name">{{ row.ingredientPresets[0].ingredient?.name }}</div>
            <div class="mi-slug">
              {{ row.ingredientPresets[0].consumeQuantity }}
              {{ row.ingredientPresets[0].ingredient?.unit }}
            </div>
          </template>
          <span v-else class="mi-muted">—</span>
        </template>

        <template #cell-currentPrice="{ row }">
          <div class="mi-price-cell">
            <span class="mi-price-full">{{ formatMoney(row.currentPrice) }}</span>
            <span class="mi-price-short">{{ formatMoneyShort(row.currentPrice) }}</span>
          </div>
        </template>

        <template #cell-status="{ row }">
          <span class="mi-status" :class="`mi-status--${(row.status || '').toLowerCase()}`">
            {{ row.status }}
          </span>
        </template>

        <template #row-actions="{ row }">
          <div v-if="deleteConfirmId === row.id" class="mi-row-confirm">
            <button class="mi-row-btn mi-row-btn--yes" title="Xác nhận xóa" @click="confirmDelete(row)">
              <i class="bi bi-check-lg"></i>
            </button>
            <button class="mi-row-btn mi-row-btn--no" title="Hủy" @click="deleteConfirmId = null">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div v-else class="mi-row-actions">
            <button class="mi-row-btn" title="Xem" @click="openView(row)">
              <i class="bi bi-eye"></i>
            </button>
            <button class="mi-row-btn" title="Sửa" @click="openEdit(row)">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="mi-row-btn mi-row-btn--del" title="Xóa" @click="deleteConfirmId = row.id">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </template>
      </DataTable>

      <div class="mi-pagination-wrap">
        <AppPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="filteredItems.length"
          :disabled="loading"
          :page-size-options="[10, 20, 30, 50]"
        />
      </div>
    </div>

  </div>

  <!-- ── CropDialog (outside main container, always mounted) ── -->
  <CropDialog :file="cropFile" @done="onCropDone" />

  <!-- ── Add / Edit Modal ── -->
  <Teleport to="body">
    <Transition name="mi-fade">
      <div v-if="modal.open" class="mi-backdrop" @click.self="cancelModal">
        <div class="mi-modal">
          <div class="mi-modal-header">
            <span>{{ modal.isEdit ? `Sửa: ${modal.form.name || '—'}` : 'Thêm món mẫu mới' }}</span>
            <button class="mi-modal-close" @click="cancelModal"><i class="bi bi-x-lg"></i></button>
          </div>

          <div class="mi-modal-body">

            <!-- ── image upload via CropDialog ── -->
            <div class="mi-img-wrap" @click="imgRef?.click()">
              <img v-if="modal.form.imageUrl && !modalImgFailed" :src="resolveImg(modal.form.imageUrl)" class="mi-img-preview" @error="modalImgFailed = true" />
              <div v-else class="mi-img-preview mi-img-preview--blank" v-html="blankIngredientSvg"></div>
              <div class="mi-img-overlay">
                <i v-if="modal.uploading" class="bi bi-hourglass-split"></i>
                <i v-else class="bi bi-camera-fill"></i>
              </div>
              <input ref="imgRef" type="file" accept="image/*" hidden @change="onImgFileChange" />
            </div>

            <!-- ── ingredient + cooking method ── -->
            <div class="mi-row2">
              <div class="mi-field">
                <label class="mi-label">Nguyên liệu chính</label>
                <select v-model.number="modal.form.ingredientId" class="mi-select" @change="autoFillName">
                  <option :value="0">— chọn nguyên liệu —</option>
                  <option v-for="ing in ingredients" :key="ing.id" :value="ing.id">{{ ing.name }}</option>
                </select>
              </div>
              <div class="mi-field">
                <label class="mi-label">Cách chế biến</label>
                <div class="mi-select-group">
                  <select v-model="modal.form.cookingMethod" class="mi-select" @change="autoFillName">
                    <option value="">— chọn —</option>
                    <option v-for="m in cookingMethods.items.value" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <button class="mi-manage-btn" title="Quản lý cách chế biến" @click.stop="managing = 'cookingMethod'">
                    <i class="bi bi-sliders"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- ── name + slug ── -->
            <div class="mi-row2">
              <div class="mi-field mi-field--grow">
                <label class="mi-label">Tên món</label>
                <input
                  v-model="modal.form.name"
                  class="mi-input"
                  placeholder="Vd: Sò huyết xào bơ"
                  @input="autoSlug"
                />
              </div>
              <div class="mi-field">
                <label class="mi-label">Slug</label>
                <input v-model="modal.form.slug" class="mi-input mi-input--mono" placeholder="so-huyet-xao-bo" />
              </div>
            </div>

            <!-- ── category + price ── -->
            <div class="mi-row2">
              <div class="mi-field">
                <label class="mi-label">Nhóm món</label>
                <div class="mi-select-group">
                  <select v-model.number="modal.form.categoryId" class="mi-select">
                    <option :value="0">— chọn nhóm —</option>
                    <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                  <button class="mi-manage-btn" title="Quản lý nhóm món" @click.stop="managing = 'category'">
                    <i class="bi bi-sliders"></i>
                  </button>
                </div>
              </div>
              <div class="mi-field">
                <label class="mi-label">Giá hiện hành (đ)</label>
                <input v-model.number="modal.form.currentPrice" class="mi-input" type="number" min="0" step="1000" />
              </div>
            </div>

            <!-- ── unit + time ── -->
            <div class="mi-row2">
              <div class="mi-field">
                <label class="mi-label">Đơn vị bán</label>
                <div class="mi-select-group">
                  <select v-model="modal.form.unit" class="mi-select">
                    <option v-for="u in units.items.value" :key="u.id" :value="u.name">{{ u.name }}</option>
                  </select>
                  <button class="mi-manage-btn" title="Quản lý đơn vị" @click.stop="managing = 'unit'">
                    <i class="bi bi-sliders"></i>
                  </button>
                </div>
              </div>
              <div class="mi-field">
                <label class="mi-label">Chuẩn bị (phút)</label>
                <input v-model.number="modal.form.preparationTimeMin" class="mi-input" type="number" min="0" />
              </div>
            </div>

            <!-- ── qty (only if ingredient selected) ── -->
            <div v-if="modal.form.ingredientId > 0" class="mi-field">
              <label class="mi-label">
                Định lượng mặc định{{ selectedIngUnit ? ` (${selectedIngUnit})` : '' }}
              </label>
              <input
                v-model.number="modal.form.consumeQuantity"
                class="mi-input mi-input--sm"
                type="number"
                min="0"
                step="0.25"
              />
            </div>

            <!-- ── description ── -->
            <div class="mi-field">
              <label class="mi-label">Mô tả</label>
              <textarea
                v-model="modal.form.description"
                class="mi-input mi-textarea"
                rows="2"
                placeholder="Hương vị, cách phục vụ, ghi chú..."
              ></textarea>
            </div>

            <!-- ── status + flags ── -->
            <div class="mi-row-flags">
              <div class="mi-field">
                <label class="mi-label">Trạng thái</label>
                <select v-model="modal.form.status" class="mi-select">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <label class="mi-checkbox-label">
                <input v-model="modal.form.isAvailable" type="checkbox" />
                <span>Khả dụng</span>
              </label>
              <label class="mi-checkbox-label">
                <input v-model="modal.form.isFeatured" type="checkbox" />
                <span>Nổi bật ⭐</span>
              </label>
            </div>

          </div>

          <div class="mi-modal-footer">
            <button class="mi-btn mi-btn--ghost" @click="cancelModal">Hủy</button>
            <button
              class="mi-btn mi-btn--save btn-ember"
              :disabled="modal.saving || !modal.form.name.trim()"
              @click="saveItem"
            >
              <i v-if="modal.saving" class="bi bi-hourglass-split"></i>
              <span v-else>{{ modal.isEdit ? 'Cập nhật' : 'Tạo món' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── View Modal ── -->
  <Teleport to="body">
    <Transition name="mi-fade">
      <div v-if="viewModal.open" class="mi-backdrop" @click.self="viewModal.open = false">
        <div class="mi-modal mi-modal--sm">
          <div class="mi-modal-header">
            <span>{{ viewModal.item?.name }}</span>
            <button class="mi-modal-close" @click="viewModal.open = false">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div v-if="viewModal.item" class="mi-modal-body">
            <img v-if="viewModal.item.imageUrl && !viewImgFailed" :src="resolveImg(viewModal.item.imageUrl)" class="mi-view-img" @error="viewImgFailed = true" />
            <div v-else class="mi-view-img mi-view-img--blank" v-html="blankIngredientSvg"></div>
            <dl class="mi-view-dl">
              <dt>Nhóm</dt>
              <dd>{{ viewModal.item.category?.name || '—' }}</dd>
              <dt>Giá hiện hành</dt>
              <dd>{{ formatMoney(viewModal.item.currentPrice) }}</dd>
              <dt>Đơn vị</dt>
              <dd>{{ viewModal.item.unit }}</dd>
              <dt>Trạng thái</dt>
              <dd>
                <span
                  class="mi-status"
                  :class="`mi-status--${(viewModal.item.status || '').toLowerCase()}`"
                >{{ viewModal.item.status }}</span>
              </dd>
              <template v-if="viewModal.item.ingredientPresets?.[0]">
                <dt>Nguyên liệu</dt>
                <dd>
                  {{ viewModal.item.ingredientPresets[0].ingredient?.name }}
                  — {{ viewModal.item.ingredientPresets[0].consumeQuantity }}
                  {{ viewModal.item.ingredientPresets[0].ingredient?.unit }}
                </dd>
              </template>
              <template v-if="viewModal.item.description">
                <dt>Mô tả</dt>
                <dd>{{ viewModal.item.description }}</dd>
              </template>
            </dl>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── QuickListManager ── -->
  <QuickListManager
    v-if="managing"
    :title="activeManager.title"
    :items="activeManager.items"
    :fields="activeManager.fields"
    :allow-add="activeManager.allowAdd"
    :allow-delete="activeManager.allowDelete"
    :busy="activeManager.busy"
    @add="onManagerAdd"
    @update="onManagerUpdate"
    @remove="onManagerRemove"
    @close="managing = null"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from "vue";
import { api } from "../../api";
import { formatMoney, formatMoneyShort } from "../../utils/format";
import { API_BASE_URL } from "../../config";
import blankIngredientSvg from "../../assets/blank_ingredient.svg?raw";
import CropDialog from "../../components/admin/CropDialog.vue";
import QuickListManager from "../../components/admin/QuickListManager.vue";
import DataTable from "../../components/common/DataTable.vue";
import AppPagination from "../../components/common/Pagination.vue";
import {
  DEFAULT_COOKING_METHODS,
  DEFAULT_MENU_ITEM_UNITS,
  type LocalOption,
} from "../../constants/menuItemFormOptions";

type FieldDef = { key: string; label: string; type?: "text" | "number" | "checkbox"; placeholder?: string };
type ListItem  = { id: string | number; [key: string]: any };

// ── types ──────────────────────────────────────────────────────────────
type Category   = { id: number; name: string; slug: string; sortOrder: number; isActive: boolean };
type Ingredient = { id: number; name: string; slug: string; unit: string };
type MenuItem   = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  currentPrice: number;
  status: string;
  unit: string;
  isFeatured: boolean;
  isAvailable: boolean;
  imageUrl?: string | null;
  category?: Category;
  ingredientPresets?: {
    consumeQuantity: number;
    ingredientId?: number;
    ingredient?: Ingredient;
  }[];
};

// ── local list helper ──────────────────────────────────────────────────
function makeLocalList(storageKey: string, defaults: LocalOption[]) {
  const stored = localStorage.getItem(storageKey);
  const data: LocalOption[] = stored
    ? JSON.parse(stored)
    : defaults.map((item) => ({ ...item }));
  const items = ref(data);

  function persist() { localStorage.setItem(storageKey, JSON.stringify(items.value)); }

  function add(name: string) {
    items.value.push({ id: Date.now().toString(), name });
    persist();
  }
  function update(id: string | number, name: string) {
    const item = items.value.find(i => i.id === String(id));
    if (item) { item.name = name; persist(); }
  }
  function remove(id: string | number) {
    items.value = items.value.filter(i => i.id !== String(id));
    persist();
  }
  return { items, add, update, remove };
}

// ── local lists ────────────────────────────────────────────────────────
const cookingMethods = makeLocalList("oc_cooking_methods_v2", DEFAULT_COOKING_METHODS);

const units = makeLocalList("oc_units_v2", DEFAULT_MENU_ITEM_UNITS);


// ── db state ───────────────────────────────────────────────────────────
const categories  = ref<Category[]>([]);
const ingredients = ref<Ingredient[]>([]);
const items       = ref<MenuItem[]>([]);
const loading     = ref(false);
const search      = ref("");
const filterCategoryId = ref(0);
const deleteConfirmId  = ref<number | null>(null);
const page        = ref(1);
const pageSize    = ref(10);

const tableColumns = [
  {
    key: "image",
    title: "",
    thClass: "mi-th--img mi-col-image",
    tdClass: "mi-td--img mi-col-image",
  },
  { key: "name", title: "Tên món", thClass: "mi-col-name", tdClass: "mi-col-name" },
  { key: "category", title: "Nhóm", thClass: "mi-col-nhom", tdClass: "mi-col-nhom" },
  { key: "ingredient", title: "Nguyên liệu", thClass: "mi-col-ing", tdClass: "mi-col-ing" },
  {
    key: "currentPrice",
    title: "Giá hiện hành",
    thClass: "mi-th--right text-end mi-col-price",
    tdClass: "mi-td--right text-end mi-col-price",
  },
  { key: "status", title: "Trạng thái", thClass: "mi-col-status", tdClass: "mi-col-status" },
];

// ── image upload via CropDialog ────────────────────────────────────────
const imgRef  = ref<HTMLInputElement | null>(null);
const cropFile = ref<File | null>(null);

function onImgFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (imgRef.value) imgRef.value.value = "";
  cropFile.value = file;
}

async function onCropDone(blob: Blob) {
  modal.uploading = true;
  cropFile.value = null;
  let uploadedUrl = "";
  try {
    const fd = new FormData();
    fd.append("file", new File([blob], "image.jpg", { type: "image/jpeg" }));
    const { data } = await api.post("/uploads/images", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    uploadedUrl = data.url;
    modal.form.imageUrl = uploadedUrl;
  } finally {
    modal.uploading = false;
    if (!modal.open && uploadedUrl) {
      api.delete("/uploads/images", { data: { url: uploadedUrl } }).catch(() => {});
    }
  }
}

// ── modal state ────────────────────────────────────────────────────────
const modal = reactive<{
  open: boolean;
  isEdit: boolean;
  saving: boolean;
  uploading: boolean;
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
    cookingMethod: string;
  };
}>({
  open: false, isEdit: false, saving: false, uploading: false,
  form: {
    id: null, name: "", slug: "", description: "",
    currentPrice: 0, categoryId: 0, unit: DEFAULT_MENU_ITEM_UNITS[0]?.name || "",
    spicyLevel: 0, preparationTimeMin: 10,
    status: "ACTIVE", isAvailable: true, isFeatured: false,
    imageUrl: "", ingredientId: 0, consumeQuantity: 1, cookingMethod: "",
  },
});

const viewModal = reactive<{ open: boolean; item: MenuItem | null }>({
  open: false, item: null,
});

// ── quick manager state ────────────────────────────────────────────────
type ManagingType = "cookingMethod" | "unit" | "category" | null;
const managing = ref<ManagingType>(null);
const categoryManagerBusy = ref(false);

const activeManager = computed<{
  title: string;
  items: ListItem[];
  fields: FieldDef[];
  allowAdd: boolean;
  allowDelete: boolean;
  busy: boolean;
}>(() => {
  switch (managing.value) {
    case "cookingMethod":
      return {
        title: "Cách chế biến",
        items: cookingMethods.items.value,
        fields: [{ key: "name", label: "Tên cách chế biến", placeholder: "Vd: Hấp sả gừng" }],
        allowAdd: true, allowDelete: true, busy: false,
      };
    case "unit":
      return {
        title: "Đơn vị bán",
        items: units.items.value,
        fields: [{ key: "name", label: "Đơn vị", placeholder: "Vd: đĩa, tô, con..." }],
        allowAdd: true, allowDelete: true, busy: false,
      };
    case "category":
      return {
        title: "Nhóm món",
        items: categories.value as unknown as ListItem[],
        fields: [
          { key: "name", label: "Tên nhóm", placeholder: "Vd: Ốc, Hải sản, Nước..." },
          { key: "sortOrder", label: "Thứ tự", type: "number", placeholder: "0" },
          { key: "isActive", label: "Đang dùng", type: "checkbox" },
        ],
        allowAdd: true, allowDelete: false, busy: categoryManagerBusy.value,
      };
    default:
      return { title: "", items: [], fields: [], allowAdd: true, allowDelete: true, busy: false };
  }
});

function onManagerAdd(data: Record<string, any>) {
  if (managing.value === "cookingMethod") {
    cookingMethods.add(data.name);
  } else if (managing.value === "unit") {
    units.add(data.name);
  } else if (managing.value === "category") {
    saveCategoryAdd(data);
  }
}

function onManagerUpdate(id: string | number, data: Record<string, any>) {
  if (managing.value === "cookingMethod") {
    cookingMethods.update(id, data.name);
  } else if (managing.value === "unit") {
    units.update(id, data.name);
  } else if (managing.value === "category") {
    saveCategoryUpdate(Number(id), data);
  }
}

function onManagerRemove(id: string | number) {
  if (managing.value === "cookingMethod") cookingMethods.remove(id);
  else if (managing.value === "unit") units.remove(id);
}

async function saveCategoryAdd(data: Record<string, any>) {
  categoryManagerBusy.value = true;
  try {
    await api.post("/categories", {
      name: data.name,
      slug: slugify(data.name),
      sortOrder: data.sortOrder || 0,
      isActive: data.isActive ?? true,
    });
    await loadData();
  } finally {
    categoryManagerBusy.value = false;
  }
}

async function saveCategoryUpdate(id: number, data: Record<string, any>) {
  categoryManagerBusy.value = true;
  try {
    const cat = categories.value.find(c => c.id === id);
    await api.put(`/categories/${id}`, {
      name: data.name,
      slug: slugify(data.name),
      sortOrder: data.sortOrder ?? cat?.sortOrder ?? 0,
      isActive: data.isActive ?? cat?.isActive ?? true,
    });
    await loadData();
  } finally {
    categoryManagerBusy.value = false;
  }
}

// ── computed ───────────────────────────────────────────────────────────
const filteredItems = computed(() => {
  let list = items.value;
  if (filterCategoryId.value) {
    list = list.filter(i => i.category?.id === filterCategoryId.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(i =>
      i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q)
    );
  }
  return list;
});

const searchPlaceholder = computed(() => {
  const total = filteredItems.value.length;
  return `Tìm tên món... (${total} mục)`;
});

const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

const selectedIngUnit = computed(() =>
  ingredients.value.find(i => i.id === modal.form.ingredientId)?.unit ?? ""
);

// ── image helpers ───────────────────────────────────────────────────────
const failedImgs     = reactive<Record<number, boolean>>({});
const modalImgFailed = ref(false);
const viewImgFailed  = ref(false);

watch(() => modal.form.imageUrl,   () => { modalImgFailed.value = false; });
watch(() => viewModal.item?.imageUrl, () => { viewImgFailed.value  = false; });
watch([search, filterCategoryId], () => { page.value = 1; });
watch([filteredItems, pageSize], () => {
  const totalPages = Math.max(1, Math.ceil(filteredItems.value.length / Math.max(1, pageSize.value)));
  if (page.value > totalPages) page.value = totalPages;
}, { deep: true });

function resolveImg(url?: string | null): string {
  if (!url) return "";
  return url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u0111\u0110]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function autoSlug() {
  modal.form.slug = slugify(modal.form.name);
}

function autoFillName() {
  const ing    = ingredients.value.find(i => i.id === modal.form.ingredientId);
  const method = cookingMethods.items.value.find(m => m.id === modal.form.cookingMethod);
  if (ing && method) {
    modal.form.name = `${ing.name} ${method.name}`;
  } else if (ing) {
    modal.form.name = ing.name;
  }
  if (modal.form.name) modal.form.slug = slugify(modal.form.name);
}

// ── data ───────────────────────────────────────────────────────────────
async function loadData() {
  loading.value = true;
  try {
    const [catRes, ingRes, itemRes] = await Promise.all([
      api.get("/categories"),
      api.get("/ingredients"),
      api.get("/menu-items"),
    ]);
    categories.value  = catRes.data;
    ingredients.value = ingRes.data;
    items.value       = itemRes.data;
  } finally {
    loading.value = false;
  }
}

// ── modal open/close ───────────────────────────────────────────────────
const originalImageUrl = ref("");

function resetForm() {
  Object.assign(modal.form, {
    id: null, name: "", slug: "", description: "",
    currentPrice: 0, categoryId: categories.value[0]?.id || 0,
    unit: units.items.value[0]?.name || DEFAULT_MENU_ITEM_UNITS[0]?.name || "",
    spicyLevel: 0, preparationTimeMin: 10,
    status: "ACTIVE", isAvailable: true, isFeatured: false,
    imageUrl: "", ingredientId: 0, consumeQuantity: 1, cookingMethod: "",
  });
}

function openAdd() {
  modal.isEdit = false;
  resetForm();
  originalImageUrl.value = "";
  modal.open = true;
}

function openEdit(item: MenuItem) {
  const preset = item.ingredientPresets?.[0];
  const name   = item.name.toLowerCase();
  const method = cookingMethods.items.value.find(m => name.includes(m.name.toLowerCase()));
  modal.isEdit = true;
  Object.assign(modal.form, {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description || "",
    currentPrice: item.currentPrice || 0,
    categoryId: item.category?.id || 0,
    unit: item.unit || units.items.value[0]?.name || DEFAULT_MENU_ITEM_UNITS[0]?.name || "",
    spicyLevel: (item as any).spicyLevel ?? 0,
    preparationTimeMin: (item as any).preparationTimeMin || 10,
    status: item.status,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    imageUrl: item.imageUrl || "",
    ingredientId: preset?.ingredientId || 0,
    consumeQuantity: preset?.consumeQuantity || 1,
    cookingMethod: method?.id || "",
  });
  originalImageUrl.value = item.imageUrl || "";
  modal.open = true;
}

function openView(item: MenuItem) {
  viewModal.item = item;
  viewModal.open = true;
}

function closeModal() {
  modal.open = false;
}

async function cancelModal() {
  if (!modal.uploading && modal.form.imageUrl && modal.form.imageUrl !== originalImageUrl.value) {
    try { await api.delete("/uploads/images", { data: { url: modal.form.imageUrl } }); } catch { /* best-effort */ }
  }
  modal.open = false;
}

// ── save ───────────────────────────────────────────────────────────────
async function saveItem() {
  if (!modal.form.name.trim()) return;
  modal.saving = true;
  try {
    const payload = {
      name: modal.form.name,
      slug: modal.form.slug,
      description: modal.form.description,
      currentPrice: modal.form.currentPrice,
      categoryId: modal.form.categoryId || categories.value[0]?.id,
      unit: modal.form.unit,
      spicyLevel: modal.form.spicyLevel,
      preparationTimeMin: modal.form.preparationTimeMin,
      status: modal.form.status,
      isAvailable: modal.form.isAvailable,
      isFeatured: modal.form.isFeatured,
      imageUrl: modal.form.imageUrl,
      ingredientPresets: modal.form.ingredientId > 0
        ? [{ ingredientId: modal.form.ingredientId, consumeQuantity: modal.form.consumeQuantity, sortOrder: 0 }]
        : [],
    };

    if (modal.form.id) {
      await api.put(`/menu-items/${modal.form.id}`, payload);
    } else {
      await api.post("/menu-items", payload);
    }

    await loadData();
    closeModal();
  } finally {
    modal.saving = false;
  }
}

// ── delete (soft: ARCHIVED) ────────────────────────────────────────────
async function confirmDelete(item: MenuItem) {
  deleteConfirmId.value = null;
  const preset = item.ingredientPresets?.[0];
  await api.put(`/menu-items/${item.id}`, {
    name: item.name,
    slug: item.slug,
    currentPrice: item.currentPrice,
    categoryId: item.category?.id || categories.value[0]?.id,
    status: "ARCHIVED",
    ingredientPresets: preset?.ingredientId
      ? [{ ingredientId: preset.ingredientId, consumeQuantity: preset.consumeQuantity, sortOrder: 0 }]
      : [],
  });
  await loadData();
}

onMounted(loadData);
</script>

<style scoped>
/* ── shell ── */
.mi-shell {
  display: flex; flex-direction: column; gap: 20px;
  margin-inline: -24px;
  margin-top: -24px;
  padding-inline: 8px;
  padding-top: 12px;
}

/* ── header ── */
.mi-header { display: flex; flex-direction: column; gap: 10px; }

.mi-header-top {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.mi-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0; }
.mi-header-btns { display: flex; gap: 8px; flex-shrink: 0; }
.mi-header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mi-header-subtitle {
  font-size: 0.85rem;
  color: var(--muted);
}

.mi-header-filters { display: flex; gap: 8px; }

.mi-search-wrap { position: relative; flex: 1; min-width: 0; }
.mi-search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--muted); font-size: 0.82rem; pointer-events: none;
}
.mi-search {
  padding: 8px 12px 8px 30px;
  border: 1px solid var(--line); border-radius: 10px;
  font-size: 0.9rem; background: rgba(255,255,255,0.8);
  color: var(--text); outline: none; width: 100%; box-sizing: border-box;
  transition: border-color 0.15s;
}
.mi-search:focus { border-color: var(--ember); }

.mi-filter-select {
  padding: 8px 10px; flex-shrink: 0;
  border: 1px solid var(--line); border-radius: 10px;
  font-size: 0.9rem; background: rgba(255,255,255,0.8);
  color: var(--text); outline: none; cursor: pointer;
  max-width: 160px;
}

.mi-icon-btn {
  width: 40px; height: 40px;
  border-radius: 10px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.8); color: var(--text);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 1rem; flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.mi-icon-btn:hover { background: rgba(var(--ember-rgb), 0.08); border-color: rgba(var(--ember-rgb), 0.3); }
.mi-icon-btn:active { background: rgba(var(--ember-rgb), 0.14); }
.mi-icon-btn--spin i { animation: mi-spin 0.7s linear infinite; }
.mi-icon-btn--primary {
  background: linear-gradient(135deg, var(--ember), var(--ember-strong, #b5521a));
  border-color: transparent; color: #fff;
}
.mi-icon-btn--primary:hover { opacity: 0.88; }
.mi-icon-btn--primary:active { opacity: 0.78; }

@keyframes mi-spin { to { transform: rotate(360deg); } }

/* ── table ── */
:deep(.mi-table-wrap) {
  background: rgba(var(--panel-rgb), 0.75);
  border: 1px solid var(--line); border-radius: 16px;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
}
:deep(.mi-table) { width: 100%; border-collapse: collapse; min-width: 480px; }

:deep(.mi-th) {
  padding: 10px 14px; font-size: 0.75rem; font-weight: 700;
  color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;
  border-bottom: 1px solid var(--line); text-align: left;
  background: rgba(245,240,232,0.55); white-space: nowrap;
}
:deep(.mi-th--img)     { width: 56px; }
:deep(.mi-th--right)   { text-align: right; }
:deep(.mi-th--actions) {
  width: 108px;
  position: sticky; right: 0; z-index: 2;
  background: rgba(245,240,232,0.92);
  box-shadow: -2px 0 6px rgba(0,0,0,0.06);
}

:deep(.mi-td) {
  padding: 10px 14px; font-size: 0.88rem;
  color: var(--text); border-bottom: 1px solid rgba(0,0,0,0.04); vertical-align: middle;
}
:deep(.mi-td--img)     { padding: 8px 8px 8px 14px; }
:deep(.mi-td--right)   { text-align: right; font-weight: 600; }
:deep(.mi-td--actions) {
  padding: 8px 10px;
  position: sticky; right: 0; z-index: 1;
  background: rgba(var(--panel-rgb), 0.97);
  box-shadow: -2px 0 6px rgba(0,0,0,0.05);
}
:deep(.mi-td--center)  { text-align: center; color: var(--muted); padding: 32px; }
:deep(.mi-td--muted)   { color: var(--muted); }

:deep(.mi-row) { transition: background 0.1s; }
:deep(.mi-row:hover) { background: rgba(var(--ember-rgb), 0.04); }
:deep(.mi-row:hover .mi-td--actions) { background: rgba(255,246,240,0.98); }
:deep(.mi-row--dim) { opacity: 0.48; }
:deep(.mi-row:last-child .mi-td) { border-bottom: none; }

/* mobile-only meta: hidden on desktop */
.mi-mobile-meta { display: none; }
.mi-price-short { display: none; }

.mi-thumb {
  width: 46px; height: 36px; object-fit: cover;
  border-radius: 8px; display: block; background: var(--surface, #f5f3ef);
}
.mi-thumb--blank {
  width: 46px; height: 36px; border-radius: 8px;
  flex-shrink: 0; overflow: hidden;
  background: var(--panel-soft); color: var(--ember);
  display: flex; align-items: center; justify-content: center;
}
.mi-name { font-weight: 600; }
.mi-slug { font-size: 0.74rem; color: var(--muted); font-family: monospace; margin-top: 1px; }
.mi-muted { color: var(--muted); }

.mi-badge {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.1); color: var(--ember); font-size: 0.74rem; font-weight: 700;
}

.mi-status {
  display: inline-block; padding: 2px 8px; border-radius: 999px;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;
}
.mi-status--active   { background: rgba(var(--success-rgb), 0.12); color: #166534; }
.mi-status--hidden   { background: rgba(251,191,36,0.15); color: #92400e; }
.mi-status--archived { background: rgba(0,0,0,0.07);      color: var(--muted); }

/* ── row actions ── */
.mi-row-actions, .mi-row-confirm {
  display: flex; align-items: center; justify-content: flex-end; gap: 4px;
}

.mi-row-btn {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--line);
  background: transparent; color: var(--muted);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.85rem; padding: 0;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.mi-row-btn:hover  { background: rgba(var(--ember-rgb), 0.08); color: var(--ember); border-color: rgba(var(--ember-rgb), 0.25); }
.mi-row-btn:active { background: rgba(var(--ember-rgb), 0.16); }

.mi-row-btn--del:hover  { background: rgba(var(--danger-rgb), 0.1);  color: var(--danger);  border-color: rgba(var(--danger-rgb), 0.25); }
.mi-row-btn--del:active { background: rgba(var(--danger-rgb), 0.18); color: var(--danger); }

/* delete confirm: green check + neutral x */
.mi-row-btn--yes {
  background: rgba(var(--success-rgb), 0.1); color: #166534; border-color: rgba(var(--success-rgb), 0.3);
}
.mi-row-btn--yes:hover  { background: rgba(var(--success-rgb), 0.2); color: #14532d; border-color: rgba(var(--success-rgb), 0.45); }
.mi-row-btn--yes:active { background: rgba(var(--success-rgb), 0.3); }

.mi-row-btn--no {
  background: rgba(0,0,0,0.05); color: var(--muted); border-color: var(--line);
}
.mi-row-btn--no:hover  { background: rgba(0,0,0,0.1); color: var(--text); }
.mi-row-btn--no:active { background: rgba(0,0,0,0.15); }

/* ── modal backdrop ── */
.mi-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(18,16,13,0.55);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}

.mi-modal {
  background: #fff; border-radius: 20px;
  width: 100%; max-width: 560px; max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}
.mi-modal--sm { max-width: 420px; }

.mi-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--line);
  font-weight: 700; font-size: 1rem; color: var(--text); flex-shrink: 0;
}
.mi-modal-close {
  width: 36px; height: 36px; border-radius: 8px; border: none;
  background: transparent; cursor: pointer; color: var(--muted);
  display: flex; align-items: center; justify-content: center; font-size: 0.85rem;
  transition: background 0.12s, color 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.mi-modal-close:hover  { background: rgba(0,0,0,0.06); color: var(--text); }
.mi-modal-close:active { background: rgba(0,0,0,0.1); }

.mi-modal-body {
  padding: 18px 20px; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 14px;
  -webkit-overflow-scrolling: touch;
}

.mi-modal-footer {
  padding: 14px 20px; border-top: 1px solid var(--line);
  display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
}

/* ── image upload ── */
.mi-img-wrap {
  position: relative; width: 100%; height: 150px;
  border-radius: 12px; overflow: hidden; cursor: pointer;
  background: var(--surface, #f5f3ef); flex-shrink: 0;
}
.mi-img-preview { width: 100%; height: 100%; object-fit: cover; display: block; }
.mi-img-preview--blank {
  width: 100%; height: 100%;
  background: var(--panel-soft); color: var(--ember);
  display: flex; align-items: center; justify-content: center;
}
.mi-img-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.28);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 1.4rem; opacity: 0; transition: opacity 0.15s;
}
.mi-img-wrap:hover .mi-img-overlay { opacity: 1; }

/* ── form layout ── */
.mi-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mi-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.mi-row-flags { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }

.mi-field { display: flex; flex-direction: column; gap: 5px; }
.mi-field--grow { flex: 1; }

.mi-label { font-size: 0.72rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }

.mi-input {
  padding: 9px 11px; border: 1px solid var(--line); border-radius: 10px;
  font-size: 0.9rem; color: var(--text); background: rgba(255,255,255,0.9);
  outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.15s;
}
.mi-input:focus { border-color: var(--ember); }
.mi-input--sm   { font-size: 0.85rem; }
.mi-input--mono { font-family: monospace; font-size: 0.82rem; }
.mi-textarea    { resize: vertical; min-height: 64px; }

.mi-select-group { display: flex; gap: 4px; }
.mi-select-group .mi-select { flex: 1; min-width: 0; }

.mi-select {
  padding: 9px 11px; border: 1px solid var(--line); border-radius: 10px;
  font-size: 0.9rem; color: var(--text); background: rgba(255,255,255,0.9);
  outline: none; cursor: pointer; width: 100%; transition: border-color 0.15s;
}
.mi-select:focus { border-color: var(--ember); }

.mi-manage-btn {
  width: 40px; flex-shrink: 0;
  border: 1px solid var(--line); border-radius: 10px;
  background: rgba(255,255,255,0.8); color: var(--muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; transition: background 0.12s, color 0.12s, border-color 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.mi-manage-btn:hover  { background: rgba(var(--ember-rgb), 0.08); color: var(--ember); border-color: rgba(var(--ember-rgb), 0.25); }
.mi-manage-btn:active { background: rgba(var(--ember-rgb), 0.15); }

.mi-checkbox-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.9rem; color: var(--text);
  cursor: pointer; user-select: none; padding: 6px 0;
}
.mi-checkbox-label input[type="checkbox"] { width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }

/* ── footer buttons ── */
.mi-btn {
  padding: 10px 22px; border-radius: 10px;
  font-size: 0.9rem; font-weight: 700;
  cursor: pointer; border: none;
  display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.mi-btn:disabled { opacity: 0.55; cursor: default; }
.mi-btn--ghost { background: transparent; border: 1px solid var(--line); color: var(--muted); }
.mi-btn--ghost:hover  { background: rgba(0,0,0,0.04); }
.mi-btn--ghost:active { background: rgba(0,0,0,0.08); }
.mi-btn--save { min-width: 100px; justify-content: center; }

/* ── view modal ── */
.mi-view-img {
  width: 100%; border-radius: 12px; object-fit: cover;
  max-height: 200px; display: block; background: var(--surface, #f5f3ef);
}
.mi-view-img--blank {
  width: 100%; border-radius: 12px; max-height: 200px; min-height: 120px;
  background: var(--panel-soft); color: var(--ember);
  display: flex; align-items: center; justify-content: center;
}

/* thumbnail: fill the small cell entirely */
.mi-thumb--blank :deep(svg) { width: 100%; aspect-ratio: 4/3; display: block; }

/* larger placeholders: SVG floats centered at natural size, no stretching */
.mi-img-preview--blank :deep(svg),
.mi-view-img--blank :deep(svg) { width: 55%; aspect-ratio: 4/3; display: block; }
.mi-view-dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0; font-size: 0.9rem; }
.mi-view-dl dt {
  font-weight: 700; color: var(--muted); font-size: 0.74rem;
  text-transform: uppercase; letter-spacing: 0.05em;
  align-self: start; padding-top: 2px; white-space: nowrap;
}
.mi-view-dl dd { margin: 0; color: var(--text); }

/* ── transition ── */
.mi-fade-enter-active, .mi-fade-leave-active { transition: opacity 0.18s; }
.mi-fade-enter-from,   .mi-fade-leave-to     { opacity: 0; }
.mi-fade-enter-active .mi-modal, .mi-fade-leave-active .mi-modal { transition: transform 0.18s; }
.mi-fade-enter-from .mi-modal,   .mi-fade-leave-to .mi-modal     { transform: translateY(14px) scale(0.97); }

/* ── MOBILE ── */
@media (max-width: 639px) {
  /* table: ẩn cột phụ — không cần thiết trên điện thoại */
  :deep(.mi-col-nhom),
  :deep(.mi-col-ing),
  :deep(.mi-col-status) { display: none; }

  /* ẩn slug và mobile-meta — chỉ hiện tên sạch */
  .mi-slug,
  .mi-mobile-meta { display: none; }

  /* table: thu nhỏ cells */
  :deep(.mi-td) { padding: 8px 10px; font-size: 0.85rem; }
  :deep(.mi-td--img) { padding: 6px 6px 6px 10px; }
  :deep(.mi-td--actions) { padding: 6px 8px; }
  :deep(.mi-th) { padding: 8px 10px; }

  /* table: bỏ min-width để vừa màn hình */
  :deep(.mi-table) { min-width: unset; width: 100%; }

  /* thumbnail nhỏ hơn */
  .mi-thumb { width: 40px; height: 32px; }

  /* action buttons lớn hơn cho ngón tay */
  .mi-row-btn { width: 40px; height: 40px; font-size: 0.95rem; border-radius: 10px; }
  :deep(.mi-th--actions) { width: 92px; }

  /* modal: bottom sheet */
  .mi-backdrop { padding: 0; align-items: flex-end; }
  .mi-modal {
    border-radius: 0;
    max-height: 95dvh; max-height: 95vh;
    max-width: 100%;
  }
  .mi-modal--sm { max-width: 100%; }

  /* modal body: padding nhỏ hơn */
  .mi-modal-body { padding: 14px 16px; gap: 12px; }
  .mi-modal-header { padding: 14px 16px; }
  .mi-modal-footer { padding: 12px 16px; }

  /* form: 1 cột */
  .mi-row2 { grid-template-columns: 1fr; gap: 10px; }
  .mi-row3 { grid-template-columns: 1fr 1fr; gap: 10px; }

  /* inputs lớn hơn cho touch */
  .mi-input, .mi-select { padding: 11px 12px; font-size: 1rem; }
  .mi-manage-btn { width: 44px; height: 44px; }

  /* image area cao hơn trên mobile */
  .mi-img-wrap { height: 180px; }
  .mi-img-overlay { opacity: 0.35; } /* visible by default on touch */

  /* header filters: filter select full width */
  .mi-filter-select { flex: 1; max-width: unset; }

  /* transition: slide up from bottom */
  .mi-fade-enter-from .mi-modal,
  .mi-fade-leave-to .mi-modal { transform: translateY(40px); }
}

@media (max-width: 400px) {
  :deep(.mi-th--img), :deep(.mi-td--img) { display: none; }
  .mi-price-full { display: none; }
  .mi-price-short { display: inline; }
  .mi-row3 { grid-template-columns: 1fr; }
}

.mi-list-card {
  background: rgba(var(--panel-rgb), 0.75);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
}

.mi-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px 10px;
}

.mi-list-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text);
}

.mi-list-subtitle {
  margin-top: 2px;
  font-size: 0.76rem;
  color: var(--muted);
}

.mi-pagination-wrap {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--line);
  background: rgba(255,255,255,0.45);
}

.mi-table-thumbcell {
  width: 48px;
}

.mi-table-namecell {
  min-width: 180px;
}

.mi-price-cell {
  text-align: right;
  font-weight: 600;
}

</style>
