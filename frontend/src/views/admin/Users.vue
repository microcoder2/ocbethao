<template>
  <div class="users-admin d-grid gap-4">
    <section class="page-panel users-hero">
      <div class="users-hero__layout">
        <div class="users-hero__copy">
          <h2 class="users-hero__title">Người dùng</h2>
          <div class="users-hero__actions">
            <button
              type="button"
              class="btn btn-outline-dark"
              title="Thêm nhân sự"
              aria-label="Thêm nhân sự"
              @click="openCreateDialog('STAFF')"
            >
              <i class="bi bi-person-plus"></i>
              <span>Nhân sự</span>
            </button>
            <button
              type="button"
              class="btn btn-ember"
              title="Thêm khách hàng"
              aria-label="Thêm khách hàng"
              @click="openCreateDialog('CUSTOMER')"
            >
              <i class="bi bi-person-plus"></i>
              <span>Khách hàng</span>
            </button>
          </div>
        </div>

        <div class="users-stat-grid">
          <article
            v-for="stat in statCards"
            :key="stat.label"
            class="users-stat-card"
            :class="`users-stat-card--${stat.tone}`"
          >
            <div class="users-stat-card__icon">
              <i :class="stat.icon"></i>
            </div>
            <div class="users-stat-card__body">
              <div class="users-stat-card__value">{{ stat.value }}</div>
              <div class="users-stat-card__label">{{ stat.label }}</div>
              <div class="users-stat-card__hint">{{ stat.meta }}</div>
            </div>
          </article>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert-danger py-2 mb-0">{{ errorMessage }}</div>

      <div class="users-toolbar-card">
        <div class="section-head users-toolbar-card__head">
          <div>
            <div class="panel-title mb-1">Bộ lọc</div>
            <div class="small text-muted">
              {{ filteredUsers.length }} user phù hợp trên tổng {{ users.length }} user hiện có.
            </div>
          </div>
          <div class="users-toolbar-card__meta">
            <span>Trang {{ filter.page }} / {{ totalPages }}</span>
            <span v-if="loading" class="tag">Đang tải...</span>
          </div>
        </div>

        <div class="users-toolbar">
          <div class="users-toolbar__row">
            <label class="users-field users-search-field">
              <span>Tìm kiếm</span>
              <div class="users-search-control">
                <i class="bi bi-search"></i>
                <input
                  v-model.trim="filter.search"
                  class="form-control users-search-input"
                  type="search"
                  placeholder="Tìm theo tên, username, email, số điện thoại..."
                  @input="handleSearchInput"
                  @search="handleImmediateSearch"
                />
              </div>
            </label>

            <label class="users-field">
              <span>Trạng thái</span>
              <select v-model="filter.status" class="form-select" @change="resetToFirstPage">
                <option value="ALL">Tất cả</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </div>

          <div class="users-toolbar__row">
            <label class="users-field">
              <span>Vai trò</span>
              <select v-model="filter.role" class="form-select" @change="handleServerFilterChange">
                <option value="ALL">Tất cả</option>
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </label>

            <label class="users-field">
              <span>Provider</span>
              <select v-model="filter.provider" class="form-select" @change="resetToFirstPage">
                <option value="ALL">Tất cả</option>
                <option v-for="provider in providerOptions" :key="provider" :value="provider">
                  {{ formatProviderLabel(provider) }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="page-panel">
      <div class="section-head">
        <div>
          <div class="panel-title mb-1">Danh sách</div>
        </div>
      </div>

      <div class="users-table-wrap">
        <table class="users-table">
          <thead>
            <tr>
              <th class="users-th users-th--avatar"></th>
              <th class="users-th">User</th>
              <th class="users-th users-col-contact">Liên hệ</th>
              <th class="users-th users-col-role">Vai trò</th>
              <th class="users-th users-col-provider">Provider</th>
              <th class="users-th users-col-status">Trạng thái</th>
              <th class="users-th users-th--actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="users-td users-td--center">
                <i class="bi bi-hourglass-split"></i> Đang tải...
              </td>
            </tr>
            <tr v-else-if="paginatedUsers.length === 0">
              <td colspan="7" class="users-td users-td--center users-td--muted">
                Không có user nào phù hợp bộ lọc hiện tại.
              </td>
            </tr>
            <template v-else>
              <tr
                v-for="user in paginatedUsers"
                :key="user.id"
                class="users-row"
                :class="{ 'users-row--dim': !user.isActive }"
              >
                <td class="users-td users-td--avatar">
                  <div class="user-avatar">{{ getInitials(user.fullName) }}</div>
                </td>
                <td class="users-td">
                  <div class="users-table__name">{{ user.fullName }}</div>
                  <div class="users-table__mobile-meta">
                    <span class="user-role" :class="`user-role--${user.role.toLowerCase()}`">
                      {{ formatRoleLabel(user.role) }}
                    </span>
                    <span class="user-status" :class="{ 'is-inactive': !user.isActive }">
                      {{ user.isActive ? "Active" : "Inactive" }}
                    </span>
                  </div>
                </td>
                <td class="users-td users-col-contact">
                  <div class="users-table__contact" :title="getPreferredContact(user)">
                    <span class="users-table__contact-value">{{ getPreferredContact(user) }}</span>
                  </div>
                </td>
                <td class="users-td users-col-role">
                  <div class="users-table__role">
                    <span class="user-role" :class="`user-role--${user.role.toLowerCase()}`">
                      {{ formatRoleLabel(user.role) }}
                    </span>
                    <div class="users-table__sub">{{ formatCustomerTypeLabel(user.customerType) }}</div>
                  </div>
                </td>
                <td class="users-td users-col-provider">
                  <div class="users-table__chips">
                    <span
                      v-for="provider in getLoginProviders(user)"
                      :key="provider"
                      class="user-chip"
                      :class="{ 'user-chip--primary': provider === getPrimaryProvider(user) }"
                    >
                      {{ formatProviderLabel(provider) }}
                    </span>
                    <span v-if="!getLoginProviders(user).length" class="user-chip user-chip--muted">Chưa có provider</span>
                  </div>
                </td>
                <td class="users-td users-col-status">
                  <span class="user-status" :class="{ 'is-inactive': !user.isActive }">
                    {{ user.isActive ? "Active" : "Inactive" }}
                  </span>
                </td>
                <td class="users-td users-td--actions">
                  <div class="users-row-actions">
                    <button
                      type="button"
                      class="user-card__icon-btn"
                      title="Xem"
                      :aria-label="`Xem ${user.fullName}`"
                      @click="viewUser(user)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>
                    <button
                      type="button"
                      class="user-card__icon-btn"
                      title="Sửa"
                      :aria-label="`Sửa ${user.fullName}`"
                      @click="editUser(user)"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button
                      type="button"
                      class="user-card__icon-btn user-card__icon-btn--danger"
                      title="Xóa"
                      :aria-label="`Xóa ${user.fullName}`"
                      :disabled="deletingUserId === user.id"
                      @click="openDeleteDialog(user)"
                    >
                      <i class="bi bi-trash3"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="filteredUsers.length > 0" class="users-pagination">
        <div class="users-pagination__row">
          <div class="users-pagination__summary">
            Hiển thị {{ pageStart }}-{{ pageEnd }} / {{ filteredUsers.length }} user
          </div>

          <div class="users-pagination__controls">
            <button
              type="button"
              class="users-pagination__nav-btn"
              title="Trang đầu"
              aria-label="Trang đầu"
              :disabled="filter.page <= 1"
              @click="goToPage(1)"
            >
              <i class="bi bi-chevron-double-left"></i>
            </button>
            <button
              type="button"
              class="users-pagination__nav-btn"
              title="Trang trước"
              aria-label="Trang trước"
              :disabled="filter.page <= 1"
              @click="goToPage(filter.page - 1)"
            >
              <i class="bi bi-chevron-left"></i>
            </button>

            <template v-for="item in paginationItems" :key="item">
              <button
                v-if="typeof item === 'number'"
                type="button"
                class="users-page-button"
                :class="{ 'is-active': item === filter.page }"
                :title="`Trang ${item}`"
                :aria-label="`Trang ${item}`"
                @click="goToPage(item)"
              >
                {{ item }}
              </button>
              <span v-else class="users-pagination__ellipsis" aria-hidden="true">…</span>
            </template>

            <button
              type="button"
              class="users-pagination__nav-btn"
              title="Trang sau"
              aria-label="Trang sau"
              :disabled="filter.page >= totalPages"
              @click="goToPage(filter.page + 1)"
            >
              <i class="bi bi-chevron-right"></i>
            </button>
            <button
              type="button"
              class="users-pagination__nav-btn"
              title="Trang cuối"
              aria-label="Trang cuối"
              :disabled="filter.page >= totalPages"
              @click="goToPage(totalPages)"
            >
              <i class="bi bi-chevron-double-right"></i>
            </button>
          </div>
        </div>

        <label class="users-pagination__page-size">
          <span>Hiển thị mỗi trang</span>
          <select v-model.number="filter.pageSize" class="form-select form-select-sm" @change="resetToFirstPage">
            <option :value="6">6 user</option>
            <option :value="12">12 user</option>
            <option :value="24">24 user</option>
          </select>
        </label>
      </div>
    </section>

    <div v-if="dialogOpen" class="users-modal" @click.self="closeDialog">
      <div class="page-panel users-modal__panel" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div class="users-modal__head">
          <div class="users-modal__hero">
            <div class="users-modal__avatar">
              <i :class="dialogIconClass"></i>
            </div>
            <div class="users-modal__hero-copy">
              <div class="users-modal__eyebrow">{{ dialogEyebrow }}</div>
              <h3 id="user-dialog-title" class="users-modal__title">{{ dialogTitle }}</h3>
              <div class="users-modal__role-badge">{{ formatRoleLabel(form.role) }}</div>
            </div>
          </div>

          <button type="button" class="users-modal__close" @click="closeDialog">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <form class="users-modal__form" @submit.prevent="handleDialogSubmit">
          <div class="users-modal__body">
            <div class="users-form-grid">
              <label class="users-field users-field--full">
                <span>Họ tên</span>
                <input
                  v-model.trim="form.fullName"
                  class="form-control"
                  placeholder="Ví dụ: Nguyễn Minh An"
                  :disabled="isViewDialog"
                />
              </label>

              <label class="users-field">
                <span>Vai trò</span>
                <select v-model="form.role" class="form-select" :disabled="isViewDialog" @change="handleRoleChange">
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
              </label>

              <label class="users-field">
                <span>Trạng thái</span>
                <select v-model="form.isActive" class="form-select" :disabled="isViewDialog">
                  <option :value="true">Active</option>
                  <option :value="false">Inactive</option>
                </select>
              </label>

              <label class="users-field">
                <span>Username</span>
                <input v-model.trim="form.username" class="form-control" placeholder="username" :disabled="isViewDialog" />
              </label>

              <label class="users-field">
                <span>Loại khách</span>
                <select v-model="form.customerType" class="form-select" :disabled="isViewDialog || form.role !== 'CUSTOMER'">
                  <option value="">Chưa phân loại</option>
                  <option value="REGULAR">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="OFFICE">Office</option>
                  <option value="ONLINE">Online</option>
                  <option value="TOURIST">Tourist</option>
                </select>
              </label>

              <label class="users-field">
                <span>Số điện thoại</span>
                <input v-model.trim="form.phone" class="form-control" placeholder="090..." :disabled="isViewDialog" />
              </label>

              <label class="users-field">
                <span>Email</span>
                <input v-model.trim="form.email" class="form-control" placeholder="name@example.com" :disabled="isViewDialog" />
              </label>

              <label class="users-field">
                <span>Provider ưu tiên</span>
                <select v-model="form.preferredAuthProvider" class="form-select" :disabled="isViewDialog">
                  <option value="">Chọn provider</option>
                  <option value="password">Password</option>
                  <option value="google">Google</option>
                  <option value="facebook">Facebook</option>
                  <option value="apple">Apple</option>
                  <option value="zalo">Zalo</option>
                  <option value="vneid">VNeID</option>
                </select>
              </label>

              <label v-if="!isViewDialog" class="users-field users-field--full">
                <span>{{ dialogMode === "edit" ? "Mật khẩu mới" : "Mật khẩu" }}</span>
                <input
                  v-model="form.password"
                  type="password"
                  class="form-control"
                  :placeholder="dialogMode === 'edit' ? 'Để trống nếu giữ nguyên' : 'Bắt buộc khi tạo user'"
                />
              </label>

              <label class="users-field users-field--full">
                <span>Ghi chú nội bộ</span>
                <textarea
                  v-model.trim="form.notes"
                  rows="3"
                  class="form-control"
                  placeholder="Thông tin thêm về user"
                  :disabled="isViewDialog"
                ></textarea>
              </label>
            </div>

            <div v-if="form.authIdentityLabels.length" class="users-linked-box">
              <div class="users-linked-box__title">Provider đã liên kết</div>
              <div class="users-linked-box__list">
                <span v-for="label in form.authIdentityLabels" :key="label" class="user-chip user-chip--muted">
                  {{ label }}
                </span>
              </div>
            </div>
          </div>

          <div class="users-modal__footer">
            <p v-if="errorMessage" class="users-modal__message users-modal__message--error">
              <i class="bi bi-exclamation-circle"></i>
              <span>{{ errorMessage }}</span>
            </p>
            <div class="users-modal__footer-actions">
              <button type="button" class="users-modal__btn" @click="closeDialog">Đóng</button>
              <button v-if="!isViewDialog" type="submit" class="users-modal__btn users-modal__btn--save" :disabled="saving">
                <i v-if="saving" class="bi bi-hourglass-split"></i>
                <span v-else>{{ dialogMode === "edit" ? "Cập nhật user" : "Tạo user" }}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <div v-if="deleteTarget" class="users-modal" @click.self="closeDeleteDialog">
      <div class="page-panel users-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
        <div class="users-modal__eyebrow">Delete user</div>
        <h3 id="delete-user-title" class="users-modal__title">Xóa {{ deleteTarget.fullName }}?</h3>
        <p class="users-confirm__text">
          Hành động này sẽ xóa tài khoản, auth identity và session liên quan. Các đơn hàng cũ sẽ giữ lại nhưng tách khỏi user.
        </p>
        <div class="users-modal__footer">
          <button type="button" class="btn btn-outline-secondary" @click="closeDeleteDialog">Hủy</button>
          <button type="button" class="btn btn-danger" :disabled="deletingUserId === deleteTarget.id" @click="deleteUser">
            {{ deletingUserId === deleteTarget.id ? "Đang xóa..." : "Xóa user" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { api } from "../../api";

type UserRole = "ADMIN" | "STAFF" | "CUSTOMER";
type CustomerType = "" | "REGULAR" | "VIP" | "OFFICE" | "ONLINE" | "TOURIST";
type DialogMode = "create" | "edit" | "view";

interface AuthIdentityRecord {
  id: number;
  provider: string;
  providerUserId: string;
  providerEmail?: string | null;
  providerPhone?: string | null;
  providerUsername?: string | null;
}

interface UserRecord {
  id: number;
  fullName: string;
  role: UserRole;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
  preferredAuthProvider?: string | null;
  customerType?: CustomerType | null;
  avatarUrl?: string | null;
  notes?: string | null;
  isActive: boolean;
  hasPassword: boolean;
  linkedAuthProviders: string[];
  authIdentities: AuthIdentityRecord[];
  createdAt: string;
  updatedAt: string;
}

const users = ref<UserRecord[]>([]);
const loading = ref(false);
const saving = ref(false);
const deletingUserId = ref<number | null>(null);
const errorMessage = ref("");
const dialogOpen = ref(false);
const dialogMode = ref<DialogMode>("create");
const deleteTarget = ref<UserRecord | null>(null);

const filter = reactive({
  search: "",
  role: "ALL",
  provider: "ALL",
  status: "ALL",
  page: 1,
  pageSize: 12,
});

const form = reactive({
  id: null as number | null,
  fullName: "",
  username: "",
  role: "CUSTOMER" as UserRole,
  phone: "",
  email: "",
  preferredAuthProvider: "password",
  customerType: "REGULAR" as CustomerType,
  password: "",
  notes: "",
  isActive: true,
  authIdentityLabels: [] as string[],
});

const providerOptions = computed(() => {
  const values = new Set<string>();
  for (const user of users.value) {
    for (const provider of getLoginProviders(user)) {
      if (provider) {
        values.add(provider);
      }
    }
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right));
});

const isViewDialog = computed(() => dialogMode.value === "view");

const dialogEyebrow = computed(() => {
  if (dialogMode.value === "edit") return "Edit user";
  if (dialogMode.value === "view") return "View user";
  return "Add user";
});

const dialogTitle = computed(() => {
  if (dialogMode.value === "edit") return "Cập nhật tài khoản";
  if (dialogMode.value === "view") return "Chi tiết tài khoản";
  return "Thêm khách hàng / tài khoản mới";
});

const dialogIconClass = computed(() => {
  if (dialogMode.value === "edit") return "bi bi-pencil-square";
  if (dialogMode.value === "view") return "bi bi-eye";
  return "bi bi-person-plus";
});

const filteredUsers = computed(() =>
  users.value.filter((user) => {
    if (filter.provider !== "ALL" && !getLoginProviders(user).includes(filter.provider)) {
      return false;
    }
    if (filter.status === "ACTIVE" && !user.isActive) {
      return false;
    }
    if (filter.status === "INACTIVE" && user.isActive) {
      return false;
    }
    return true;
  })
);

const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / filter.pageSize) || 1));

