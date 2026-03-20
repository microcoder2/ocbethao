<template>
  <div class="d-grid gap-4">
    <section class="row g-4">
      <div class="col-12 col-xl-5">
        <div class="page-panel">
          <div class="panel-title">{{ form.id ? "Sua thuc don ngay" : "Tao thuc don ngay" }}</div>
          <form class="form-grid" @submit.prevent="saveMenu">
            <input v-model="form.title" class="form-control" placeholder="Ten thuc don" />
            <input v-model="form.serviceDate" type="date" class="form-control" />
            <textarea v-model="form.bannerText" rows="2" class="form-control" placeholder="Banner / slogan trong ngay"></textarea>
            <textarea v-model="form.note" rows="3" class="form-control" placeholder="Ghi chu ca / ghi chu menu"></textarea>
            <select v-model="form.status" class="form-select">
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            <button class="btn btn-ember">{{ form.id ? "Cap nhat menu" : "Luu menu" }}</button>
          </form>
        </div>
      </div>

      <div class="col-12 col-xl-7">
        <div class="page-panel">
          <div class="panel-title">Chon mon dua vao thuc don</div>
          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th></th>
                  <th>Mon</th>
                  <th>SL</th>
                  <th>Gia ngay</th>
                  <th>Label</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in draftItems" :key="row.menuItemId">
                  <td><input v-model="row.enabled" type="checkbox" class="form-check-input" /></td>
                  <td>{{ row.name }}</td>
                  <td><input v-model.number="row.quantity" type="number" class="form-control" :disabled="!row.enabled" /></td>
                  <td><input v-model.number="row.overridePrice" type="number" class="form-control" :disabled="!row.enabled" /></td>
                  <td><input v-model="row.highlightLabel" class="form-control" :disabled="!row.enabled" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="table-card">
      <div class="p-3 border-bottom fw-semibold">Danh sach thuc don</div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr>
              <th>Ngay</th>
              <th>Ten menu</th>
              <th>Trang thai</th>
              <th>So mon</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="menu in menus" :key="menu.id">
              <td>{{ menu.serviceDate?.slice(0, 10) }}</td>
              <td>{{ menu.title }}</td>
              <td>{{ menu.status }}</td>
              <td>{{ menu.items?.length || 0 }}</td>
              <td class="text-end d-flex justify-content-end gap-2">
                <button class="btn btn-sm btn-outline-dark" @click="editMenu(menu)">Sua</button>
                <button v-if="menu.status !== 'PUBLISHED'" class="btn btn-sm btn-ember" @click="publishMenu(menu.id)">Publish</button>
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
const menus = ref<any[]>([]);
const draftItems = ref<any[]>([]);

const form = reactive<any>({
  id: null,
  title: "Thuc don hom nay",
  serviceDate: new Date().toISOString().slice(0, 10),
  bannerText: "",
  note: "",
  status: "DRAFT",
});

function resetDraftItems() {
  draftItems.value = menuItems.value.map((item) => ({
    menuItemId: item.id,
    name: item.name,
    enabled: false,
    quantity: 20,
    overridePrice: item.currentPrice || item.basePrice || 0,
    highlightLabel: item.isFeatured ? "Ban chay" : "Hom nay",
  }));
}

async function loadData() {
  const [itemRes, menuRes] = await Promise.all([
    api.get("/menu-items"),
    api.get("/daily-menus"),
  ]);
  menuItems.value = itemRes.data;
  menus.value = menuRes.data;
  resetDraftItems();
}

function resetForm() {
  Object.assign(form, {
    id: null,
    title: "Thuc don hom nay",
    serviceDate: new Date().toISOString().slice(0, 10),
    bannerText: "",
    note: "",
    status: "DRAFT",
  });
  resetDraftItems();
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
  resetDraftItems();
  for (const row of draftItems.value) {
    const matched = menu.items.find((item: any) => item.menuItem?.id === row.menuItemId);
    if (matched) {
      row.enabled = true;
      row.quantity = matched.quantity || 20;
      row.overridePrice = matched.overridePrice || matched.sellingPrice || row.overridePrice;
      row.highlightLabel = matched.highlightLabel || "";
    }
  }
}

async function saveMenu() {
  const payload = {
    title: form.title,
    serviceDate: form.serviceDate,
    bannerText: form.bannerText,
    note: form.note,
    status: form.status,
    items: draftItems.value
      .filter((item) => item.enabled)
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        overridePrice: item.overridePrice,
        highlightLabel: item.highlightLabel,
        isAvailable: true,
      })),
  };

  if (form.id) {
    await api.put(`/daily-menus/${form.id}`, payload);
  } else {
    await api.post("/daily-menus", payload);
  }
  await loadData();
  resetForm();
}

async function publishMenu(id: number) {
  await api.post(`/daily-menus/${id}/publish`);
  await loadData();
}

onMounted(loadData);
</script>
