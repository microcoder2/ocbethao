<template>
  <div class="quick-order-mobile">
    <header class="quick-order-mobile__topbar">
      <div class="quick-order-mobile__topbar-copy">
        <div class="quick-order-mobile__eyebrow">Chọn món & gửi bếp</div>
      </div>
    </header>

    <div v-if="feedback" :class="['quick-order-mobile__feedback', `is-${feedback.type}`]">
      <i :class="['bi', feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill']"></i>
      <span>{{ feedback.text }}</span>
    </div>

    <div v-if="loading" class="quick-order-mobile__state">
      <div class="quick-order-mobile__state-icon">
        <i class="bi bi-hourglass-split"></i>
      </div>
      <h2>Đang tải thực đơn</h2>
      <p>Quán đang lấy menu hôm nay để bạn đặt món nhanh.</p>
    </div>

    <div v-else-if="loadError" class="quick-order-mobile__state">
      <div class="quick-order-mobile__state-icon">
        <i class="bi bi-cloud-slash"></i>
      </div>
      <h2>Không thể tải thực đơn</h2>
      <p>{{ loadError }}</p>
      <button class="btn btn-ember" type="button" @click="loadMenu">Tải lại</button>
    </div>

    <div v-else-if="!menu || !menuOptions.length" class="quick-order-mobile__state">
      <div class="quick-order-mobile__state-icon">
        <i class="bi bi-journal-x"></i>
      </div>
      <h2>Hôm nay chưa có menu</h2>
      <p>Quán đang cập nhật món cho hôm nay. Bạn thử lại sau hoặc vào mục đơn của tôi.</p>
      <RouterLink to="/customer/orders" class="btn btn-outline-dark">Xem đơn của tôi</RouterLink>
    </div>

    <QuickOrderComposer
      v-else
      class="quick-order-mobile__composer"
      title="Chọn món & gửi bếp"
      summary=""
      :lines="cartDraftLines"
      :arrival-time="arrivalTime"
      :arrival-mode="arrivalMode"
      :note="note"
      :menu-options="menuOptions"
      :banner-text="menu?.bannerText || ''"
      :meta-chips="metaChips"
      :stock-remaining-map="stockRemainingMap"
      :disabled="submitting || !menu?.id"
      :submit-disabled="submitting || !canSubmit"
      :submitting="submitting"
      :compact="true"
      :framed="false"
      :show-header="false"
      :show-summary="false"
      variant="admin"
      :accordion="true"
      :auto-open-categories="false"
      submit-label="Gửi đơn"
      submitting-label="Đang gửi..."
      empty-title="Chưa có món trong đơn"
      empty-description="Chọn nhóm nguyên liệu và cách nấu bên dưới để thêm món vào đơn."
      @change-qty="handleCartLineChange"
      @update-line-note="updateCartLineNote"
      @remove-line="removeLine"
      @update:arrival-time="arrivalTime = $event"
      @update:arrival-mode="arrivalMode = $event"
      @update:note="note = $event"
      @select-item="addItemDirect"
      @submit="submitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { AxiosError } from "axios";
import { api } from "../../api";
import { socket } from "../../socket";
import QuickOrderComposer from "../common/QuickOrderComposer.vue";

type FeedbackState = {
  type: "success" | "error";
  text: string;
};

