<template>
  <div class="row g-4">
    <div class="col-12 col-xl-8">
      <div class="page-panel">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div>
            <div class="panel-title mb-1">{{ menu?.title || "Thuc don hom nay" }}</div>
            <div class="text-muted">{{ menu?.bannerText || "Khach chon mon va theo doi trang thai don ngay trong app." }}</div>
          </div>
          <span class="tag">{{ menu?.serviceDate?.slice(0, 10) || "Hom nay" }}</span>
        </div>

        <div class="menu-grid">
          <article v-for="item in menu?.items || []" :key="item.id" class="menu-card">
            <div class="menu-image"></div>
            <div class="menu-body">
              <div class="d-flex justify-content-between gap-3 align-items-start">
                <div>
                  <div class="fw-semibold">{{ item.menuItem?.name }}</div>
                  <div class="small text-muted">{{ item.menuItem?.description || item.highlightLabel }}</div>
                </div>
                <span class="tag">{{ formatMoney(item.sellingPrice) }}</span>
              </div>
              <div class="small text-muted mt-3">Con lai: {{ item.availableQuantity ?? "khong gioi han" }}</div>
              <button class="btn btn-ember btn-sm mt-3" @click="addToCart(item)">Them mon</button>
            </div>
          </article>
        </div>
      </div>
    </div>

    <div class="col-12 col-xl-4">
      <div class="page-panel sticky-panel">
        <div class="panel-title">Gio hang cua ban</div>
        <div v-if="cart.length === 0" class="text-muted small">Chua co mon nao.</div>
        <div v-else class="d-grid gap-2">
          <div v-for="line in cart" :key="line.dailyMenuItemId" class="d-flex justify-content-between gap-3 align-items-center">
            <div>
              <div class="fw-semibold small">{{ line.name }}</div>
              <div class="small text-muted">{{ formatMoney(line.price) }}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-dark" @click="changeQty(line, -1)">-</button>
              <span>{{ line.quantity }}</span>
              <button class="btn btn-sm btn-outline-dark" @click="changeQty(line, 1)">+</button>
            </div>
          </div>
        </div>
        <textarea v-model="note" rows="3" class="form-control mt-3" placeholder="Ghi chu cho bep / phuc vu"></textarea>
        <div class="fw-semibold my-3">Tong tam tinh: {{ formatMoney(cartTotal) }}</div>
        <button class="btn btn-ember w-100" :disabled="cart.length === 0 || submitting" @click="submitOrder">
          {{ submitting ? "Dang gui don..." : "Dat mon" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../../api";
import { formatMoney } from "../../utils/format";

const menu = ref<any>(null);
const cart = ref<any[]>([]);
const note = ref("");
const submitting = ref(false);

const cartTotal = computed(() =>
  cart.value.reduce((sum, line) => sum + line.price * line.quantity, 0)
);

async function loadMenu() {
  const { data } = await api.get("/daily-menus/public/today");
  menu.value = data;
}

function addToCart(item: any) {
  const existing = cart.value.find((line) => line.dailyMenuItemId === item.id);
  if (existing) {
    existing.quantity += 1;
    return;
  }
  cart.value.push({
    dailyMenuItemId: item.id,
    name: item.menuItem?.name,
    price: item.sellingPrice,
    quantity: 1,
  });
}

function changeQty(line: any, delta: number) {
  line.quantity = Math.max(1, line.quantity + delta);
}

async function submitOrder() {
  submitting.value = true;
  try {
    await api.post("/orders", {
      dailyMenuId: menu.value?.id,
      note: note.value,
      items: cart.value.map((line) => ({
        dailyMenuItemId: line.dailyMenuItemId,
        quantity: line.quantity,
      })),
    });
    cart.value = [];
    note.value = "";
  } finally {
    submitting.value = false;
  }
}

onMounted(loadMenu);
</script>