const paginatedUsers = computed(() => {
  const start = (filter.page - 1) * filter.pageSize;
  return filteredUsers.value.slice(start, start + filter.pageSize);
});

const pageStart = computed(() => {
  if (filteredUsers.value.length === 0) {
    return 0;
  }
  return (filter.page - 1) * filter.pageSize + 1;
});

const pageEnd = computed(() => Math.min(filter.page * filter.pageSize, filteredUsers.value.length));

const paginationItems = computed<(number | string)[]>(() => {
  const pages: number[] = [];
  const start = Math.max(1, filter.page - 1);
  const end = Math.min(totalPages.value, filter.page + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (!pages.includes(1)) {
    pages.unshift(1);
  }
  if (!pages.includes(totalPages.value)) {
    pages.push(totalPages.value);
  }

  const ordered = Array.from(new Set(pages)).sort((left, right) => left - right);
  const items: (number | string)[] = [];

  ordered.forEach((page, index) => {
    const previous = ordered[index - 1];
    if (typeof previous === "number" && page - previous > 1) {
      items.push(`ellipsis-${previous}-${page}`);
    }
    items.push(page);
  });

  return items;
});

const statCards = computed(() => {
  const source = filteredUsers.value;
  return [
    {
      label: "Tổng user",
      value: source.length,
      meta: source.length === users.value.length ? "Toàn bộ danh sách" : "Kết quả sau lọc",
      icon: "bi bi-people",
      tone: "total",
    },
    {
      label: "Khách hàng",
      value: source.filter((user) => user.role === "CUSTOMER").length,
      meta: "Vai trò customer",
      icon: "bi bi-person-vcard",
      tone: "customer",
    },
    {
      label: "Đang active",
      value: source.filter((user) => user.isActive).length,
      meta: "Có thể đăng nhập",
      icon: "bi bi-person-check",
      tone: "active",
    },
    {
      label: "Có social login",
      value: source.filter((user) => getLoginProviders(user).some((provider) => provider !== "password")).length,
      meta: "Ngoài password",
      icon: "bi bi-globe2",
      tone: "social",
    },
  ];
});

let searchDebounceId: number | undefined;

function clearSearchDebounce() {
  if (typeof searchDebounceId === "number") {
    window.clearTimeout(searchDebounceId);
    searchDebounceId = undefined;
  }
}

function resetToFirstPage() {
  filter.page = 1;
}

function resetForm(role: UserRole = "CUSTOMER") {
  Object.assign(form, {
    id: null,
    fullName: "",
    username: "",
    role,
    phone: "",
    email: "",
    preferredAuthProvider: "password",
    customerType: role === "CUSTOMER" ? "REGULAR" : "",
    password: "",
    notes: "",
    isActive: true,
    authIdentityLabels: [],
  });
}

function openCreateDialog(role: UserRole = "CUSTOMER") {
  errorMessage.value = "";
  dialogMode.value = "create";
  resetForm(role);
  dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
  resetForm();
}

function openDeleteDialog(user: UserRecord) {
  errorMessage.value = "";
  deleteTarget.value = user;
}

function closeDeleteDialog() {
  deleteTarget.value = null;
}

function handleRoleChange() {
  if (form.role !== "CUSTOMER") {
    form.customerType = "";
  }
}

function getLoginProviders(user: UserRecord): string[] {
  const providers = Array.isArray(user.linkedAuthProviders) ? [...user.linkedAuthProviders] : [];
  if (user.hasPassword && !providers.includes("password")) {
    providers.unshift("password");
  }
  return providers;
}

function getPrimaryProvider(user: UserRecord): string {
  const preferred = String(user.preferredAuthProvider || "").trim().toLowerCase();
  if (preferred) {
    return preferred;
  }
  return getLoginProviders(user)[0] || "";
}

function formatProviderLabel(provider: string): string {
  const normalized = String(provider || "").trim().toLowerCase();
  if (normalized === "password") return "Password";
  if (normalized === "google") return "Google";
  if (normalized === "facebook") return "Facebook";
  if (normalized === "apple") return "Apple";
  if (normalized === "zalo") return "Zalo";
  if (normalized === "vneid") return "VNeID";
  return normalized || "--";
}

function formatRoleLabel(role: UserRole) {
  if (role === "ADMIN") return "Admin";
  if (role === "STAFF") return "Staff";
  return "Customer";
}

function formatCustomerTypeLabel(type?: string | null) {
  if (!type) return "Chưa phân loại";
  if (type === "REGULAR") return "Regular";
  if (type === "VIP") return "VIP";
  if (type === "OFFICE") return "Office";
  if (type === "ONLINE") return "Online";
  if (type === "TOURIST") return "Tourist";
  return type;
}

function getInitials(fullName: string) {
  return String(fullName || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getPreferredContact(user: UserRecord) {
  if (user.phone) return user.phone;
  if (user.email) return user.email;
  return "Chưa có liên hệ";
}

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function editUser(user: UserRecord) {
  dialogMode.value = "edit";
  openUserDialog(user);
}

function viewUser(user: UserRecord) {
  dialogMode.value = "view";
  openUserDialog(user);
}

function openUserDialog(user: UserRecord) {
  dialogOpen.value = true;
  errorMessage.value = "";
  Object.assign(form, {
    id: user.id,
    fullName: user.fullName,
    username: user.username || "",
    role: user.role,
    phone: user.phone || "",
    email: user.email || "",
    preferredAuthProvider: user.preferredAuthProvider || "password",
    customerType: user.customerType || "",
    password: "",
    notes: user.notes || "",
    isActive: user.isActive,
    authIdentityLabels: (user.authIdentities || []).map((identity) => {
      const handle =
        identity.providerUsername || identity.providerEmail || identity.providerPhone || identity.providerUserId;
      return `${identity.provider}:${handle}`;
    }),
  });
}

function handleDialogSubmit() {
  if (isViewDialog.value) {
    return;
  }
  void saveUser();
}

function goToPage(page: number) {
  filter.page = Math.min(totalPages.value, Math.max(1, page));
}

async function loadUsers() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const { data } = await api.get("/users", {
      params: {
        role: filter.role !== "ALL" ? filter.role : undefined,
        search: filter.search || undefined,
      },
    });
    users.value = data;
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không tải được danh sách user.");
  } finally {
    loading.value = false;
  }
}

function handleSearchInput() {
  resetToFirstPage();
  clearSearchDebounce();
  searchDebounceId = window.setTimeout(() => {
    loadUsers();
  }, 300);
}

function handleImmediateSearch() {
  resetToFirstPage();
  clearSearchDebounce();
  loadUsers();
}

function handleServerFilterChange() {
  resetToFirstPage();
  handleImmediateSearch();
}

function validateForm() {
  if (!form.fullName.trim()) {
    return "Họ tên là bắt buộc.";
  }

  if (dialogMode.value === "create" && !form.password) {
    return "Tạo user mới cần mật khẩu.";
  }

  return "";
}

async function saveUser() {
  errorMessage.value = validateForm();
  if (errorMessage.value) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      fullName: form.fullName.trim(),
      username: form.username || undefined,
      role: form.role,
      phone: form.phone || undefined,
      email: form.email || undefined,
      preferredAuthProvider: form.preferredAuthProvider || undefined,
      customerType: form.role === "CUSTOMER" ? form.customerType || undefined : undefined,
      password: form.password || undefined,
      notes: form.notes || undefined,
      isActive: Boolean(form.isActive),
    };

    if (form.id) {
      await api.put(`/users/${form.id}`, payload);
    } else {
      await api.post("/users", payload);
    }

    await loadUsers();
    closeDialog();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không lưu được user.");
  } finally {
    saving.value = false;
  }
}

