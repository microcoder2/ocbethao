<template>
  <div class="d-grid gap-4">
    <section class="row g-4">
      <div class="col-12 col-xl-4">
        <div class="page-panel h-100">
          <div class="panel-title">{{ form.id ? "Sửa menu ngày V2" : "Tạo menu ngày V2" }}</div>
          <form class="form-grid" @submit.prevent="saveMenu">
            <input v-model="form.title" class="form-control" placeholder="Tên thực đơn" />
            <input v-model="form.serviceDate" type="date" class="form-control" />
            <textarea
              v-model="form.bannerText"
              rows="2"
              class="form-control"
              placeholder="Banner / slogan trong ngày"
            ></textarea>
            <textarea
              v-model="form.note"
              rows="3"
              class="form-control"
              placeholder="Ghi chú ca / ghi chú menu"
            ></textarea>
            <select v-model="form.status" class="form-select">
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            <div class="small text-muted">
              V2 quản lý theo pool nguồn hàng. Mỗi món trên menu phải gắn ít nhất một pool để hệ thống tự trừ tồn chung.
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-ember" :disabled="saving">
                {{ saving ? "Đang lưu..." : form.id ? "Cập nhật menu" : "Lưu menu" }}
              </button>
              <button type="button" class="btn btn-outline-secondary" @click="resetForm">Mới</button>
            </div>
          </form>
        </div>
      </div>

      <div class="col-12 col-xl-8">
        <div class="page-panel">
          <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
            <div class="panel-title mb-0">Pool nguồn hàng trong ngày</div>
            <button class="btn btn-outline-dark btn-sm" @click="addStockPool()">Thêm pool</button>
          </div>
          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Nguồn hàng</th>
                  <th>Label hiển thị</th>
                  <th>SL nhập</th>
                  <th>Đã bán</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="stockPools.length === 0">
                  <td colspan="6" class="text-muted small">Chưa có pool nào. Tạo pool trước khi gắn món bán vào menu.</td>
                </tr>
                <tr v-for="pool in stockPools" :key="pool.key">
                  <td>
                    <select v-model.number="pool.ingredientId" class="form-select">
                      <option :value="0">Chọn nguồn hàng</option>
                      <option v-for="ingredient in ingredients" :key="ingredient.id" :value="ingredient.id">
                        {{ ingredient.name }}
                      </option>
                    </select>
                  </td>
                  <td>
                    <input v-model="pool.label" class="form-control" placeholder="Ví dụ: Sò huyết hôm nay" />
                  </td>
                  <td>
                    <input v-model.number="pool.quantity" type="number" min="0" step="0.25" class="form-control" />
                  </td>
                  <td>
                    <input :value="pool.soldQuantity || 0" type="number" class="form-control" disabled />
                  </td>
                  <td>
                    <input v-model="pool.note" class="form-control" placeholder="Ghi chú chợ / size / đợt hàng" />
                  </td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" @click="removeStockPool(pool.key)">X</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="page-panel">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
        <div class="panel-title mb-0">Món bán trong menu ngày</div>
        <div class="small text-muted">Mỗi món chọn một pool nguồn hàng để hệ thống trừ tồn dùng chung.</div>
      </div>
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th></th>
              <th>Món mẫu</th>
              <th>Pool áp dụng</th>
              <th>Định lượng</th>
              <th>Giá ngày</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in draftItems" :key="row.menuItemId">
              <td>
                <input v-model="row.enabled" type="checkbox" class="form-check-input" @change="toggleOffer(row)" />
              </td>
              <td>
                <div class="fw-semibold">{{ row.name }}</div>
                <div class="small text-muted">
                  Nguồn gợi ý: {{ row.defaultIngredientName || "--" }}
                </div>
              </td>
              <td>
                <div class="d-grid gap-2">
                  <select v-model="row.stockPoolRef" class="form-select" :disabled="!row.enabled">
                    <option value="">Chọn pool nguồn hàng</option>
                    <option v-for="pool in stockPools" :key="pool.key" :value="getPoolRef(pool)">
                      {{ getPoolDisplayName(pool) }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-dark"
                    :disabled="!row.enabled || !row.defaultIngredientId"
                    @click="assignSuggestedPool(row)"
                  >
                    Gợi ý pool
                  </button>
                </div>
              </td>
              <td>
                <input
                  v-model.number="row.consumeQuantity"
                  type="number"
                  min="0"
                  step="0.25"
                  class="form-control"
                  :disabled="!row.enabled"
                />
              </td>
              <td>
                <input
                  v-model.number="row.overridePrice"
                  type="number"
                  min="0"
                  class="form-control"
                  :disabled="!row.enabled"
                />
              </td>
              <td>
                <input v-model="row.highlightLabel" class="form-control" :disabled="!row.enabled" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Danh sách menu ngày</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Tên menu</th>
              <th>Trạng thái</th>
              <th>Pool</th>
              <th>Món bán</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="menu in menus" :key="menu.id">
              <td>{{ menu.serviceDate?.slice(0, 10) }}</td>
              <td>{{ menu.title }}</td>
              <td>{{ menu.status }}</td>
              <td>{{ menu.stockPools?.length || 0 }}</td>
              <td>{{ menu.items?.length || 0 }}</td>
              <td class="text-end d-flex justify-content-end gap-2">
                <button class="btn btn-sm btn-outline-dark" @click="editMenu(menu)">Sửa</button>
                <button v-if="menu.status !== 'PUBLISHED'" class="btn btn-sm btn-ember" @click="publishMenu(menu.id)">
                  Publish
                </button>
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

const menuItems = ref<any[]>([]);
const ingredients = ref<any[]>([]);
const menus = ref<any[]>([]);
const draftItems = ref<any[]>([]);
const stockPools = ref<any[]>([]);
const saving = ref(false);

const form = reactive<any>({
  id: null,
  title: "Thực đơn hải sản hôm nay",
  serviceDate: new Date().toISOString().slice(0, 10),
  bannerText: "",
  note: "",
  status: "DRAFT",
});

function makePoolKey() {
  return `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPoolRef(pool: any) {
  return pool.id ? `id:${pool.id}` : `key:${pool.key}`;
}

function getPoolDisplayName(pool: any) {
  const ingredient = ingredients.value.find((item) => item.id === pool.ingredientId);
  return pool.label || ingredient?.name || "Pool chưa đặt tên";
}

function addStockPool(ingredientId = 0) {
  const pool = {
    id: null,
    key: makePoolKey(),
    ingredientId,
    label: "",
    quantity: 0,
    soldQuantity: 0,
    isAvailable: true,
    note: "",
  };
  stockPools.value.push(pool);
  return pool;
}

function removeStockPool(key: string) {
  stockPools.value = stockPools.value.filter((pool) => pool.key !== key);
  for (const row of draftItems.value) {
    if (row.stockPoolRef === `key:${key}`) {
      row.stockPoolRef = "";
    }
  }
}

function resetDraftItems() {
  draftItems.value = menuItems.value.map((item) => ({
    id: null,
    menuItemId: item.id,
    name: item.name,
    enabled: false,
    overridePrice: item.currentPrice || item.basePrice || 0,
    highlightLabel: item.isFeatured ? "Bán chạy" : "Hôm nay",
    isAvailable: true,
    stockPoolRef: "",
    consumeQuantity: item.ingredientPresets?.[0]?.consumeQuantity || 1,
    defaultIngredientId: item.ingredientPresets?.[0]?.ingredientId || 0,
    defaultIngredientName: item.ingredientPresets?.[0]?.ingredient?.name || "",
  }));
}

async function loadData() {
  const [ingredientRes, itemRes, menuRes] = await Promise.all([
    api.get("/ingredients"),
    api.get("/menu-items"),
    api.get("/daily-menus"),
  ]);
  ingredients.value = ingredientRes.data;
  menuItems.value = itemRes.data;
  menus.value = menuRes.data;
  resetDraftItems();
}

function resetForm() {
  Object.assign(form, {
    id: null,
    title: "Thực đơn hải sản hôm nay",
    serviceDate: new Date().toISOString().slice(0, 10),
    bannerText: "",
    note: "",
    status: "DRAFT",
  });
  stockPools.value = [];
  resetDraftItems();
}

function findPoolRefByIngredient(ingredientId: number) {
  const matched = stockPools.value.find((pool) => pool.ingredientId === ingredientId);
  return matched ? getPoolRef(matched) : "";
}

function toggleOffer(row: any) {
  if (!row.enabled) {
    row.stockPoolRef = "";
    return;
  }

  if (!row.stockPoolRef && row.defaultIngredientId) {
    row.stockPoolRef = findPoolRefByIngredient(row.defaultIngredientId);
  }
}

function assignSuggestedPool(row: any) {
  if (!row.defaultIngredientId) return;

  let matched = stockPools.value.find((pool) => pool.ingredientId === row.defaultIngredientId);
  if (!matched) {
    matched = addStockPool(row.defaultIngredientId);
  }
  row.stockPoolRef = getPoolRef(matched);
}

function editMenu(menu: any) {
  Object.assign(form, {
    id: menu.id,
    title: menu.title,
    serviceDate: String(menu.serviceDate).slice(0, 10),
    bannerText: menu.bannerText || "",
    note: menu.note || "",
    status: menu.status,
  });

  stockPools.value = (menu.stockPools || []).map((pool: any) => ({
    id: pool.id,
    key: makePoolKey(),
    ingredientId: pool.ingredient?.id || 0,
    label: pool.label || "",
    quantity: pool.quantity || 0,
    soldQuantity: pool.soldQuantity || 0,
    isAvailable: pool.isAvailable,
    note: pool.note || "",
  }));

  resetDraftItems();
  for (const row of draftItems.value) {
    const matched = menu.items.find((item: any) => item.menuItem?.id === row.menuItemId);
    if (!matched) continue;

    row.id = matched.id;
    row.enabled = true;
    row.overridePrice = matched.overridePrice || matched.sellingPrice || row.overridePrice;
    row.highlightLabel = matched.highlightLabel || "";
    row.isAvailable = matched.isAvailable;
    row.consumeQuantity = matched.stockLinks?.[0]?.consumeQuantity || row.consumeQuantity;
    row.stockPoolRef = matched.stockLinks?.[0]?.stockPool?.id
      ? `id:${matched.stockLinks[0].stockPool.id}`
      : "";
  }
}

function buildStockLinkPayload(stockPoolRef: string, consumeQuantity: number) {
  if (!stockPoolRef) {
    return null;
  }

  if (stockPoolRef.startsWith("id:")) {
    return {
      dailyStockPoolId: Number(stockPoolRef.slice(3)),
      consumeQuantity,
    };
  }

  if (stockPoolRef.startsWith("key:")) {
    return {
      stockPoolKey: stockPoolRef.slice(4),
      consumeQuantity,
    };
  }

  return null;
}

async function saveMenu() {
  saving.value = true;
  try {
    const payload = {
      title: form.title,
      serviceDate: form.serviceDate,
      bannerText: form.bannerText,
      note: form.note,
      status: form.status,
      stockPools: stockPools.value
        .filter((pool) => pool.ingredientId && Number(pool.quantity) >= 0)
        .map((pool) => ({
          id: pool.id || undefined,
          key: pool.key,
          ingredientId: pool.ingredientId,
          label: pool.label || undefined,
          quantity: Number(pool.quantity || 0),
          isAvailable: pool.isAvailable,
          note: pool.note || undefined,
        })),
      items: draftItems.value
        .filter((item) => item.enabled)
        .map((item) => ({
          id: item.id || undefined,
          menuItemId: item.menuItemId,
          overridePrice: Number(item.overridePrice || 0),
          highlightLabel: item.highlightLabel || "",
          isAvailable: item.isAvailable,
          stockLinks: [buildStockLinkPayload(item.stockPoolRef, Number(item.consumeQuantity || 1))].filter(Boolean),
        })),
    };

    if (form.id) {
      await api.put(`/daily-menus/${form.id}`, payload);
    } else {
      await api.post("/daily-menus", payload);
    }
    await loadData();
    resetForm();
  } finally {
    saving.value = false;
  }
}

async function publishMenu(id: number) {
  await api.post(`/daily-menus/${id}/publish`);
  await loadData();
}

onMounted(async () => {
  await loadData();
  resetForm();
});
</script>
