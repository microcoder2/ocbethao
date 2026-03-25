<template>
  <div class="customer-menu-page">
    <section class="customer-hero">
      <div class="customer-hero__copy">
        <div class="customer-hero__eyebrow">Đặt món trực tuyến</div>
        <h1>{{ heroTitle }}</h1>
        <p class="customer-hero__summary">
          {{ heroSummary }}
        </p>

        <div class="customer-hero__chips">
          <span class="customer-chip customer-chip--light">
            <i class="bi bi-calendar2-week"></i>
            {{ serviceDateLabel }}
          </span>
          <span class="customer-chip customer-chip--light">
            <i class="bi bi-grid"></i>
            {{ categoryCountLabel }}
          </span>
          <span class="customer-chip customer-chip--light">
            <i class="bi bi-stars"></i>
            {{ featuredCountLabel }}
          </span>
        </div>

        <div class="customer-hero__stats">
          <article v-for="stat in heroStats" :key="stat.label" class="hero-stat-card">
            <div class="hero-stat-card__icon">
              <i :class="['bi', stat.icon]"></i>
            </div>
            <div>
              <div class="hero-stat-card__value">{{ stat.value }}</div>
              <div class="hero-stat-card__label">{{ stat.label }}</div>
            </div>
          </article>
        </div>
      </div>

      <div class="customer-hero__feature">
        <div class="feature-showcase" :style="featuredItemStyle">
          <div class="feature-showcase__overlay"></div>
          <div class="feature-showcase__body">
            <div class="feature-showcase__badges">
              <span class="customer-chip customer-chip--dark">
                <i class="bi bi-award"></i>
                {{ featuredBadgeLabel }}
              </span>
              <span class="customer-chip customer-chip--dark">
                <i class="bi bi-clock-history"></i>
                {{ featuredPrepLabel }}
              </span>
            </div>

            <div class="feature-showcase__category">{{ featuredCategoryLabel }}</div>
            <h2>{{ featuredNameLabel }}</h2>
            <p>{{ featuredDescriptionLabel }}</p>

            <div class="feature-showcase__footer">
              <div>
                <div class="feature-showcase__price-label">Giá phục vụ hôm nay</div>
                <div class="feature-showcase__price">{{ featuredPriceLabel }}</div>
              </div>
              <button
                class="btn btn-ember feature-showcase__button"
                :disabled="!featuredItem || !canOrderItem(featuredItem)"
                @click="featuredItem && addToCart(featuredItem)"
              >
                {{ featuredItem ? "Thêm món nổi bật" : "Đang cập nhật thực đơn" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="feedback" :class="['customer-feedback', `is-${feedback.type}`]">
      <i :class="['bi', feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill']"></i>
      <span>{{ feedback.text }}</span>
    </div>

    <section class="customer-layout">
      <div class="customer-layout__main">
        <div class="customer-toolbar">
          <div>
            <div class="customer-toolbar__eyebrow">Khám phá món</div>
            <h2>{{ toolbarTitle }}</h2>
            <p>{{ toolbarSummary }}</p>
          </div>

          <label class="customer-search">
            <i class="bi bi-search"></i>
            <input
              v-model.trim="searchQuery"
              type="search"
              placeholder="Tìm theo tên món, hương vị hoặc nhóm món"
            />
          </label>
        </div>

        <div class="customer-filters">
          <button
            v-for="filter in filterChips"
            :key="filter.key"
            :class="['customer-filter-chip', { 'is-active': activeFilter === filter.key }]"
            @click="activeFilter = filter.key"
          >
            <span>{{ filter.label }}</span>
            <strong>{{ filter.count }}</strong>
          </button>
        </div>

        <div v-if="loading" class="dish-grid">
          <article v-for="placeholder in loadingCards" :key="placeholder" class="dish-card dish-card--loading">
            <div class="dish-card__media skeleton-block"></div>
            <div class="dish-card__body">
              <div class="skeleton-line skeleton-line--title"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line skeleton-line--short"></div>
              <div class="skeleton-line skeleton-line--wide"></div>
            </div>
          </article>
        </div>

        <div v-else-if="loadError" class="customer-state-card">
          <div class="customer-state-card__icon">
            <i class="bi bi-cloud-slash"></i>
          </div>
          <h3>Không thể tải thực đơn lúc này</h3>
          <p>{{ loadError }}</p>
          <button class="btn btn-ember" @click="loadMenu">Tải lại thực đơn</button>
        </div>

        <div v-else-if="!menu || menuItems.length === 0" class="customer-state-card">
          <div class="customer-state-card__icon">
            <i class="bi bi-journal-x"></i>
          </div>
          <h3>Chưa có thực đơn đang mở bán</h3>
          <p>Quán đang cập nhật món cho hôm nay. Bạn quay lại sau ít phút hoặc xem các đơn đã đặt trước đó.</p>
          <RouterLink to="/customer/orders" class="btn btn-outline-dark">Xem đơn của tôi</RouterLink>
        </div>

        <div v-else-if="filteredItems.length === 0" class="customer-state-card">
          <div class="customer-state-card__icon">
            <i class="bi bi-sliders"></i>
          </div>
          <h3>Không có món phù hợp bộ lọc hiện tại</h3>
          <p>Thử đổi nhóm món hoặc xoá từ khoá tìm kiếm để xem đầy đủ thực đơn hôm nay.</p>
          <button class="btn btn-outline-dark" @click="resetFilters">Hiển thị toàn bộ món</button>
        </div>

        <div v-else class="dish-grid">
          <article
            v-for="(item, index) in filteredItems"
            :key="item.id"
            class="dish-card"
          >
            <div class="dish-card__media" :style="getCardMediaStyle(item, index)">
              <div class="dish-card__media-badges">
                <span class="customer-chip customer-chip--dark">
                  <i class="bi bi-lightning-charge-fill"></i>
                  {{ getHighlightLabel(item) }}
                </span>
                <span class="customer-chip customer-chip--dark">
                  <i class="bi bi-stopwatch"></i>
                  {{ getPreparationLabel(item) }}
                </span>
              </div>

              <div class="dish-card__media-caption">
                <div class="dish-card__category">{{ getCategoryLabel(item) }}</div>
                <div class="dish-card__name">{{ item.menuItem?.name || "Món đang cập nhật" }}</div>
              </div>
            </div>

            <div class="dish-card__body">
              <p class="dish-card__description">
                {{ item.menuItem?.description || "Món đang được đội ngũ bếp hoàn thiện mô tả hương vị cho hôm nay." }}
              </p>

              <div class="dish-card__meta">
                <span>
                  <i class="bi bi-fire"></i>
                  {{ getSpicyLabel(item) }}
                </span>
                <span>
                  <i class="bi bi-box-seam"></i>
                  {{ getAvailabilityLabel(item) }}
                </span>
                <span>
                  <i class="bi bi-egg-fried"></i>
                  {{ getUnitLabel(item) }}
                </span>
              </div>

              <div class="dish-card__footer">
                <div>
                  <div class="dish-card__price-label">Giá hôm nay</div>
                  <div class="dish-card__price">{{ formatMoney(item.sellingPrice) }}</div>
                </div>

                <div class="dish-card__actions">
                  <div v-if="getCartQuantity(item.id)" class="dish-card__quantity-pill">
                    {{ getCartQuantity(item.id) }} trong giỏ
                  </div>
                  <button
                    class="btn btn-ember"
                    :disabled="!canOrderItem(item)"
                    @click="addToCart(item)"
                  >
                    {{ canOrderItem(item) ? "Thêm vào giỏ" : "Tạm hết món" }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <aside id="customer-cart" class="customer-layout__aside">
        <div class="customer-cart">
          <div class="customer-cart__header">
            <div>
              <div class="customer-cart__eyebrow">Giỏ hàng của bạn</div>
              <h2>Xác nhận đơn thật nhanh</h2>
              <p>Kiểm tra món, số lượng và ghi chú cho bếp trước khi gửi đơn.</p>
            </div>
            <RouterLink to="/customer/orders" class="customer-cart__link">Đơn của tôi</RouterLink>
          </div>

          <div class="customer-cart__summary">
            <div class="customer-cart__summary-item">
              <span>Món đã chọn</span>
              <strong>{{ cartItemCount }}</strong>
            </div>
            <div class="customer-cart__summary-item">
              <span>Món khác nhau</span>
              <strong>{{ cart.length }}</strong>
            </div>
            <div class="customer-cart__summary-item">
              <span>Tạm tính</span>
              <strong>{{ formatMoney(cartTotal) }}</strong>
            </div>
          </div>

          <div v-if="cart.length === 0" class="customer-cart__empty">
            <div class="customer-cart__empty-icon">
              <i class="bi bi-basket3"></i>
            </div>
            <h3>Giỏ hàng đang trống</h3>
            <p>Chọn món bạn yêu thích ở danh sách bên trái. Mỗi lần bấm thêm món, giỏ hàng sẽ cập nhật ngay.</p>
          </div>

          <div v-else class="customer-cart__lines">
            <article v-for="line in cart" :key="line.dailyMenuItemId" class="cart-line">
              <div class="cart-line__body">
                <div class="cart-line__name">{{ line.name }}</div>
                <div class="cart-line__meta">
                  <span>{{ formatMoney(line.price) }} / món</span>
                  <span>{{ formatMoney(line.price * line.quantity) }}</span>
                </div>
              </div>

              <div class="cart-line__controls">
                <div class="cart-stepper">
                  <button class="cart-stepper__button" @click="changeQty(line, -1)">
                    <i class="bi bi-dash"></i>
                  </button>
                  <span>{{ line.quantity }}</span>
                  <button class="cart-stepper__button" @click="changeQty(line, 1)">
                    <i class="bi bi-plus"></i>
                  </button>
                </div>

                <button class="cart-remove-button" @click="removeLine(line.dailyMenuItemId)">
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            </article>
          </div>

          <label class="customer-note">
            <span>Ghi chú cho bếp</span>
            <textarea
              v-model="note"
              rows="4"
              placeholder="Ví dụ: ít cay, thêm rau răm, tách riêng nước chấm..."
            ></textarea>
          </label>

          <div class="customer-cart__totals">
            <div class="customer-cart__total-row">
              <span>Tạm tính</span>
              <strong>{{ formatMoney(cartTotal) }}</strong>
            </div>
            <div class="customer-cart__total-row customer-cart__total-row--muted">
              <span>Phí dịch vụ</span>
              <strong>Miễn phí</strong>
            </div>
            <div class="customer-cart__total-row customer-cart__total-row--grand">
              <span>Tổng cần xác nhận</span>
              <strong>{{ formatMoney(cartTotal) }}</strong>
            </div>
          </div>

          <button
            class="btn btn-ember customer-cart__submit"
            :disabled="cart.length === 0 || submitting || !menu?.id"
            @click="submitOrder"
          >
            <span v-if="submitting">Đang gửi đơn tới bếp...</span>
            <span v-else>Gửi đơn ngay</span>
          </button>
        </div>
      </aside>
    </section>

    <button
      v-if="cart.length > 0"
      class="customer-cart-fab d-xl-none"
      @click="scrollToCart"
    >
      <span>{{ cartItemCount }} món trong giỏ</span>
      <strong>{{ formatMoney(cartTotal) }}</strong>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AxiosError } from "axios";
import { api } from "../../api";
import { API_BASE_URL } from "../../config";
import { getUser } from "../../utils/auth";
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

type DailyMenuItemData = {
  id: number;
  quantity?: number | null;
  soldQuantity?: number;
  availableQuantity?: number | null;
  sellingPrice: number;
  isAvailable: boolean;
  highlightLabel?: string | null;
  menuItem?: MenuItemData | null;
};

type DailyMenuData = {
  id: number;
  title: string;
  serviceDate: string;
  note?: string | null;
  bannerText?: string | null;
  items: DailyMenuItemData[];
};

type CartLine = {
  dailyMenuItemId: number;
  name: string;
  price: number;
  quantity: number;
};

const currentUser = getUser();
const menu = ref<DailyMenuData | null>(null);
const cart = ref<CartLine[]>([]);
const note = ref("");
const loading = ref(true);
const loadError = ref("");
const searchQuery = ref("");
const activeFilter = ref<FilterKey>("all");
const feedback = ref<FeedbackState | null>(null);
const submitting = ref(false);

const loadingCards = [1, 2, 3, 4, 5, 6];
const paletteOverlays = [
  "linear-gradient(160deg, rgba(22, 30, 32, 0.2), rgba(22, 30, 32, 0.72)), radial-gradient(circle at top right, rgba(255, 187, 92, 0.48), transparent 34%)",
  "linear-gradient(160deg, rgba(51, 17, 16, 0.22), rgba(51, 17, 16, 0.72)), radial-gradient(circle at top right, rgba(255, 145, 77, 0.44), transparent 36%)",
  "linear-gradient(160deg, rgba(8, 36, 38, 0.18), rgba(8, 36, 38, 0.76)), radial-gradient(circle at top right, rgba(100, 214, 179, 0.4), transparent 36%)",
  "linear-gradient(160deg, rgba(31, 23, 43, 0.18), rgba(31, 23, 43, 0.74)), radial-gradient(circle at top right, rgba(255, 205, 137, 0.42), transparent 34%)",
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
  return Array.from(map.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "vi")
  );
});