async function deleteUser() {
  if (!deleteTarget.value) {
    return;
  }

  deletingUserId.value = deleteTarget.value.id;
  errorMessage.value = "";

  try {
    await api.delete(`/users/${deleteTarget.value.id}`);
    await loadUsers();
    closeDeleteDialog();
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không xóa được user.");
  } finally {
    deletingUserId.value = null;
  }
}

watch(
  () => totalPages.value,
  (nextTotal) => {
    if (filter.page > nextTotal) {
      filter.page = nextTotal;
    }
  }
);

watch(
  () => [filter.provider, filter.status, filter.pageSize],
  () => {
    resetToFirstPage();
  }
);

onMounted(async () => {
  await loadUsers();
  resetForm();
});

onBeforeUnmount(() => {
  clearSearchDebounce();
});
</script>

<style scoped>
.users-admin {
  gap: 24px;
  margin-inline: -24px;
  margin-top: -24px;
  padding-bottom: 48px;
}

.users-hero {
  display: grid;
  gap: 18px;
  background:
    radial-gradient(circle at top right, rgba(var(--green-rgb), 0.12), transparent 28%),
    linear-gradient(135deg, rgba(var(--panel-rgb), 0.96), rgba(243, 251, 247, 0.94));
}

.users-hero__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.95fr);
  gap: 18px;
  align-items: start;
}

