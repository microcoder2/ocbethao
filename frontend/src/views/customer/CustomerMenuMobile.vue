<template>
  <div class="customer-menu-mobile">
    <section class="mobile-hero">
      <div class="mobile-hero__head">
        <div>
          <div class="mobile-hero__eyebrow">Đặt món nhanh</div>
          <h1>{{ heroTitle }}</h1>
        </div>
        <RouterLink to="/customer/orders" class="mobile-hero__orders">
          Đơn của tôi
        </RouterLink>
      </div>

      <p class="mobile-hero__summary">{{ heroSummary }}</p>

      <div class="mobile-pill-row">
        <span class="mobile-pill">
          <i class="bi bi-calendar2-week"></i>
          {{ serviceDateLabel }}
        </span>
        <span class="mobile-pill">
          <i class="bi bi-grid"></i>
          {{ categoryCountLabel }}
        </span>
        <span class="mobile-pill">
          <i class="bi bi-stars"></i>
          {{ featuredCountLabel }}
        </span>
      </div>

      <article
        v-if="featuredItem && !loading && !loadError"
        class="mobile-feature-card"
        :style="featuredItemStyle"
      >
        <div class="mobile-feature-card__overlay"></div>
        <div class="mobile-feature-card__body">
          <div class="mobile-feature-card__badge">{{ getHighlightLabel(featuredItem) }}</div>
          <div class="mobile-feature-card__category">{{ getCategoryLabel(featuredItem) }}</div>
          <h2>{{ featuredItem.menuItem?.name || "Món đang cập nhật" }}</h2>
          <p>
            {{
              featuredItem.menuItem?.description ||
              "Món nổi bật hôm nay đang được bếp chuẩn bị để bạn gọi nhanh."
            }}
          </p>
          <div class="mobile-feature-card__footer">
            <strong>{{ formatMoney(featuredItem.sellingPrice) }}</strong>
            <button
              class="btn btn-ember"
              :disabled="!canOrderItem(featuredItem)"
              @click="addToCart(featuredItem)"
            >
              {{ canOrderItem(featuredItem) ? "Thêm món" : "Hết món" }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <div v-if="feedback" :class="['mobile-feedback', `is-${feedback.type}`]">
      <i :class="['bi', feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill']"></i>
      <span>{{ feedback.text }}</span>
    </div>

    <section class="mobile-controls">
      <label class="mobile-search">
        <i class="bi bi-search"></i>
        <input
          v-model.trim="searchQuery"
          type="search"
          placeholder="Tìm món hoặc nhóm món"
        />
      </label>

      <div class="mobile-filter-row">
        <button
          v-for="filter in filterChips"
          :key="filter.key"
          :class="['mobile-filter-chip', { 'is-active': activeFilter === filter.key }]"
          @click="activeFilter = filter.key"
        >
          <span>{{ filter.label }}</span>
          <strong>{{ filter.count }}</strong>
        </button>
      </div>
    </section>

    <section v-if="loading" class="mobile-list">
      <article v-for="placeholder in loadingCards" :key="placeholder" class="mobile-card mobile-card--loading">
        <div class="mobile-card__media skeleton-block"></div>
        <div class="mobile-card__body">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
      </article>
    </section>

    <section v-else-if="loadError" class="mobile-state-card">
      <div class="mobile-state-card__icon">
        <i class="bi bi-cloud-slash"></i>
      </div>
      <h3>Không thể tải thực đơn</h3>
      <p>{{ loadError }}</p>
      <button class="btn btn-ember" @click="loadMenu">Tải lại</button>
    </section>

    <section v-else-if="!menu || menuItems.length === 0" class="mobile-state-card">
      <div class="mobile-state-card__icon">
        <i class="bi bi-journal-x"></i>
      </div>
      <h3>Hôm nay chưa mở bán</h3>
      <p>Bếp đang cập nhật món cho ca hiện tại. Bạn quay lại sau hoặc xem các đơn đã tạo trước đó.</p>
      <RouterLink to="/customer/orders" class="btn btn-outline-dark">Xem đơn của tôi</RouterLink>
    </section>

    <section v-else-if="filteredItems.length === 0" class="mobile-state-card">
      <div class="mobile-state-card__icon">
        <i class="bi bi-sliders"></i>
      </div>
      <h3>Không có món phù hợp</h3>
      <p>Thử đổi bộ lọc hoặc xoá từ khoá tìm kiếm để xem lại toàn bộ thực đơn.</p>
      <button class="btn btn-outline-dark" @click="resetFilters">Hiển thị tất cả</button>
    </section>

    <section v-else class="mobile-list">
      <article
        v-for="(item, index) in filteredItems"
        :key="item.id"
        class="mobile-card"
      >
        <div class="mobile-card__media" :style="getCardMediaStyle(item, index)">
          <span class="mobile-card__badge">{{ getHighlightLabel(item) }}</span>
          <span v-if="getCartQuantity(item)" class="mobile-card__cart-count">
            {{ getCartQuantity(item) }} trong giỏ
          </span>
        </div>

        <div class="mobile-card__body">
          <div class="mobile-card__head">
            <div>
              <div class="mobile-card__category">{{ getCategoryLabel(item) }}</div>
              <h3>{{ item.menuItem?.name || "Món đang cập nhật" }}</h3>
            </div>
            <strong>{{ formatMoney(item.sellingPrice) }}</strong>
          </div>

          <p class="mobile-card__description">
            {{
              item.menuItem?.description ||
              "Mô tả món đang được bếp cập nhật. Bạn vẫn có thể thêm món để giữ chỗ sớm."
            }}
          </p>

          <div class="mobile-card__meta">
            <span>{{ getPreparationLabel(item) }}</span>
            <span>{{ getSpicyLabel(item) }}</span>
            <span>{{ getAvailabilityLabel(item) }}</span>
          </div>

          <div class="mobile-card__footer">
            <button
              class="btn btn-ember"
              :disabled="!canOrderItem(item)"
              @click="addToCart(item)"
            >
              {{ canOrderItem(item) ? "Thêm vào giỏ" : "Tạm hết món" }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <Teleport to="body">
      <div v-if="sheetOpen" class="mobile-cart-sheet">
        <div class="mobile-cart-sheet__backdrop" @click="sheetOpen = false"></div>

        <div class="mobile-cart-sheet__panel">
          <div class="mobile-cart-sheet__header">
            <div>
              <div class="mobile-cart-sheet__eyebrow">Giỏ hàng</div>
              <h2>{{ cartItemCount }} món đang chọn</h2>
            </div>
            <button class="mobile-cart-sheet__close" type="button" @click="sheetOpen = false">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          <OrderDraftPanel
            title="Xác nhận đơn"
            summary="Kiểm tra số lượng và ghi chú trước khi gửi bếp."
            :lines="cartDraftLines"
            :arrival-time="arrivalTime"
            :note="note"
            :disabled="cart.length === 0 || submitting || !menu"
            :submit-disabled="cart.length === 0 || submitting || !menu"
            :submitting="submitting"
            submit-label="Gửi đơn"
            submitting-label="Đang gửi..."
            empty-title="Giỏ hàng đang trống"
            empty-description="Chọn món trong danh sách để thêm vào giỏ."
            :compact="true"
            :framed="false"
            :show-header="false"
            @change-qty="handleCartLineChange"
            @update-line-note="updateCartLineNote"
            @remove-line="removeLine"
            @update:arrival-time="arrivalTime = $event"
            @update:note="note = $event"
            @submit="submitOrderFromSheet"
          />

          <RouterLink to="/customer/orders" class="mobile-cart-sheet__link" @click="sheetOpen = false">
            Xem đơn của tôi
          </RouterLink>
        </div>
      </div>
    </Teleport>

    <button
      v-if="cart.length > 0 && !sheetOpen"
      class="mobile-cart-bar"
      type="button"
      @click="sheetOpen = true"
    >
      <div>
        <span>{{ cartItemCount }} món trong giỏ</span>
        <strong>{{ formatMoney(cartTotal) }}</strong>
      </div>
      <i class="bi bi-chevron-up"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { AxiosError } from "axios";
import { api } from "../../api";
import { socket } from "../../socket";
import OrderDraftPanel from "../../components/common/OrderDraftPanel.vue";
import { API_BASE_URL } from "../../config";
import blankIngredientUrl from "../../assets/blank_ingredient.svg";
import { getUser } from "../../utils/auth";
import { clearCustomerCart, loadCustomerCart, saveCustomerCart } from "../../utils/customerCart";
import { formatMoney } from "../../utils/format";

type FilterKey = "all" | "featured" | `category:${string}`;

type FeedbackState = {
  type: "success" | "error";
  text: string;
};

type MenuCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type MenuItemData = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  unit?: string | null;
  spicyLevel?: number | null;
  imageUrl?: string | null;
  isFeatured?: boolean;
  preparationTimeMin?: number | null;
  category?: MenuCategory | null;
};

type CatalogItemData = {
  id: number;
  menuItemId?: number | null;
  quantity?: number | null;
  soldQuantity?: number;
  availableQuantity?: number | null;
  sellingPrice: number;
  isAvailable: boolean;
  highlightLabel?: string | null;
  menuItem?: MenuItemData | null;
};

type CatalogData = {
  id: number;
  title: string;
  serviceDate: string;
  note?: string | null;
  bannerText?: string | null;
  items: CatalogItemData[];
};

type CartLine = {
  key: string;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

const currentUser = getUser();
const menu = ref<CatalogData | null>(null);
const cart = ref<CartLine[]>(loadCustomerCart());
const note = ref("");
const arrivalTime = ref("");
const loading = ref(true);
const loadError = ref("");
const searchQuery = ref("");
const activeFilter = ref<FilterKey>("all");
const feedback = ref<FeedbackState | null>(null);
const submitting = ref(false);
const sheetOpen = ref(false);

const loadingCards = [1, 2, 3, 4, 5, 6];
const paletteOverlays = [
  "linear-gradient(160deg, rgba(var(--panel-alt-rgb), 0.28), rgba(var(--panel-alt-rgb), 0.78)), radial-gradient(circle at top right, rgba(var(--ember-rgb), 0.48), transparent 34%)",
  "linear-gradient(160deg, rgba(var(--sidebar-bg-mid-rgb), 0.28), rgba(var(--panel-alt-rgb), 0.76)), radial-gradient(circle at top right, rgba(var(--ember-rgb), 0.4), transparent 36%)",
  "linear-gradient(160deg, rgba(var(--sidebar-bg-mid-rgb), 0.24), rgba(var(--sidebar-bg-mid-rgb), 0.78)), radial-gradient(circle at top right, rgba(var(--green-rgb), 0.4), transparent 36%)",
  "linear-gradient(160deg, rgba(var(--panel-alt-rgb), 0.22), rgba(var(--sidebar-bg-mid-rgb), 0.76)), radial-gradient(circle at top right, rgba(var(--gold-rgb), 0.42), transparent 34%)",
];

const menuItems = computed(() => menu.value?.items ?? []);

const categories = computed(() => {
  const map = new Map<string, { slug: string; name: string; count: number }>();

  for (const item of menuItems.value) {
    const category = item.menuItem?.category;
    if (!category) continue;

    const existing = map.get(category.slug);
    if (existing) {
      existing.count += 1;
      continue;
    }

    map.set(category.slug, {
      slug: category.slug,
      name: category.name,
      count: 1,
    });
  }

  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name, "vi"));
});