const filterChips = computed(() => [
  {
    key: "all" as FilterKey,
    label: "Tất cả món",
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

const heroTitle = computed(() => {
  const firstName = currentUser?.fullName?.split(" ").filter(Boolean).pop();
  return firstName ? `Chào ${firstName}, chọn món thật tinh tế hôm nay` : "Khám phá thực đơn hôm nay";
});

const heroSummary = computed(
  () =>
    menu.value?.bannerText ||
    "Bộ sưu tập món được mở bán theo ngày, tối ưu cho trải nghiệm đặt món nhanh, rõ ràng và nhiều cảm hứng."
);

const serviceDateLabel = computed(() => formatServiceDate(menu.value?.serviceDate));
const categoryCountLabel = computed(() => `${categories.value.length || 0} nhóm món`);
const featuredCountLabel = computed(
  () => `${menuItems.value.filter((item) => isFeaturedItem(item)).length || 0} món nổi bật`
);

const cartItemCount = computed(() =>
  cart.value.reduce((sum, line) => sum + line.quantity, 0)
);
const cartTotal = computed(() =>
  cart.value.reduce((sum, line) => sum + line.price * line.quantity, 0)
);

const heroStats = computed(() => {
  const availableNow = menuItems.value.filter((item) => canOrderItem(item)).length;
  const averagePrepTime =
    menuItems.value
      .map((item) => Number(item.menuItem?.preparationTimeMin || 0))
      .filter((value) => value > 0)
      .reduce((sum, value, _index, array) => sum + value / array.length, 0) || 0;

  return [
    {
      label: "Món đang mở bán",
      value: String(availableNow).padStart(2, "0"),
      icon: "bi-basket2",
    },
    {
      label: "Chuẩn bị trung bình",
      value: averagePrepTime ? `${Math.round(averagePrepTime)} phút` : "Nhanh",
      icon: "bi-clock",
    },
    {
      label: customerTierLabel(currentUser?.customerType),
      value: `${cartItemCount.value} món`,
      icon: "bi-heart",
    },
  ];
});

const featuredNameLabel = computed(
  () => featuredItem.value?.menuItem?.name || "Thực đơn đang cập nhật"
);
const featuredDescriptionLabel = computed(
  () =>
    featuredItem.value?.menuItem?.description ||
    menu.value?.note ||
    "Bếp đang chuẩn bị những món đặc sắc nhất để bạn chọn ngay trong hôm nay."
);
const featuredCategoryLabel = computed(
  () => featuredItem.value?.menuItem?.category?.name || "Lựa chọn trong ngày"
);
const featuredPriceLabel = computed(() =>
  featuredItem.value ? formatMoney(featuredItem.value.sellingPrice) : "Đang cập nhật"
);
const featuredPrepLabel = computed(() =>
  featuredItem.value ? getPreparationLabel(featuredItem.value) : "Phục vụ trong ngày"
);
const featuredBadgeLabel = computed(() =>
  featuredItem.value ? getHighlightLabel(featuredItem.value) : "Món tuyển chọn"
);

const featuredItemStyle = computed(() => {
  if (!featuredItem.value) {
    return {
      backgroundImage:
        "linear-gradient(160deg, rgba(28, 20, 18, 0.96), rgba(48, 29, 24, 0.9)), radial-gradient(circle at top right, rgba(255, 183, 94, 0.42), transparent 34%)",
    };
  }

  return getCardMediaStyle(featuredItem.value, 0);
});

const toolbarTitle = computed(() => {
  if (activeFilter.value === "featured") return "Những món được ưu tiên giới thiệu hôm nay";
  if (activeFilter.value.startsWith("category:")) {
    const slug = activeFilter.value.replace("category:", "");
    const category = categories.value.find((item) => item.slug === slug);
    return category ? `Khám phá nhóm ${category.name}` : "Khám phá thực đơn";
  }
  return "Thực đơn được tuyển chọn trong ngày";
});

const toolbarSummary = computed(() => {
  const total = filteredItems.value.length;
  const search = searchQuery.value ? ` theo từ khoá "${searchQuery.value}"` : "";
  return `Hiển thị ${total} món${search}. Mỗi thẻ món đều có thông tin hương vị, thời gian chuẩn bị và tồn kho ngay trên màn hình.`;
});

async function loadMenu() {
  loading.value = true;
  loadError.value = "";

  try {
    const { data } = await api.get<DailyMenuData>("/daily-menus/public/today");
    menu.value = data;
  } catch (error) {
    menu.value = null;
    const status = (error as AxiosError)?.response?.status;
    loadError.value =
      status === 404
        ? ""
        : "Kết nối đến hệ thống thực đơn bị gián đoạn. Vui lòng thử lại sau vài giây.";
  } finally {
    loading.value = false;
  }
}

function addToCart(item: DailyMenuItemData) {
  if (!canOrderItem(item)) return;

  feedback.value = null;
  const existing = cart.value.find((line) => line.dailyMenuItemId === item.id);
  if (existing) {
    existing.quantity += 1;
    return;
  }

  cart.value.push({
    dailyMenuItemId: item.id,
    name: item.menuItem?.name || "Món đang cập nhật",
    price: Number(item.sellingPrice || 0),
    quantity: 1,
  });
}

function changeQty(line: CartLine, delta: number) {
  const nextQuantity = line.quantity + delta;
  if (nextQuantity <= 0) {
    removeLine(line.dailyMenuItemId);
    return;
  }
  line.quantity = nextQuantity;
}

function removeLine(dailyMenuItemId: number) {
  cart.value = cart.value.filter((line) => line.dailyMenuItemId !== dailyMenuItemId);
}

async function submitOrder() {
  if (!menu.value?.id || cart.value.length === 0) return;

  submitting.value = true;
  feedback.value = null;

  try {
    await api.post("/orders", {
      dailyMenuId: menu.value.id,
      note: note.value,
      items: cart.value.map((line) => ({
        dailyMenuItemId: line.dailyMenuItemId,
        quantity: line.quantity,
      })),
    });

    cart.value = [];
    note.value = "";
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

function resetFilters() {
  searchQuery.value = "";
  activeFilter.value = "all";
}

function getCartQuantity(dailyMenuItemId: number) {
  return cart.value.find((line) => line.dailyMenuItemId === dailyMenuItemId)?.quantity || 0;
}

function canOrderItem(item: DailyMenuItemData) {
  return Boolean(item.isAvailable) && item.availableQuantity !== 0;
}

function getCategoryLabel(item: DailyMenuItemData) {
  return item.menuItem?.category?.name || "Thực đơn trong ngày";
}

function getHighlightLabel(item: DailyMenuItemData) {
  if (item.highlightLabel) return item.highlightLabel;
  if (item.menuItem?.isFeatured) return "Món đặc sắc";
  return "Phục vụ hôm nay";
}

function getPreparationLabel(item: DailyMenuItemData) {
  const prepTime = Number(item.menuItem?.preparationTimeMin || 0);
  if (!prepTime) return "Ra món nhanh";
  return `${prepTime} phút chuẩn bị`;
}

function getSpicyLabel(item: DailyMenuItemData) {
  const spicyLevel = Number(item.menuItem?.spicyLevel ?? 0);
  if (spicyLevel <= 0) return "Không cay";
  if (spicyLevel === 1) return "Cay nhẹ";
  if (spicyLevel === 2) return "Cay vừa";
  return "Cay đậm vị";
}

function getAvailabilityLabel(item: DailyMenuItemData) {
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

function getUnitLabel(item: DailyMenuItemData) {
  return item.menuItem?.unit ? `Đơn vị ${item.menuItem.unit}` : "Theo suất";
}

function isFeaturedItem(item: DailyMenuItemData) {
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

function customerTierLabel(customerType?: string | null) {
  if (String(customerType || "").toUpperCase() === "REGULAR") return "Khách thường xuyên";
  return "Trải nghiệm của bạn";
}

function resolveImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return new URL(imageUrl, API_BASE_URL).toString();
}

function getCardMediaStyle(item: DailyMenuItemData, index: number) {
  const palette = paletteOverlays[index % paletteOverlays.length];
  const imageUrl = resolveImageUrl(item.menuItem?.imageUrl);

  return {
    backgroundImage: imageUrl ? `${palette}, url("${imageUrl}")` : palette,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function scrollToCart() {
  document.getElementById("customer-cart")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

onMounted(loadMenu);
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap");

.customer-menu-page {
  --customer-surface: rgba(255, 251, 246, 0.92);
  --customer-surface-strong: rgba(255, 253, 249, 0.98);
  --customer-ink: #21120e;
  --customer-muted: #6f5a50;
  --customer-line: rgba(120, 74, 54, 0.12);
  --customer-line-strong: rgba(120, 74, 54, 0.18);
  --customer-accent: #c9582c;
  --customer-accent-strong: #973413;
  --customer-green: #176151;
  --customer-shadow: 0 28px 60px rgba(61, 25, 14, 0.12);
  font-family: "Be Vietnam Pro", sans-serif;
  display: grid;
  gap: 24px;
  padding-bottom: 88px;
}

.customer-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.95fr);
  gap: 24px;
  padding: 30px;
  border-radius: 32px;
  background:
    radial-gradient(circle at top left, rgba(255, 186, 102, 0.28), transparent 28%),
    radial-gradient(circle at bottom right, rgba(23, 97, 81, 0.14), transparent 26%),
    linear-gradient(135deg, rgba(255, 250, 245, 0.98), rgba(252, 240, 228, 0.96));
  border: 1px solid rgba(120, 74, 54, 0.08);
  box-shadow: var(--customer-shadow);
  overflow: hidden;
}

.customer-hero::after {
  content: "";
  position: absolute;
  right: -72px;
  top: -72px;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(201, 88, 44, 0.16), transparent 70%);
  pointer-events: none;
}

.customer-hero__copy,
.customer-hero__feature {
  position: relative;
  z-index: 1;
}

.customer-hero__copy {
  display: grid;
  gap: 18px;
  align-content: start;
  animation: customer-enter 0.6s ease;
}

.customer-hero__eyebrow,
.customer-toolbar__eyebrow,
.customer-cart__eyebrow {
  font-size: 0.76rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(33, 18, 14, 0.56);
  font-weight: 700;
}

.customer-hero h1,
.customer-hero__feature h2,
.customer-toolbar h2,
.customer-cart h2,
.customer-state-card h3,
.customer-cart__empty h3 {
  margin: 0;
  font-family: "Fraunces", serif;
  color: var(--customer-ink);
}

.customer-hero h1 {
  font-size: clamp(2rem, 4vw, 3.6rem);
  line-height: 1.04;
  max-width: 12ch;
}

.customer-hero__summary,
.customer-toolbar p,
.customer-cart p,
.customer-state-card p,
.customer-cart__empty p,
.feature-showcase__body p,
.dish-card__description {
  margin: 0;
  color: var(--customer-muted);
  line-height: 1.65;
}

.customer-hero__chips,
.feature-showcase__badges,
.dish-card__media-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.customer-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 999px;
  font-size: 0.84rem;
  font-weight: 700;
}

.customer-chip--light {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(120, 74, 54, 0.08);
  color: var(--customer-ink);
}

.customer-chip--dark {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff9f2;
  backdrop-filter: blur(10px);
}

.customer-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.hero-stat-card {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(120, 74, 54, 0.08);
  min-height: 96px;
}

.hero-stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: var(--customer-accent);
  background: linear-gradient(135deg, rgba(255, 220, 183, 0.96), rgba(255, 241, 226, 0.9));
  font-size: 1.15rem;
}

.hero-stat-card__value {
  font-size: 1.12rem;
  font-weight: 800;
  color: var(--customer-ink);
}

.hero-stat-card__label {
  margin-top: 4px;
  color: var(--customer-muted);
  font-size: 0.86rem;
}

.feature-showcase {
  position: relative;
  min-height: 100%;
  border-radius: 28px;
  overflow: hidden;
  box-shadow: 0 22px 48px rgba(28, 20, 18, 0.2);
}

.feature-showcase__overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(10, 7, 7, 0.02) 0%, rgba(10, 7, 7, 0.38) 42%, rgba(10, 7, 7, 0.76) 100%),
    radial-gradient(circle at top right, rgba(255, 220, 160, 0.24), transparent 34%);
}

.feature-showcase__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 14px;
  min-height: 100%;
  padding: 28px;
  color: #fff9f2;
}

.feature-showcase__body h2,
.feature-showcase__body p,
.feature-showcase__category,
.feature-showcase__price,
.feature-showcase__price-label {
  color: #fff9f2;
}

.feature-showcase__category,
.dish-card__category {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(255, 249, 242, 0.78);
  font-weight: 700;
}

.feature-showcase__footer {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: end;
  margin-top: 8px;
}

.feature-showcase__price-label,
.dish-card__price-label {
  font-size: 0.82rem;
  color: var(--customer-muted);
}

.feature-showcase__price,
.dish-card__price {
  font-size: 1.35rem;
  font-weight: 800;
}

.feature-showcase__button {
  min-width: 196px;
}

.customer-feedback {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 18px;
  border-radius: 18px;
  border: 1px solid transparent;
  font-weight: 600;
}

.customer-feedback.is-success {
  background: rgba(23, 97, 81, 0.1);
  border-color: rgba(23, 97, 81, 0.18);
  color: #0f5a4b;
}

.customer-feedback.is-error {
  background: rgba(201, 88, 44, 0.1);
  border-color: rgba(201, 88, 44, 0.18);
  color: #9a3818;
}

.customer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 380px);
  gap: 24px;
  align-items: start;
}