.users-hero__actions,
.section-head,
.user-card__head,
.user-card__actions,
.users-pagination__row,
.users-pagination__controls,
.users-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.users-hero__copy {
  display: grid;
  gap: 10px;
  align-content: start;
}

.users-hero__eyebrow,
.users-field span,
.users-modal__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.76rem;
  color: var(--muted);
}

.users-hero__title,
.users-modal__title {
  margin: 0;
  font-size: clamp(1.45rem, 3.6vw, 2.1rem);
  line-height: 1.1;
}

.users-hero__description {
  margin: 0;
  max-width: 56ch;
  color: var(--muted);
}

.users-hero__actions {
  flex-wrap: wrap;
  align-items: center;
}

.users-hero__actions .btn {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.users-hero__actions .btn i {
  font-size: 0.95rem;
  line-height: 1;
}

.users-toolbar-card {
  display: grid;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px solid rgba(var(--line-rgb), 0.82);
  background: rgba(255, 255, 255, 0.58);
  backdrop-filter: blur(10px);
}

.users-toolbar-card__head {
  align-items: center;
}

.users-toolbar-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 0.88rem;
}

.users-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.users-stat-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  min-height: 84px;
  padding: 14px 15px;
  border-radius: 18px;
  border: 1px solid rgba(var(--line-rgb), 0.88);
  background: rgba(var(--panel-rgb), 0.84);
}