const filterChips = computed(() => [
  {
    key: "all" as FilterKey,
    label: "Tất cả",
    count: menuItems.value.length,
  },
  {
    key: "featured" as FilterKey,
    label: "Nổi bật",
    count: menuItems.value.filter((item) => isFeaturedItem(item)).length,
  },
  ...categories.value.map((category) => ({
    key: `category:${category.slug}` as FilterKey,
    label: category.name,
    count: category.count,
  })),
]);

const filteredItems = computed(() => {
  const keyword = normalizeText(searchQuery.value);

  return [...menuItems.value]
    .filter((item) => {
      if (activeFilter.value === "featured" && !isFeaturedItem(item)) {
        return false;
      }

      if (
        activeFilter.value.startsWith("category:") &&
        item.menuItem?.category?.slug !== activeFilter.value.replace("category:", "")
      ) {
        return false;
      }

      if (!keyword) return true;

      const searchable = normalizeText(
        [
          item.menuItem?.name,
          item.menuItem?.description,
          item.menuItem?.category?.name,
          item.highlightLabel,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchable.includes(keyword);
    })
    .sort((left, right) => {
      const featuredDiff = Number(isFeaturedItem(right)) - Number(isFeaturedItem(left));
      if (featuredDiff !== 0) return featuredDiff;

      const availabilityDiff = Number(canOrderItem(right)) - Number(canOrderItem(left));
      if (availabilityDiff !== 0) return availabilityDiff;

      return Number(left.sellingPrice) - Number(right.sellingPrice);
    });
});

const featuredItem = computed(
  () => menuItems.value.find((item) => isFeaturedItem(item)) || menuItems.value[0] || null
);

const featuredItemStyle = computed(() =>
  featuredItem.value
    ? getCardMediaStyle(featuredItem.value, 0)
    : {
        backgroundImage:
          "linear-gradient(160deg, rgba(var(--panel-alt-rgb), 0.96), rgba(var(--sidebar-bg-mid-rgb), 0.9)), radial-gradient(circle at top right, rgba(var(--ember-rgb), 0.42), transparent 34%)",
      }
);

const heroTitle = computed(() => {
  const firstName = currentUser?.fullName?.split(" ").filter(Boolean).pop();
  return firstName ? `Chào ${firstName}` : "Thực đơn hôm nay";
});

const heroSummary = computed(
  () =>
    menu.value?.bannerText ||
    "Chọn món nhanh, xem giá rõ ràng và gửi đơn trực tiếp tới bếp ngay trên điện thoại."
);

const serviceDateLabel = computed(() => formatServiceDate(menu.value?.serviceDate));
const categoryCountLabel = computed(() => `${categories.value.length || 0} nhóm món`);
const featuredCountLabel = computed(
  () => `${menuItems.value.filter((item) => isFeaturedItem(item)).length || 0} món nổi bật`
);

const cartItemCount = computed(() =>
  cart.value.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
);
const cartTotal = computed(() =>
  cart.value.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0)
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

watch(
  cart,
  (value) => {
    saveCustomerCart(value);
    if (!value.length) {
      sheetOpen.value = false;
    }
  },
  { deep: true, immediate: true }
);

async function loadMenu() {
  loading.value = true;
  loadError.value = "";

  try {
    const { data } = await api.get<CatalogData>("/menu-items/public");
    menu.value = data;
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

function addToCart(item: CatalogItemData) {
  if (!canOrderItem(item)) return;

  feedback.value = null;
  const key = getMenuOptionKey(item);
  const existing = cart.value.find((line) => line.key === key);
  if (existing) {
    existing.quantity += 1;
    return;
  }

  cart.value.push({
    key,
    menuItemId: getMenuItemId(item),
    name: item.menuItem?.name || "Món đang cập nhật",
    price: Number(item.sellingPrice || 0),
    quantity: 1,
    note: "",
  });
}

function changeQty(line: CartLine, delta: number) {
  const nextQuantity = line.quantity + delta;
  if (nextQuantity <= 0) {
    removeLine(line.key);
    return;
  }

  line.quantity = nextQuantity;
}

function removeLine(key: string) {
  cart.value = cart.value.filter((line) => line.key !== key);
}

function handleCartLineChange(payload: { key: string | number; delta: number }) {
  const line = cart.value.find((entry) => entry.key === String(payload.key));
  if (!line) return;
  changeQty(line, payload.delta);
}

function updateCartLineNote(payload: { key: string | number; note: string }) {
  const line = cart.value.find((entry) => entry.key === String(payload.key));
  if (!line) return;
  line.note = payload.note;
}

function buildArrivalAt(serviceDate?: string, time?: string) {
  if (!serviceDate || !time) {
    return undefined;
  }

  return `${serviceDate.slice(0, 10)}T${time}`;
}

async function submitOrder() {
  if (!menu.value || cart.value.length === 0) return;
  const authUser = getUser();
  if (!authUser || String(authUser.role || "").toUpperCase() !== "CUSTOMER") {
    feedback.value = {
      type: "error",
      text: "Vui lòng đăng nhập để gửi đơn. Giỏ hàng của bạn vẫn được giữ lại.",
    };
    window.location.hash = "#/login";
    return;
  }

  submitting.value = true;
  feedback.value = null;

  try {
    await api.post("/orders", {
      arrivalAt: buildArrivalAt(menu.value.serviceDate, arrivalTime.value),
      note: note.value,
      items: cart.value.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        note: line.note?.trim() || undefined,
      })),
    });

    cart.value = [];
    clearCustomerCart();
    note.value = "";
    arrivalTime.value = "";
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

async function submitOrderFromSheet() {
  await submitOrder();

  if (cart.value.length === 0) {
    sheetOpen.value = false;
  }
}

function resetFilters() {
  searchQuery.value = "";
  activeFilter.value = "all";
}

function getMenuItemId(item: CatalogItemData) {
  return Number(item.menuItemId ?? item.menuItem?.id ?? 0);
}

function getMenuOptionKey(item: CatalogItemData) {
  return `menu:${getMenuItemId(item)}`;
}

function getCartQuantity(item: CatalogItemData) {
  return cart.value.find((line) => line.key === getMenuOptionKey(item))?.quantity || 0;
}

function canOrderItem(item: CatalogItemData) {
  return Boolean(item.isAvailable) && item.availableQuantity !== 0;
}

function getCategoryLabel(item: CatalogItemData) {
  return item.menuItem?.category?.name || "Thực đơn trong ngày";
}

function getHighlightLabel(item: CatalogItemData) {
  if (item.highlightLabel) return item.highlightLabel;
  if (item.menuItem?.isFeatured) return "Món đặc sắc";
  return "Phục vụ hôm nay";
}

function getPreparationLabel(item: CatalogItemData) {
  const prepTime = Number(item.menuItem?.preparationTimeMin || 0);
  if (!prepTime) return "Ra món nhanh";
  return `${prepTime} phút chuẩn bị`;
}

function getSpicyLabel(item: CatalogItemData) {
  const spicyLevel = Number(item.menuItem?.spicyLevel ?? 0);
  if (spicyLevel <= 0) return "Không cay";
  if (spicyLevel === 1) return "Cay nhẹ";
  if (spicyLevel === 2) return "Cay vừa";
  return "Cay đậm vị";
}

function getAvailabilityLabel(item: CatalogItemData) {
  if (!item.isAvailable || item.availableQuantity === 0) {
    return "Tạm hết món";
  }

  if (item.availableQuantity === null || item.availableQuantity === undefined) {
    return "Phục vụ linh hoạt";
  }

  if (item.availableQuantity <= 5) {
    return `Còn ${item.availableQuantity} ${item.menuItem?.unit || "phần"}`;
  }

  return `Sẵn sàng ${item.availableQuantity} ${item.menuItem?.unit || "phần"}`;
}

function isFeaturedItem(item: CatalogItemData) {
  return Boolean(item.menuItem?.isFeatured || item.highlightLabel);
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatServiceDate(value?: string) {
  if (!value) return "Phục vụ hôm nay";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Phục vụ hôm nay";

  const formatted = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function resolveImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return new URL(imageUrl, API_BASE_URL).toString();
}

function getCardMediaStyle(item: CatalogItemData, index: number) {
  const palette = paletteOverlays[index % paletteOverlays.length];
  const imageUrl = resolveImageUrl(item.menuItem?.imageUrl);

  if (imageUrl) {
    return {
      backgroundColor: "rgba(var(--panel-rgb), 0.94)",
      backgroundImage: `${palette}, url("${imageUrl}"), url("${blankIngredientUrl}")`,
      backgroundPosition: "center, center, center, center",
      backgroundSize: "auto, auto, cover, 54%",
      backgroundRepeat: "no-repeat, no-repeat, no-repeat, no-repeat",
    };
  }

  return {
    backgroundColor: "rgba(var(--panel-rgb), 0.94)",
    backgroundImage: `${palette}, url("${blankIngredientUrl}")`,
    backgroundPosition: "center, center, center",
    backgroundSize: "auto, auto, 54%",
    backgroundRepeat: "no-repeat, no-repeat, no-repeat",
  };
}

async function silentRefreshMenu() {
  try {
    const { data } = await api.get<CatalogData>("/menu-items/public");
    menu.value = data;
  } catch {
    // Ignore refresh failures and keep the last successful menu.
  }
}

onMounted(() => {
  void loadMenu();
  socket.on("stock:update", silentRefreshMenu);
});

onBeforeUnmount(() => {
  socket.off("stock:update", silentRefreshMenu);
});
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap");

.customer-menu-mobile {
  --mobile-surface: rgba(var(--panel-rgb), 0.96);
  --mobile-panel: rgba(var(--panel-rgb), 0.92);
  --mobile-ink: var(--text);
  --mobile-muted: var(--muted);
  --mobile-line: rgba(var(--line-rgb), 0.72);
  --mobile-accent: var(--ember);
  --mobile-accent-strong: var(--ember-strong);
  --mobile-shadow: var(--shadow);
  font-family: "Be Vietnam Pro", sans-serif;
  display: grid;
  gap: 16px;
  padding: 4px 0 92px;
}

.mobile-hero,
.mobile-controls,
.mobile-state-card,
.mobile-card {
  border: 1px solid var(--mobile-line);
  background: var(--mobile-panel);
  border-radius: 24px;
  box-shadow: var(--mobile-shadow);
}

.mobile-hero {
  display: grid;
  gap: 16px;
  padding: 20px;
  background:
    radial-gradient(circle at top right, rgba(var(--ember-rgb), 0.18), transparent 32%),
    linear-gradient(180deg, rgba(var(--panel-rgb), 0.98), rgba(var(--panel-rgb), 0.9));
}

.mobile-hero__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.mobile-hero__eyebrow,
.mobile-cart-sheet__eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mobile-accent-strong);
  font-weight: 700;
}

.mobile-hero h1,
.mobile-feature-card h2,
.mobile-cart-sheet__header h2,
.mobile-state-card h3,
.mobile-card h3 {
  margin: 0;
  color: var(--mobile-ink);
}

.mobile-hero h1 {
  font-size: 1.6rem;
  line-height: 1.15;
}

.mobile-hero__orders {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--mobile-accent-strong);
  font-weight: 700;
  text-decoration: none;
}

.mobile-hero__summary,
.mobile-feature-card p,
.mobile-state-card p,
.mobile-card__description,
.mobile-feedback span {
  margin: 0;
  color: var(--mobile-muted);
  line-height: 1.55;
}

.mobile-pill-row,
.mobile-filter-row,
.mobile-card__meta {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.mobile-pill-row::-webkit-scrollbar,
.mobile-filter-row::-webkit-scrollbar,
.mobile-card__meta::-webkit-scrollbar {
  display: none;
}

.mobile-pill,
.mobile-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(var(--panel-rgb), 0.86);
  color: var(--mobile-ink);
  white-space: nowrap;
  font-size: 0.86rem;
}

.mobile-feature-card {
  position: relative;
  overflow: hidden;
  min-height: 220px;
  border-radius: 22px;
  background-size: cover;
  background-position: center;
  color: var(--sidebar-fg);
}

.mobile-feature-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(var(--panel-alt-rgb), 0.05), rgba(var(--panel-alt-rgb), 0.68));
}