.customer-layout__main,
.customer-layout__aside {
  min-width: 0;
}

.customer-toolbar,
.customer-cart,
.customer-state-card {
  background: var(--customer-surface);
  border: 1px solid var(--customer-line);
  border-radius: 28px;
  box-shadow: var(--customer-shadow);
}

.customer-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: 20px;
  align-items: end;
  padding: 24px;
}

.customer-search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 20px;
  border: 1px solid rgba(120, 74, 54, 0.12);
  background: rgba(255, 255, 255, 0.78);
}

.customer-search i {
  color: var(--customer-muted);
}

.customer-search input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--customer-ink);
  font: inherit;
}

.customer-filters {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 2px 2px 4px;
  margin-top: 18px;
  scrollbar-width: none;
}

.customer-filters::-webkit-scrollbar {
  display: none;
}

.customer-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 18px;
  border: 1px solid rgba(120, 74, 54, 0.12);
  background: rgba(255, 255, 255, 0.7);
  color: var(--customer-ink);
  font-weight: 600;
  white-space: nowrap;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.customer-filter-chip strong {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(201, 88, 44, 0.08);
  color: var(--customer-accent-strong);
  font-size: 0.78rem;
}

.customer-filter-chip:hover,
.customer-filter-chip.is-active {
  transform: translateY(-1px);
}