.users-stat-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(var(--text-rgb), 0.06);
  color: var(--text);
  font-size: 1.05rem;
}

.users-stat-card__body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.users-stat-card__label {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 700;
}

.users-stat-card__value {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.05;
}

.users-stat-card__hint {
  color: var(--muted);
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.users-stat-card--customer .users-stat-card__icon {
  background: rgba(var(--gold-rgb), 0.16);
  color: #8d6510;
}

.users-stat-card--active .users-stat-card__icon {
  background: rgba(var(--green-rgb), 0.14);
  color: var(--green);
}

.users-stat-card--social .users-stat-card__icon {
  background: rgba(var(--ember-rgb), 0.16);
  color: var(--ember-strong);
}

.users-toolbar,
.users-form-grid {
  display: grid;
  gap: 14px;
}

.users-toolbar {
  gap: 12px;
}

.users-toolbar__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.users-toolbar__row:first-child {
  grid-template-columns: minmax(0, 1.55fr) minmax(220px, 0.85fr);
}

.users-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.users-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.users-field--full {
  grid-column: 1 / -1;
}

.users-search-control {
  position: relative;
}

.users-search-control i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
}

.users-search-input {
  padding-left: 42px;
}

.user-avatar {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(var(--ember-rgb), 0.18), rgba(var(--green-rgb), 0.2));
  color: var(--ember-strong);
  font-weight: 800;
}

