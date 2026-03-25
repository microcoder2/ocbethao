<template>
  <div class="d-grid gap-4">
    <section class="row g-4">
      <div class="col-12 col-xxl-5">
        <div class="page-panel h-100">
          <div class="panel-title">{{ itemForm.id ? "Cập nhật món mẫu" : "Thêm món mẫu mới" }}</div>
          <form class="form-grid" @submit.prevent="saveItem">
            <input v-model="itemForm.name" class="form-control" placeholder="Tên món mẫu" />
            <input v-model="itemForm.slug" class="form-control" placeholder="Slug" />
            <textarea
              v-model="itemForm.description"
              class="form-control"
              rows="3"
              placeholder="Mô tả món, hương vị, cách phục vụ..."
            ></textarea>

            <div class="row g-3">
              <div class="col-md-6">
                <input v-model.number="itemForm.basePrice" type="number" class="form-control" placeholder="Giá mẫu" />
              </div>
              <div class="col-md-6">
                <select v-model.number="itemForm.categoryId" class="form-select">
                  <option :value="0">Chọn nhóm món</option>
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-4">
                <input v-model="itemForm.unit" class="form-control" placeholder="Đơn vị bán" />
              </div>
              <div class="col-md-4">
                <input
                  v-model.number="itemForm.spicyLevel"
                  type="number"
                  min="0"
                  max="5"
                  class="form-control"
                  placeholder="Độ cay"
                />
              </div>
              <div class="col-md-4">
                <input
                  v-model.number="itemForm.preparationTimeMin"
                  type="number"
                  min="0"
                  class="form-control"
                  placeholder="Phút chuẩn bị"
                />
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-7">
                <select v-model.number="itemForm.ingredientId" class="form-select">
                  <option :value="0">Nguồn mặc định</option>
                  <option v-for="ingredient in ingredients" :key="ingredient.id" :value="ingredient.id">
                    {{ ingredient.name }}
                  </option>
                </select>
              </div>
              <div class="col-md-5">
                <input
                  v-model.number="itemForm.consumeQuantity"
                  type="number"
                  min="0"
                  step="0.25"
                  class="form-control"
                  placeholder="Định lượng mặc định"
                />
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-6">
                <select v-model="itemForm.status" class="form-select">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div class="col-md-6 d-flex align-items-center gap-3">
                <div class="form-check">
                  <input v-model="itemForm.isAvailable" class="form-check-input" type="checkbox" id="item-available" />
                  <label class="form-check-label" for="item-available">Khả dụng</label>
                </div>
                <div class="form-check">
                  <input v-model="itemForm.isFeatured" class="form-check-input" type="checkbox" id="item-featured" />
                  <label class="form-check-label" for="item-featured">Nổi bật</label>
                </div>
              </div>
            </div>

            <div class="row g-3">
              <div class="col-md-8">
                <input v-model="itemForm.imageUrl" class="form-control" placeholder="Image URL" />
              </div>
              <div class="col-md-4">
                <input type="file" class="form-control" accept="image/*" @change="uploadItemImage" />
              </div>
            </div>

            <div class="small text-muted">
              Giá ở đây là giá mẫu của ngân hàng món. Khi tạo menu ngày, giá bán và pool nguồn hàng sẽ được điều chỉnh riêng.
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-ember" :disabled="savingItem">
                {{ savingItem ? "Đang lưu..." : "Lưu món mẫu" }}
              </button>
              <button type="button" class="btn btn-outline-secondary" @click="resetItemForm">Mới</button>
            </div>
          </form>
        </div>
      </div>

      <div class="col-12 col-xxl-7">
        <div class="d-grid gap-4">
          <div class="page-panel">
            <div class="panel-title">Thêm nhóm món nhanh</div>
            <form class="row g-3" @submit.prevent="saveCategory">
              <div class="col-md-4">
                <input v-model="categoryForm.name" class="form-control" placeholder="Tên nhóm" />
              </div>
              <div class="col-md-4">
                <input v-model="categoryForm.slug" class="form-control" placeholder="Slug" />
              </div>
              <div class="col-md-3">
                <input v-model.number="categoryForm.sortOrder" type="number" class="form-control" placeholder="Thứ tự" />
              </div>
              <div class="col-md-1 d-grid">
                <button class="btn btn-outline-dark">+</button>
              </div>
            </form>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <span v-for="category in categories" :key="category.id" class="tag">{{ category.name }}</span>
            </div>
          </div>

          <div class="page-panel">
            <div class="panel-title">{{ ingredientForm.id ? "Cập nhật nguồn hàng" : "Thêm nguồn hàng / size" }}</div>
            <form class="row g-3" @submit.prevent="saveIngredient">
              <div class="col-md-4">
                <input v-model="ingredientForm.name" class="form-control" placeholder="Ví dụ: Sò huyết" />
              </div>
              <div class="col-md-3">
                <input v-model="ingredientForm.slug" class="form-control" placeholder="Slug" />
              </div>
              <div class="col-md-2">
                <input v-model="ingredientForm.unit" class="form-control" placeholder="Đơn vị" />
              </div>
              <div class="col-md-3">
                <input v-model="ingredientForm.imageUrl" class="form-control" placeholder="Image URL" />
              </div>
              <div class="col-12">
                <textarea
                  v-model="ingredientForm.description"
                  class="form-control"
                  rows="2"
                  placeholder="Mô tả nguồn hàng, size, ghi chú chợ..."
                ></textarea>
              </div>
              <div class="col-md-12 d-flex justify-content-between align-items-center gap-3">
                <div class="form-check">
                  <input v-model="ingredientForm.isActive" class="form-check-input" type="checkbox" id="ingredient-active" />
                  <label class="form-check-label" for="ingredient-active">Đang sử dụng</label>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-ember" :disabled="savingIngredient">
                    {{ savingIngredient ? "Đang lưu..." : "Lưu nguồn hàng" }}
                  </button>
                  <button type="button" class="btn btn-outline-secondary" @click="resetIngredientForm">Mới</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Ngân hàng món mẫu</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Món</th>
              <th>Nhóm</th>
              <th>Giá mẫu</th>
              <th>Nguồn mặc định</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>
                <div class="fw-semibold">{{ item.name }}</div>
                <div class="small text-muted">{{ item.slug }}</div>
              </td>
              <td>{{ item.category?.name || "--" }}</td>
              <td>{{ formatMoney(item.currentPrice) }}</td>
              <td>
                <div class="fw-semibold small">
                  {{ item.ingredientPresets?.[0]?.ingredient?.name || "--" }}
                </div>
                <div class="small text-muted" v-if="item.ingredientPresets?.[0]">
                  {{ item.ingredientPresets[0].consumeQuantity }} {{ item.ingredientPresets[0].ingredient?.unit || "" }}
                </div>
              </td>
              <td>{{ item.status }}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-dark" @click="editItem(item)">Sửa</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Ngân hàng nguồn hàng</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Nguồn hàng</th>
              <th>Đơn vị</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ingredient in ingredients" :key="ingredient.id">
              <td>
                <div class="fw-semibold">{{ ingredient.name }}</div>
                <div class="small text-muted">{{ ingredient.slug }}</div>
              </td>
              <td>{{ ingredient.unit }}</td>
              <td>{{ ingredient.isActive ? "ACTIVE" : "INACTIVE" }}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-dark" @click="editIngredient(ingredient)">Sửa</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../api";