.mobile-feature-card__body {
  position: relative;
  z-index: 1;
  height: 100%;
  display: grid;
  align-content: end;
  gap: 10px;
  padding: 18px;
}

.mobile-feature-card__badge,
.mobile-card__badge,
.mobile-card__cart-count {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}

.mobile-feature-card__badge,
.mobile-card__badge {
  width: fit-content;
  background: rgba(var(--sidebar-fg-rgb), 0.18);
  color: var(--sidebar-fg);
  backdrop-filter: blur(10px);
}

.mobile-feature-card__category,
.mobile-card__category {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--sidebar-fg-rgb), 0.82);
}

.mobile-feature-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.mobile-feature-card__footer strong {
  font-size: 1.1rem;
}

.mobile-feedback {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 18px;
  font-weight: 600;
}

.mobile-feedback.is-success {
  background: rgba(var(--green-rgb), 0.12);
  color: var(--green);
}

.mobile-feedback.is-error {
  background: rgba(var(--ember-rgb), 0.12);
  color: var(--mobile-accent-strong);
}

.mobile-controls {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.mobile-search {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 50px;
  padding: 0 16px;
  border-radius: 18px;
  border: 1px solid rgba(var(--line-rgb), 0.68);
  background: rgba(var(--panel-rgb), 0.96);
  color: var(--mobile-muted);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.mobile-search input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--mobile-ink);
  font: inherit;
}