.customer-filter-chip.is-active {
  background: linear-gradient(135deg, rgba(201, 88, 44, 0.14), rgba(255, 230, 206, 0.96));
  border-color: rgba(201, 88, 44, 0.26);
}

.dish-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
  margin-top: 20px;
}

.dish-card {
  background: var(--customer-surface-strong);
  border: 1px solid var(--customer-line);
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--customer-shadow);
  animation: customer-enter 0.55s ease;
}

.dish-card__media {
  position: relative;
  min-height: 240px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.dish-card__media::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(20, 12, 10, 0.24) 54%, rgba(20, 12, 10, 0.68) 100%);
}

.dish-card__media-badges,
.dish-card__media-caption {
  position: relative;
  z-index: 1;
}

.dish-card__media-caption {
  display: grid;
  gap: 8px;
}

.dish-card__name {
  font-size: 1.42rem;
  font-weight: 800;
  color: #fff9f2;
  max-width: 14ch;
  line-height: 1.15;
}

.dish-card__body {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.dish-card__description {
  min-height: 76px;
}

.dish-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.dish-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(249, 238, 226, 0.86);
  color: #6a5548;
  font-size: 0.84rem;
  font-weight: 600;
}

.dish-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
}

.dish-card__actions {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.dish-card__quantity-pill {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(23, 97, 81, 0.1);
  color: var(--customer-green);
  font-weight: 700;
  font-size: 0.8rem;
}

.dish-card__actions .btn {
  min-width: 150px;
}

.dish-card--loading {
  overflow: hidden;
}

.skeleton-block,
.skeleton-line {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, rgba(237, 225, 214, 0.7), rgba(248, 243, 238, 0.94), rgba(237, 225, 214, 0.7));
  background-size: 200% 100%;
  animation: shimmer 1.25s linear infinite;
}