import { formatMoney } from "../../utils/format";

const categories = ref<any[]>([]);
const ingredients = ref<any[]>([]);
const items = ref<any[]>([]);
const savingItem = ref(false);
const savingIngredient = ref(false);

const itemForm = reactive<any>({
  id: null,
  name: "",
  slug: "",
  description: "",
  basePrice: 0,
  categoryId: 0,
  unit: "phần",
  spicyLevel: 0,
  status: "ACTIVE",
  isAvailable: true,
  isFeatured: false,
  preparationTimeMin: 10,
  imageUrl: "",
  ingredientId: 0,
  consumeQuantity: 1,
});

const ingredientForm = reactive<any>({
  id: null,
  name: "",
  slug: "",
  description: "",
  unit: "phần",
  imageUrl: "",
  isActive: true,
});

const categoryForm = reactive({
  name: "",
  slug: "",
  sortOrder: 0,
});

async function loadData() {
  const [categoryRes, ingredientRes, itemRes] = await Promise.all([
    api.get("/categories"),
    api.get("/ingredients"),
    api.get("/menu-items"),
  ]);
  categories.value = categoryRes.data;
  ingredients.value = ingredientRes.data;
  items.value = itemRes.data;
}

function resetItemForm() {
  Object.assign(itemForm, {
    id: null,
    name: "",
    slug: "",
    description: "",
    basePrice: 0,
    categoryId: categories.value[0]?.id || 0,
    unit: "phần",
    spicyLevel: 0,
    status: "ACTIVE",
    isAvailable: true,
    isFeatured: false,
    preparationTimeMin: 10,
    imageUrl: "",
    ingredientId: 0,
    consumeQuantity: 1,
  });
}

