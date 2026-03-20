<template>
  <div class="d-grid gap-4">
    <section class="row g-4">
      <div class="col-12 col-xl-5">
        <div class="page-panel">
          <div class="panel-title">{{ form.id ? "Cap nhat mon" : "Them mon moi" }}</div>
          <form class="form-grid" @submit.prevent="saveItem">
            <input v-model="form.name" class="form-control" placeholder="Ten mon" />
            <input v-model="form.slug" class="form-control" placeholder="Slug" />
            <textarea v-model="form.description" class="form-control" rows="3" placeholder="Mo ta ngan"></textarea>
            <div class="row g-3">
              <div class="col-6">
                <input v-model.number="form.basePrice" type="number" class="form-control" placeholder="Gia" />
              </div>
              <div class="col-6">
                <select v-model.number="form.categoryId" class="form-select">
                  <option :value="0">Chon nhom</option>
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-4">
                <input v-model="form.unit" class="form-control" placeholder="Don vi" />
              </div>
              <div class="col-4">
                <input v-model.number="form.spicyLevel" type="number" min="0" max="5" class="form-control" placeholder="Cay" />
              </div>
              <div class="col-4">
                <input v-model.number="form.preparationTimeMin" type="number" class="form-control" placeholder="Phut" />
              </div>
            </div>
            <div class="row g-3">
              <div class="col-6">
                <select v-model="form.status" class="form-select">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SOLD_OUT">SOLD_OUT</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </div>
              <div class="col-6 d-flex align-items-center gap-3">
                <div class="form-check">
                  <input v-model="form.isAvailable" class="form-check-input" type="checkbox" id="available" />
                  <label class="form-check-label" for="available">Available</label>
                </div>
                <div class="form-check">
                  <input v-model="form.isFeatured" class="form-check-input" type="checkbox" id="featured" />
                  <label class="form-check-label" for="featured">Featured</label>
                </div>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-8">
                <input v-model="form.imageUrl" class="form-control" placeholder="Image URL" />
              </div>
              <div class="col-4">
                <input type="file" class="form-control" accept="image/*" @change="uploadImage" />
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-ember" :disabled="saving">{{ saving ? "Dang luu..." : "Luu mon" }}</button>
              <button type="button" class="btn btn-outline-secondary" @click="resetForm">Moi</button>
            </div>
          </form>
        </div>
      </div>

      <div class="col-12 col-xl-7">
        <div class="page-panel">
          <div class="panel-title">Them nhom mon nhanh</div>
          <form class="row g-3" @submit.prevent="saveCategory">
            <div class="col-md-4"><input v-model="categoryForm.name" class="form-control" placeholder="Ten nhom" /></div>
            <div class="col-md-4"><input v-model="categoryForm.slug" class="form-control" placeholder="Slug" /></div>
            <div class="col-md-3"><input v-model.number="categoryForm.sortOrder" type="number" class="form-control" placeholder="Thu tu" /></div>
            <div class="col-md-1 d-grid"><button class="btn btn-outline-dark">+</button></div>
          </form>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <span v-for="category in categories" :key="category.id" class="tag">
              {{ category.name }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Danh sach mon</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Mon</th>
              <th>Nhom</th>
              <th>Gia</th>
              <th>Trang thai</th>
              <th>Image</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>
                <div class="fw-semibold">{{ item.name }}</div>
                <div class="small text-muted">{{ item.slug }}</div>
              </td>
              <td>{{ item.category?.name }}</td>
              <td>{{ formatMoney(item.currentPrice) }}</td>
              <td>{{ item.status }}</td>
              <td class="small text-muted">{{ item.imageUrl || "--" }}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-dark" @click="editItem(item)">Sua</button>
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
const items = ref<any[]>([]);
const saving = ref(false);

const form = reactive<any>({
  id: null,
  name: "",
  slug: "",
  description: "",
  basePrice: 0,
  categoryId: 0,
  unit: "phan",
  spicyLevel: 0,
  status: "ACTIVE",
  isAvailable: true,
  isFeatured: false,
  preparationTimeMin: 10,
  imageUrl: "",
});

const categoryForm = reactive({
  name: "",
  slug: "",
  sortOrder: 0,
});

async function loadData() {
  const [categoryRes, itemRes] = await Promise.all([
    api.get("/categories"),
    api.get("/menu-items"),
  ]);
  categories.value = categoryRes.data;
  items.value = itemRes.data;
}

function resetForm() {
  Object.assign(form, {
    id: null,
    name: "",
    slug: "",
    description: "",
    basePrice: 0,
    categoryId: categories.value[0]?.id || 0,
    unit: "phan",
    spicyLevel: 0,
    status: "ACTIVE",
    isAvailable: true,
    isFeatured: false,
    preparationTimeMin: 10,
    imageUrl: "",
  });
}

function editItem(item: any) {
  Object.assign(form, {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description || "",
    basePrice: item.currentPrice || item.basePrice || 0,
    categoryId: item.category?.id || 0,
    unit: item.unit,
    spicyLevel: item.spicyLevel || 0,
    status: item.status,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    preparationTimeMin: item.preparationTimeMin || 0,
    imageUrl: item.imageUrl || "",
  });
}

async function saveItem() {
  saving.value = true;
  try {
    const payload = { ...form };
    if (form.id) {
      await api.put(`/menu-items/${form.id}`, payload);
    } else {
      await api.post("/menu-items", payload);
    }
    await loadData();
    resetForm();
  } finally {
    saving.value = false;
  }
}

async function saveCategory() {
  await api.post("/categories", categoryForm);
  Object.assign(categoryForm, { name: "", slug: "", sortOrder: 0 });
  await loadData();
}

async function uploadImage(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/uploads/images", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  form.imageUrl = data.url;
}

onMounted(async () => {
  await loadData();
  resetForm();
});
</script>
