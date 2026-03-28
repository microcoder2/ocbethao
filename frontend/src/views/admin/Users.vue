<template>
  <div class="users-admin d-grid gap-4">
    <section class="page-panel users-hero">
      <div class="users-hero__head">
        <div class="users-hero__copy">
          <div class="users-hero__eyebrow">Customer CRM</div>
          <h2 class="users-hero__title">Tập khách hàng và tài khoản</h2>
          <p class="users-hero__description">
            Quản lý user theo chuẩn card/grid, thao tác nhanh trên điện thoại, thêm khách bằng popup và lọc dữ liệu ngay trên đầu trang.
          </p>
        </div>

        <div class="users-hero__actions">
          <button type="button" class="btn btn-outline-dark" @click="openCreateDialog('STAFF')">Thêm nhân sự</button>
          <button type="button" class="btn btn-ember" @click="openCreateDialog('CUSTOMER')">Thêm khách hàng</button>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert-danger py-2 mb-0">{{ errorMessage }}</div>

      <div class="users-stat-grid">
        <article v-for="stat in statCards" :key="stat.label" class="users-stat-card">
          <div class="users-stat-card__label">{{ stat.label }}</div>
          <div class="users-stat-card__value">{{ stat.value }}</div>
          <div class="users-stat-card__hint">{{ stat.hint }}</div>
        </article>
      </div>
    </section>

    <section class="page-panel">
      <div class="section-head">
        <div>
          <div class="panel-title mb-1">Bộ lọc người dùng</div>
          <div class="small text-muted">
            {{ filteredUsers.length }} user phù hợp trên tổng {{ users.length }} user hiện có.
          </div>
        </div>
        <span v-if="loading" class="tag">Đang tải...</span>
      </div>

      <div class="users-toolbar">
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

        <label class="users-field">
          <span>Trạng thái</span>
          <select v-model="filter.status" class="form-select" @change="resetToFirstPage">
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>

        <label class="users-field">
          <span>Hiển thị</span>
          <select v-model.number="filter.pageSize" class="form-select" @change="resetToFirstPage">
            <option :value="6">6 / trang</option>
            <option :value="12">12 / trang</option>
            <option :value="24">24 / trang</option>
          </select>
        </label>
      </div>
    </section>

    <section class="page-panel">
      <div class="section-head">
        <div>
          <div class="panel-title mb-1">User grid</div>
          <div class="small text-muted">Thao tác thêm, sửa, xóa nhanh theo từng card.</div>
        </div>
      </div>

      <div v-if="!loading && paginatedUsers.length === 0" class="empty-state">
        Không có user nào phù hợp bộ lọc hiện tại.
      </div>

      <div v-else class="users-grid">
        <button type="button" class="user-create-card" @click="openCreateDialog('CUSTOMER')">
          <i class="bi bi-person-plus"></i>
          <strong>Thêm khách hàng</strong>
          <span>Mở popup để tạo nhanh khách mới.</span>
        </button>

        <article v-for="user in paginatedUsers" :key="user.id" class="user-card">
          <div class="user-card__head">
            <div class="user-avatar">{{ getInitials(user.fullName) }}</div>

            <div class="user-card__main">
              <div class="user-card__title-row">
                <h3 class="user-card__name">{{ user.fullName }}</h3>
                <span class="user-role" :class="`user-role--${user.role.toLowerCase()}`">
                  {{ formatRoleLabel(user.role) }}
                </span>
              </div>

              <div class="user-card__sub">
                {{ user.username ? `@${user.username}` : `#${user.id}` }}
              </div>
            </div>

            <span class="user-status" :class="{ 'is-inactive': !user.isActive }">
              {{ user.isActive ? "Active" : "Inactive" }}
            </span>
          </div>

          <div class="user-card__meta">
            <div class="user-card__line">
              <i class="bi bi-telephone"></i>
              <span>{{ user.phone || "Chưa có số điện thoại" }}</span>
            </div>
            <div class="user-card__line">
              <i class="bi bi-envelope"></i>
              <span>{{ user.email || "Chưa có email" }}</span>
            </div>
            <div class="user-card__line">
              <i class="bi bi-person-badge"></i>
              <span>{{ formatCustomerTypeLabel(user.customerType) }}</span>
            </div>
            <div class="user-card__line">
              <i class="bi bi-calendar3"></i>
              <span>Tạo {{ formatDate(user.createdAt) }}</span>
            </div>
          </div>

          <div class="user-card__providers">
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

          <p v-if="user.notes" class="user-card__notes">{{ user.notes }}</p>

          <div class="user-card__actions">
            <button type="button" class="btn btn-sm btn-outline-dark" @click="editUser(user)">Sửa</button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="deletingUserId === user.id"
              @click="openDeleteDialog(user)"
            >
              Xóa
            </button>
          </div>
        </article>
      </div>

      <div v-if="filteredUsers.length > 0" class="users-pagination">
        <div class="users-pagination__summary">
          Hiển thị {{ pageStart }}-{{ pageEnd }} / {{ filteredUsers.length }} user
        </div>

        <div class="users-pagination__controls">
          <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="filter.page <= 1" @click="goToPage(filter.page - 1)">
            Trước
          </button>

          <button
            v-for="page in visiblePages"
            :key="page"
            type="button"
            class="users-page-button"
            :class="{ 'is-active': page === filter.page }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>

          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="filter.page >= totalPages"
            @click="goToPage(filter.page + 1)"
          >
            Sau
          </button>
        </div>
      </div>
    </section>

    <div v-if="dialogOpen" class="users-modal" @click.self="closeDialog">
      <div class="page-panel users-modal__panel" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div class="users-modal__head">
          <div>
            <div class="users-modal__eyebrow">{{ dialogMode === "edit" ? "Edit user" : "Add user" }}</div>
            <h3 id="user-dialog-title" class="users-modal__title">
              {{ dialogMode === "edit" ? "Cập nhật tài khoản" : "Thêm khách hàng / tài khoản mới" }}
            </h3>
          </div>

          <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeDialog">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <form class="users-modal__form" @submit.prevent="saveUser">
          <div class="users-form-grid">
            <label class="users-field users-field--full">
              <span>Họ tên</span>
              <input v-model.trim="form.fullName" class="form-control" placeholder="Ví dụ: Nguyễn Minh An" />
            </label>

            <label class="users-field">
              <span>Vai trò</span>
              <select v-model="form.role" class="form-select" @change="handleRoleChange">
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </label>

            <label class="users-field">
              <span>Trạng thái</span>
              <select v-model="form.isActive" class="form-select">
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
            </label>

            <label class="users-field">
              <span>Username</span>
              <input v-model.trim="form.username" class="form-control" placeholder="username" />
            </label>

            <label class="users-field">
              <span>Loại khách</span>
              <select v-model="form.customerType" class="form-select" :disabled="form.role !== 'CUSTOMER'">
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
              <input v-model.trim="form.phone" class="form-control" placeholder="090..." />
            </label>

            <label class="users-field">
              <span>Email</span>
              <input v-model.trim="form.email" class="form-control" placeholder="name@example.com" />
            </label>

            <label class="users-field">
              <span>Provider ưu tiên</span>
              <select v-model="form.preferredAuthProvider" class="form-select">
                <option value="">Chọn provider</option>
                <option value="password">Password</option>
                <option value="google">Google</option>
                <option value="facebook">Facebook</option>
                <option value="apple">Apple</option>
                <option value="zalo">Zalo</option>
                <option value="vneid">VNeID</option>
              </select>
            </label>

            <label class="users-field users-field--full">
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
              <textarea v-model.trim="form.notes" rows="3" class="form-control" placeholder="Thông tin thêm về user"></textarea>
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

          <div class="users-modal__footer">
            <button type="button" class="btn btn-outline-secondary" @click="closeDialog">Hủy</button>
            <button type="submit" class="btn btn-ember" :disabled="saving">
              {{ saving ? "Đang lưu..." : dialogMode === "edit" ? "Cập nhật user" : "Tạo user" }}
            </button>
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
type DialogMode = "create" | "edit";

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