function resetIngredientForm() {
  Object.assign(ingredientForm, {
    id: null,
    name: "",
    slug: "",
    description: "",
    unit: "phần",
    imageUrl: "",
    isActive: true,
  });
}

function editItem(item: any) {
  const preset = item.ingredientPresets?.[0];
  Object.assign(itemForm, {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description || "",
    basePrice: item.currentPrice || item.basePrice || 0,
    categoryId: item.category?.id || 0,
    unit: item.unit || "phần",
    spicyLevel: item.spicyLevel || 0,
    status: item.status,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    preparationTimeMin: item.preparationTimeMin || 0,
    imageUrl: item.imageUrl || "",
    ingredientId: preset?.ingredientId || 0,
    consumeQuantity: preset?.consumeQuantity || 1,
  });
}

function editIngredient(ingredient: any) {
  Object.assign(ingredientForm, {
    id: ingredient.id,
    name: ingredient.name,
    slug: ingredient.slug,
    description: ingredient.description || "",
    unit: ingredient.unit || "phần",
    imageUrl: ingredient.imageUrl || "",
    isActive: ingredient.isActive,
  });
}

async function saveItem() {
  savingItem.value = true;
  try {
    const payload = {
      ...itemForm,
      ingredientPresets:
        itemForm.ingredientId > 0
          ? [
              {
                ingredientId: itemForm.ingredientId,
                consumeQuantity: itemForm.consumeQuantity || 1,
                sortOrder: 0,
              },
            ]
          : [],
    };

    if (itemForm.id) {
      await api.put(`/menu-items/${itemForm.id}`, payload);
    } else {
      await api.post("/menu-items", payload);
    }

    await loadData();
    resetItemForm();
  } finally {
    savingItem.value = false;
  }
}

async function saveIngredient() {
  savingIngredient.value = true;
  try {
    const payload = { ...ingredientForm };
    if (ingredientForm.id) {
      await api.put(`/ingredients/${ingredientForm.id}`, payload);
    } else {
      await api.post("/ingredients", payload);
    }
    await loadData();
    resetIngredientForm();
  } finally {
    savingIngredient.value = false;
  }
}

async function saveCategory() {
  await api.post("/categories", categoryForm);
  Object.assign(categoryForm, { name: "", slug: "", sortOrder: 0 });
  await loadData();
  if (!itemForm.categoryId && categories.value[0]?.id) {
    itemForm.categoryId = categories.value[0].id;
  }
}

async function uploadItemImage(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/uploads/images", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  itemForm.imageUrl = data.url;
}

onMounted(async () => {
  await loadData();
  resetItemForm();
  resetIngredientForm();
});
</script>