.mobile-search input:focus {
  outline: none;
}

.mobile-search:focus-within {
  border-color: rgba(var(--ember-rgb), 0.32);
  box-shadow: 0 0 0 3px rgba(var(--ember-rgb), 0.12);
}

.mobile-filter-chip {
  display: inline-grid;
  gap: 2px;
  min-width: fit-content;
  padding: 10px 14px;
  border-radius: 18px;
  border: 1px solid rgba(var(--line-rgb), 0.68);
  background: rgba(var(--panel-rgb), 0.9);
  color: var(--mobile-muted);
}

.mobile-filter-chip.is-active {
  background: linear-gradient(135deg, var(--mobile-accent), var(--mobile-accent-strong));
  color: var(--sidebar-fg);
  border-color: transparent;
}

.mobile-filter-chip span {
  font-size: 0.82rem;
  white-space: nowrap;
}

.mobile-filter-chip strong {
  text-align: left;
  font-size: 0.95rem;
}

.mobile-list {
  display: grid;
  gap: 14px;
}

.mobile-card {
  overflow: hidden;
}

.mobile-card__media {
  position: relative;
  min-height: 148px;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background-size: cover;
  background-position: center;
}

.mobile-card__cart-count {
  background: rgba(var(--panel-rgb), 0.92);
  color: var(--mobile-accent-strong);
}