.skeleton-block {
  min-height: 240px;
}

.skeleton-line {
  height: 14px;
  border-radius: 999px;
}

.skeleton-line--title {
  height: 22px;
  width: 74%;
}

.skeleton-line--short {
  width: 56%;
}

.skeleton-line--wide {
  width: 84%;
}

.customer-state-card {
  display: grid;
  justify-items: start;
  gap: 14px;
  padding: 28px;
  margin-top: 20px;
}

.customer-state-card__icon,
.customer-cart__empty-icon {
  width: 58px;
  height: 58px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  background: linear-gradient(135deg, rgba(255, 228, 200, 0.96), rgba(255, 245, 235, 0.96));
  color: var(--customer-accent);
}

.customer-cart {
  position: sticky;
  top: 96px;
  display: grid;
  gap: 22px;
  padding: 24px;
}

.customer-cart__header {
  display: grid;
  gap: 14px;
}

.customer-cart__link {
  justify-self: start;
  font-weight: 700;
  color: var(--customer-accent-strong);
  text-decoration: none;
}

.customer-cart__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.customer-cart__summary-item {
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 246, 236, 0.94);
  border: 1px solid rgba(120, 74, 54, 0.08);
}

.customer-cart__summary-item span {
  display: block;
  color: var(--customer-muted);
  font-size: 0.82rem;
}