.users-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 24px;
}

.users-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.users-th {
  padding: 12px 14px;
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  background: rgba(var(--panel-rgb), 0.95);
  border-bottom: 1px solid rgba(var(--line-rgb), 0.9);
}

.users-th--avatar {
  width: 70px;
}

.users-th--actions {
  width: 136px;
}

.users-td,
.users-th--actions {
  vertical-align: top;
}

.users-td {
  padding: 12px 14px;
  background: rgba(var(--panel-rgb), 0.97);
  border-bottom: 1px solid rgba(var(--line-rgb), 0.82);
}

.users-td--avatar {
  width: 70px;
  padding-right: 0;
}

.users-td--actions {
  position: sticky;
  right: 0;
  background: rgba(var(--panel-rgb), 0.98);
}

.users-td--center {
  text-align: center;
  color: var(--muted);
  padding: 32px;
}

.users-td--muted {
  color: var(--muted);
}

.users-row {
  transition: background 0.1s;
}

.users-row:hover .users-td {
  background: rgba(255, 249, 246, 0.92);
}

.users-row:hover .users-td--actions {
  background: rgba(255, 246, 240, 0.98);
}

.users-row--dim {
  opacity: 0.58;
}

.users-row:last-child .users-td {
  border-bottom: none;
}

.users-td--avatar .user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  font-size: 0.92rem;
}