.mobile-card__body {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.mobile-card__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.mobile-card__head strong {
  color: var(--mobile-accent-strong);
  font-size: 1rem;
  white-space: nowrap;
}

.mobile-card__category {
  color: var(--mobile-muted);
}

.mobile-card__footer .btn {
  width: 100%;
  min-height: 46px;
  font-weight: 700;
}

.mobile-state-card {
  display: grid;
  gap: 12px;
  justify-items: center;
  text-align: center;
  padding: 28px 20px;
}

.mobile-state-card__icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--mobile-accent-strong);
  font-size: 1.35rem;
}

.mobile-cart-bar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border: 0;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--mobile-accent), var(--mobile-accent-strong));
  color: var(--sidebar-fg);
  box-shadow: 0 24px 38px rgba(var(--ember-rgb), 0.34);
}

.mobile-cart-bar span,
.mobile-cart-bar strong {
  display: block;
  text-align: left;
}

.mobile-cart-bar span {
  font-size: 0.82rem;
  opacity: 0.92;
}

.mobile-cart-bar strong {
  font-size: 1.02rem;
}

.mobile-cart-sheet {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.mobile-cart-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: var(--overlay);
}

.mobile-cart-sheet__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: min(84vh, 720px);
  max-height: min(84dvh, 720px);
  overflow: auto;
  display: grid;
  gap: 16px;
  padding: 18px 16px calc(24px + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: rgba(var(--panel-rgb), 0.98);
  box-shadow: 0 -20px 40px rgba(var(--panel-alt-rgb), 0.16);
  overscroll-behavior: contain;
}

.mobile-cart-sheet__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.mobile-cart-sheet__close {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--mobile-accent-strong);
}

.mobile-cart-sheet__link {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: 44px;
  border-radius: 16px;
  border: 1px solid rgba(var(--line-rgb), 0.72);
  color: var(--mobile-ink);
  text-decoration: none;
  font-weight: 700;
}

.mobile-card--loading .mobile-card__media,
.skeleton-block,
.skeleton-line {
  background:
    linear-gradient(90deg, rgba(var(--line-rgb), 0.42) 25%, rgba(var(--panel-rgb), 0.96) 50%, rgba(var(--line-rgb), 0.42) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

.skeleton-line {
  height: 12px;
  border-radius: 999px;
}

.skeleton-line--title {
  width: 68%;
  height: 16px;
}

.skeleton-line--short {
  width: 46%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