.customer-cart__summary-item strong {
  display: block;
  margin-top: 8px;
  color: var(--customer-ink);
  font-size: 1.08rem;
}

.customer-cart__empty {
  display: grid;
  gap: 14px;
  padding: 24px;
  border-radius: 24px;
  border: 1px dashed rgba(120, 74, 54, 0.18);
  background: rgba(255, 255, 255, 0.56);
}

.customer-cart__lines {
  display: grid;
  gap: 12px;
}

.cart-line {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(120, 74, 54, 0.08);
}

.cart-line__body {
  min-width: 0;
}

.cart-line__name {
  font-weight: 700;
  color: var(--customer-ink);
}

.cart-line__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  color: var(--customer-muted);
  font-size: 0.88rem;
}

.cart-line__controls {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.cart-stepper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  background: rgba(249, 238, 226, 0.96);
  border: 1px solid rgba(120, 74, 54, 0.08);
}

.cart-stepper__button,
.cart-remove-button {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #fff;
  color: var(--customer-ink);
}

.cart-stepper span {
  min-width: 18px;
  text-align: center;
  font-weight: 700;
}

.cart-remove-button {
  background: rgba(201, 88, 44, 0.08);
  color: var(--customer-accent-strong);
}

.customer-note {
  display: grid;
  gap: 10px;
}