.users-table__name {
  font-weight: 700;
  color: var(--text);
}

.users-table__mobile-meta {
  display: none;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.users-table__sub,
.users-pagination__summary {
  color: var(--muted);
  font-size: 0.78rem;
}

.user-status,
.user-role,
.user-chip,
.users-page-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}

.user-status {
  background: rgba(var(--green-rgb), 0.14);
  color: var(--green);
}

.user-status.is-inactive {
  background: rgba(var(--text-rgb), 0.08);
  color: var(--muted);
}

.user-role--admin {
  background: rgba(var(--ember-rgb), 0.14);
  color: var(--ember-strong);
}

.user-role--staff {
  background: rgba(var(--green-rgb), 0.14);
  color: var(--green);
}

.user-role--customer {
  background: rgba(var(--gold-rgb), 0.14);
  color: #8d6510;
}

.users-table__contact {
  display: block;
  color: var(--text);
  min-width: 0;
}

.users-table__contact-value {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.users-table__role {
  display: grid;
  gap: 8px;
  align-content: start;
}

.users-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.user-card__icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(var(--line-rgb), 0.95);
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 0.92rem;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.user-card__icon-btn:hover {
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember);
  border-color: rgba(var(--ember-rgb), 0.28);
}

.user-card__icon-btn:active {
  transform: translateY(1px);
  background: rgba(var(--ember-rgb), 0.14);
}

.user-card__icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.user-card__icon-btn--danger:hover {
  background: rgba(var(--danger-rgb), 0.1);
  color: var(--danger);
  border-color: rgba(var(--danger-rgb), 0.28);
}

.user-card__icon-btn--danger:active {
  background: rgba(var(--danger-rgb), 0.16);
}

.users-table__chips,
.users-linked-box__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-chip {
  background: rgba(246, 233, 220, 0.85);
  color: var(--ember-strong);
}

.user-chip--primary {
  background: rgba(var(--text-rgb), 0.92);
  color: #fff8f1;
}

.user-chip--muted {
  background: rgba(var(--text-rgb), 0.08);
  color: var(--muted);
}

.users-pagination {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(var(--line-rgb), 0.9);
  display: grid;
  gap: 12px;
}

.users-pagination__row {
  align-items: center;
}

.users-pagination__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.users-pagination__page-size {
  display: inline-flex;
  align-items: center;
  justify-self: flex-end;
  gap: 10px;
  color: var(--muted);
  font-size: 0.88rem;
}

.users-pagination__page-size span {
  white-space: nowrap;
}

.users-pagination__page-size select {
  min-width: 118px;
}

.users-pagination__nav-btn,
.users-page-button {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.88rem;
  font-weight: 700;
  transition: background 0.12s, color 0.12s, border-color 0.12s, opacity 0.12s;
}

.users-pagination__nav-btn:hover,
.users-page-button:hover {
  background: rgba(var(--ember-rgb), 0.08);
  border-color: rgba(var(--ember-rgb), 0.22);
  color: var(--ember-strong);
}

.users-pagination__nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.users-pagination__ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  color: var(--muted);
  font-weight: 700;
}

.users-page-button.is-active {
  border-color: rgba(var(--ember-rgb), 0.24);
  background: rgba(255, 247, 241, 0.95);
  color: var(--ember-strong);
}