type DailyMenuItemData = {
  id: number;
  dailyMenuItemId?: number | null;
  menuItemId?: number | null;
  sellingPrice: number;
  isAvailable: boolean;
  highlightLabel?: string | null;
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

type DailyMenuData = {
  id: number;
  title: string;
  serviceDate: string;
  bannerText?: string | null;
  items: DailyMenuItemData[];
};

type CartLine = {
  key: string;
  dailyMenuItemId?: number;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

const menu = ref<DailyMenuData | null>(null);
const loading = ref(true);
const loadError = ref("");
const feedback = ref<FeedbackState | null>(null);
const submitting = ref(false);
const note = ref("");
const arrivalTime = ref("");
const arrivalMode = ref<"scheduled" | "unknown" | "arrived">("unknown");
const cart = ref<CartLine[]>([]);
const draftKeySeed = ref(0);
const stockRemainingMap = reactive<Record<number, number>>({});

const menuOptions = computed(() =>
  (menu.value?.items ?? []).filter((item) => item.isAvailable && item.menuItem)
);

const cartDraftLines = computed(() =>
  cart.value.map((line) => ({
    key: line.key,
    name: line.name,
    price: line.price,
    quantity: line.quantity,
    note: line.note || "",
  }))
);

const canSubmit = computed(() => Boolean(menu.value?.id && cart.value.length > 0));

const serviceDateLabel = computed(() => formatServiceDate(menu.value?.serviceDate));

const metaChips = computed(() => [
  {
    icon: "bi-calendar2-week",
    text: serviceDateLabel.value,
  },
  {
    icon: "bi-grid",
    text: `${menuOptions.value.length} món có sẵn`,
  },
]);

watch(
  () => cart.value.length,
  (length) => {
    if (!length) {
      note.value = "";
      arrivalTime.value = "";
      arrivalMode.value = "unknown";
    }
  }
);

function normalizeLineNote(value?: string | null) {
  return String(value || "").trim();
}

function buildCartKey(seed: number) {
  draftKeySeed.value += 1;
  return `quick-${seed}-${draftKeySeed.value}`;
}

function getMenuItemId(item: DailyMenuItemData) {
  return Number(item.menuItemId ?? item.menuItem?.id ?? 0);
}

function getMenuOptionKey(item: DailyMenuItemData) {
  const dailyMenuItemId = Number(item.dailyMenuItemId ?? 0);
  if (dailyMenuItemId > 0) {
    return `offer:${dailyMenuItemId}`;
  }
  return `menu:${getMenuItemId(item)}`;
}

function formatServiceDate(value?: string) {
  if (!value) return "Hôm nay";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hôm nay";
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function syncStockFromMenu(menuData: DailyMenuData | null) {
  for (const key of Object.keys(stockRemainingMap)) {
    delete stockRemainingMap[Number(key)];
  }

  for (const item of menuData?.items ?? []) {
    for (const link of item.stockLinks ?? []) {
      const pool = link.stockPool;
      if (pool?.id != null && pool.remainingQuantity != null) {
        stockRemainingMap[pool.id] = Number(pool.remainingQuantity);
      }
    }
  }
}

async function loadMenu() {
  loading.value = true;
  loadError.value = "";

  try {
    const { data } = await api.get<DailyMenuData>("/daily-menus/public/today");
    menu.value = data;
    syncStockFromMenu(data);
  } catch (error) {
    menu.value = null;
    const status = (error as AxiosError)?.response?.status;
    loadError.value =
      status === 404
        ? ""
        : "Kết nối tới hệ thống thực đơn đang gián đoạn. Vui lòng thử lại sau.";
  } finally {
    loading.value = false;
  }
}

function handleStockUpdate(pools: Array<{ id: number; remainingQuantity: number }>) {
  for (const pool of pools || []) {
    stockRemainingMap[pool.id] = Number(pool.remainingQuantity || 0);
  }
}

function addItemDirect(item: DailyMenuItemData) {
  if (!item.menuItem) return;

  const existing = cart.value.find(
    (line) =>
      line.key === getMenuOptionKey(item) &&
      normalizeLineNote(line.note) === ""
  );

  if (existing) {
    existing.quantity += 1;
    return;
  }

  cart.value.push({
    key: buildCartKey(getMenuItemId(item)),
    dailyMenuItemId: item.dailyMenuItemId ?? undefined,
    menuItemId: getMenuItemId(item),
    name: item.menuItem.name,
    price: Number(item.sellingPrice || 0),
    quantity: 1,
    note: "",
  });
}

function handleCartLineChange(payload: { key: string | number; delta: number }) {
  const line = cart.value.find((entry) => entry.key === String(payload.key));
  if (!line) return;

  const nextQuantity = line.quantity + payload.delta;
  if (nextQuantity <= 0) {
    removeLine(line.key);
    return;
  }

  line.quantity = nextQuantity;
}

function updateCartLineNote(payload: { key: string | number; note: string }) {
  const line = cart.value.find((entry) => entry.key === String(payload.key));
  if (!line) return;
  line.note = payload.note;
}

function removeLine(key: string | number) {
  cart.value = cart.value.filter((entry) => entry.key !== String(key));
}

function buildArrivalAt(serviceDate?: string, time?: string) {
  if (!serviceDate || !time) return undefined;
  return `${serviceDate.slice(0, 10)}T${time}`;
}

async function submitOrder() {
  if (!menu.value?.id || !cart.value.length) return;

  submitting.value = true;
  feedback.value = null;

  try {
    const arrivalAt =
      arrivalMode.value === "scheduled"
        ? buildArrivalAt(menu.value.serviceDate, arrivalTime.value)
        : arrivalMode.value === "arrived"
          ? new Date().toISOString()
          : undefined;

    await api.post("/orders", {
      dailyMenuId: menu.value.id,
      arrivalAt,
      note: normalizeLineNote(note.value) || undefined,
      items: cart.value.map((line) => ({
        dailyMenuItemId: line.dailyMenuItemId,
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        note: normalizeLineNote(line.note) || undefined,
      })),
    });

    cart.value = [];
    feedback.value = {
      type: "success",
      text: "Đơn của bạn đã được gửi tới bếp. Bạn có thể theo dõi trạng thái trong mục Đơn của tôi.",
    };
    await loadMenu();
  } catch {
    feedback.value = {
      type: "error",
      text: "Không thể gửi đơn lúc này. Vui lòng kiểm tra kết nối và thử lại.",
    };
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadMenu();
  socket.on("stock:update", handleStockUpdate);
});

onBeforeUnmount(() => {
  socket.off("stock:update", handleStockUpdate);
});
</script>

<style scoped>
.quick-order-mobile {
  display: grid;
  gap: 16px;
  min-height: 100%;
  margin: -24px;
  padding: 16px 16px calc(24px + env(safe-area-inset-bottom));
  background:
    linear-gradient(180deg, rgba(var(--panel-rgb), 0.94), rgba(var(--bg-rgb, 255, 248, 241), 0.92));
}

.quick-order-mobile__topbar {
  position: sticky;
  top: -24px;
  z-index: 10;
  display: grid;
  gap: 4px;
  padding: 14px 16px 8px;
  margin: -16px -16px 0;
  background: rgba(var(--panel-rgb), 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(var(--text-rgb), 0.08);
}

.quick-order-mobile__topbar-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.quick-order-mobile__eyebrow {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.2;
  text-transform: uppercase;
  color: var(--muted);
}

.quick-order-mobile__topbar h1,
.quick-order-mobile__state h2 {
  margin: 0;
  color: var(--text);
}

.quick-order-mobile__feedback,
.quick-order-mobile__state {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(var(--panel-rgb), 0.96);
  border: 1px solid rgba(var(--line-rgb), 0.7);
  box-shadow: var(--shadow);
}

.quick-order-mobile__feedback {
  grid-template-columns: auto 1fr;
  align-items: start;
}

.quick-order-mobile__feedback.is-success {
  color: var(--green);
}

.quick-order-mobile__feedback.is-error {
  color: var(--ember-strong);
}

.quick-order-mobile__state p {
  margin: 0;
  color: var(--muted);
}

.quick-order-mobile__state-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember-strong);
  font-size: 1.1rem;
}

.quick-order-mobile__composer {
  min-width: 0;
  margin-top: -12px;
}
</style>