.customer-note span {
  font-weight: 700;
  color: var(--customer-ink);
}

.customer-note textarea {
  width: 100%;
  border: 1px solid rgba(120, 74, 54, 0.14);
  border-radius: 20px;
  padding: 14px 16px;
  resize: vertical;
  min-height: 116px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--customer-ink);
  font: inherit;
}

.customer-note textarea:focus,
.customer-search input:focus {
  outline: none;
}

.customer-cart__totals {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.customer-cart__total-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: var(--customer-ink);
  font-weight: 600;
}

.customer-cart__total-row--muted {
  color: var(--customer-muted);
}

.customer-cart__total-row--grand {
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--customer-line-strong);
  font-size: 1.05rem;
}

.customer-cart__submit {
  width: 100%;
  min-height: 52px;
  font-size: 1rem;
  font-weight: 700;
}

.customer-cart-fab {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 990;
  display: none;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--customer-accent), var(--customer-accent-strong));
  color: #fff9f2;
  box-shadow: 0 18px 34px rgba(151, 52, 19, 0.28);
}

.customer-cart-fab strong {
  font-size: 1rem;
}

.btn-ember {
  box-shadow: 0 16px 30px rgba(151, 52, 19, 0.16);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes customer-enter {
  0% {
    opacity: 0;
    transform: translateY(18px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1399px) {
  .customer-layout {
    grid-template-columns: minmax(0, 1fr) 350px;
  }

  .customer-hero {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 1199px) {
  .customer-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .customer-layout__aside {
    order: -1;
  }

  .customer-cart {
    position: static;
  }
}

@media (max-width: 991px) {
  .customer-menu-page {
    gap: 20px;
    padding-bottom: 96px;
  }

  .customer-hero,
  .customer-toolbar,
  .customer-cart,
  .customer-state-card {
    padding: 22px;
    border-radius: 26px;
  }

  .customer-hero__stats,
  .customer-cart__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customer-toolbar {
    grid-template-columns: minmax(0, 1fr);
  }

  .feature-showcase {
    min-height: 360px;
  }

  .dish-card__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .dish-card__actions {
    justify-items: stretch;
  }

  .dish-card__actions .btn {
    width: 100%;
  }
}

@media (max-width: 767px) {
  .customer-hero h1 {
    max-width: none;
  }

  .customer-hero__stats,
  .customer-cart__summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero-stat-card,
  .cart-line,
  .feature-showcase__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .cart-line__controls {
    justify-items: stretch;
  }

  .cart-stepper {
    justify-content: space-between;
  }

  .customer-cart-fab {
    display: flex;
  }
}
</style>