.empty-state {
  padding: 20px;
  border-radius: 22px;
  background: rgba(246, 233, 220, 0.55);
  color: var(--muted);
}

.users-modal {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 10, 8, 0.48);
}

.users-modal__panel,
.users-confirm {
  width: min(760px, calc(100vw - 24px));
  max-height: min(88dvh, 920px);
}

.users-modal__panel {
  padding: 0;
  background: var(--panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.users-modal__head {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--line);
  align-items: center;
}

.users-modal__form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.users-modal__hero {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.users-modal__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(var(--ember-rgb), 0.12);
  color: var(--ember);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.users-modal__hero-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.users-modal__panel .users-modal__title {
  font-size: clamp(1.05rem, 2.5vw, 1.18rem);
}

.users-modal__role-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.1);
  color: var(--ember-strong);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.users-modal__close {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}

.users-modal__close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text);
}

.users-modal__body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.users-modal__footer {
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.users-modal__footer-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.users-modal__message {
  margin: 0;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.users-modal__message--error {
  color: var(--danger);
}

.users-modal__btn {
  padding: 8px 18px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.users-modal__btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.users-modal__btn--save {
  min-width: 132px;
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
  color: #fff;
  border-color: transparent;
}

.users-modal__btn--save:hover:not(:disabled) {
  opacity: 0.9;
}

.users-modal__btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.users-linked-box {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(246, 233, 220, 0.55);
}

.users-linked-box__title {
  font-weight: 700;
}

.users-confirm {
  display: grid;
  gap: 14px;
  overflow-y: auto;
}

.users-confirm__text {
  margin: 0;
  color: var(--muted);
}

@media (max-width: 1199px) {
  .users-hero__layout {
    grid-template-columns: 1fr;
  }

  .users-toolbar__row:first-child {
    grid-template-columns: minmax(0, 1.25fr) minmax(200px, 0.95fr);
  }
}

@media (max-width: 991.98px) {
  .users-table {
    min-width: 0;
    table-layout: fixed;
  }

  .users-th--avatar,
  .users-td--avatar,
  .users-col-role,
  .users-col-provider,
  .users-col-status {
    display: none;
  }

  .users-th,
  .users-td {
    padding: 12px;
  }

  .users-td--actions {
    position: static;
    width: 124px;
  }

  .users-row-actions {
    justify-content: flex-start;
    gap: 6px;
  }

  .users-table__mobile-meta {
    display: flex;
  }

  .users-table__mobile-meta .user-role,
  .users-table__mobile-meta .user-status {
    min-height: 28px;
    padding: 4px 10px;
    font-size: 0.72rem;
  }
}

@media (max-width: 767px) {
  .users-admin {
    gap: 0;
    padding-bottom: 0;
  }

  .users-admin > .page-panel {
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  .users-hero {
    gap: 12px;
    background: transparent;
  }

  .users-hero__layout,
  .users-admin > .page-panel > .section-head,
  .users-pagination {
    padding-inline: 12px;
  }

  .users-hero__actions,
  .section-head,
  .users-toolbar-card__head,
  .users-pagination__row {
    flex-direction: column;
    align-items: stretch;
  }

  .users-hero__title {
    font-size: 1.25rem;
  }

  .users-hero__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 10px;
  }

  .users-hero__actions .btn {
    width: 100%;
  }

  .users-stat-grid {
    gap: 0;
  }

  .users-stat-card {
    min-height: auto;
    padding: 10px 12px;
    border-radius: 0;
    border-left: none;
    border-right: none;
    background: rgba(var(--panel-rgb), 0.92);
  }

  .users-stat-card__hint {
    display: none;
  }

  .users-toolbar-card {
    gap: 10px;
    padding: 0 12px;
    border: none;
    border-radius: 0;
    background: transparent;
    backdrop-filter: none;
  }

  .users-toolbar-card__meta {
    align-items: flex-start;
  }

  .users-toolbar-card .small {
    display: none;
  }

  .users-toolbar__row,
  .users-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .users-pagination__page-size {
    flex-direction: column;
    align-items: stretch;
    justify-self: stretch;
    width: 100%;
  }

  .users-pagination__page-size select {
    width: 100%;
  }

  .users-pagination__controls {
    justify-content: flex-start;
  }

  .users-table-wrap {
    border-left: none;
    border-right: none;
    border-radius: 0;
  }

  .users-table {
    table-layout: auto;
  }

  .users-th,
  .users-td {
    padding: 10px 12px;
  }

  .users-table__sub {
    line-height: 1.45;
  }

  .users-table__contact {
    font-size: 0.82rem;
  }

  .users-row-actions {
    flex-wrap: wrap;
  }

  .user-card__icon-btn {
    width: 34px;
    height: 34px;
  }

  .users-modal {
    padding: 12px;
  }

  .users-modal__panel,
  .users-confirm {
    width: min(100%, 100vw - 24px);
  }

  .users-modal__body {
    padding: 16px;
  }

  .users-modal__footer,
  .users-modal__head {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