const visiblePages = computed(() => {
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

  return Array.from(new Set(pages));
});

const statCards = computed(() => {
  const source = filteredUsers.value;
  return [
    {
      label: "Tổng user",
      value: source.length,
      hint: "Kết quả sau khi áp bộ lọc hiện tại.",
    },
    {
      label: "Khách hàng",
      value: source.filter((user) => user.role === "CUSTOMER").length,
      hint: "Nhóm khách có thể quay lại để chăm sóc tiếp.",
    },
    {
      label: "Đang active",
      value: source.filter((user) => user.isActive).length,
      hint: "Có thể đăng nhập và tiếp tục sử dụng hệ thống.",
    },
    {
      label: "Có social login",
      value: source.filter((user) => getLoginProviders(user).some((provider) => provider !== "password")).length,
      hint: "Đã liên kết ít nhất một provider ngoài password.",
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

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function editUser(user: UserRecord) {
  dialogMode.value = "edit";
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
  padding-bottom: 48px;
}

.users-hero {
  display: grid;
  gap: 20px;
  background:
    radial-gradient(circle at top right, rgba(var(--green-rgb), 0.12), transparent 28%),
    linear-gradient(135deg, rgba(var(--panel-rgb), 0.96), rgba(243, 251, 247, 0.94));
}

.users-hero__head,
.users-hero__actions,
.section-head,
.user-card__head,
.user-card__actions,
.users-pagination,
.users-pagination__controls,
.users-modal__head,
.users-modal__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.users-hero__copy {
  display: grid;
  gap: 8px;
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
  font-size: clamp(1.5rem, 4vw, 2.15rem);
  line-height: 1.1;
}

.users-hero__description {
  margin: 0;
  max-width: 64ch;
  color: var(--muted);
}

.users-hero__actions {
  flex-wrap: wrap;
}

.users-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.users-stat-card {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  background: rgba(var(--panel-rgb), 0.88);
}

.users-stat-card__label {
  color: var(--muted);
  font-size: 0.84rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.users-stat-card__value {
  margin-top: 10px;
  font-size: 1.7rem;
  font-weight: 800;
}

.users-stat-card__hint {
  margin-top: 8px;
  color: var(--muted);
  font-size: 0.9rem;
}

.users-toolbar,
.users-form-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.users-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.users-field--full {
  grid-column: 1 / -1;
}

.users-search-field {
  grid-column: span 2;
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

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.user-create-card,
.user-card {
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 24px;
  padding: 18px;
  background: rgba(var(--panel-rgb), 0.92);
  box-shadow: var(--shadow);
}

.user-create-card {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 220px;
  border-style: dashed;
  background:
    linear-gradient(180deg, rgba(var(--panel-rgb), 0.92), rgba(246, 249, 255, 0.96)),
    rgba(var(--panel-rgb), 0.92);
  color: var(--text);
  text-align: center;
}

.user-create-card i {
  font-size: 2rem;
  color: var(--ember-strong);
}

.user-create-card span {
  color: var(--muted);
}

.user-card {
  display: grid;
  gap: 14px;
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

.user-card__head {
  align-items: flex-start;
}

.user-card__main {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.user-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-card__name {
  margin: 0;
  font-size: 1.05rem;
}

.user-card__sub,
.user-card__notes,
.users-pagination__summary {
  color: var(--muted);
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

.user-card__meta {
  display: grid;
  gap: 10px;
}

.user-card__line {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--text);
}

.user-card__line i {
  color: var(--muted);
}

.user-card__providers,
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
  align-items: center;
}

.users-pagination__controls {
  flex-wrap: wrap;
  align-items: center;
}

.users-page-button {
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
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
  overflow-y: auto;
}

.users-modal__panel {
  display: grid;
  gap: 18px;
}

.users-modal__form {
  display: grid;
  gap: 18px;
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
}

.users-confirm__text {
  margin: 0;
  color: var(--muted);
}

@media (max-width: 1199px) {
  .users-toolbar,
  .users-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-search-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 767px) {
  .users-admin {
    padding-bottom: 24px;
  }

  .users-hero__head,
  .users-hero__actions,
  .section-head,
  .user-card__head,
  .user-card__actions,
  .users-pagination,
  .users-pagination__controls,
  .users-modal__head,
  .users-modal__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .users-toolbar,
  .users-form-grid,
  .users-grid {
    grid-template-columns: 1fr;
  }

  .users-search-field {
    grid-column: auto;
  }

  .users-modal {
    padding: 12px;
  }

  .users-modal__panel,
  .users-confirm {
    width: min(100%, 100vw - 24px);
  }
}
</style>
