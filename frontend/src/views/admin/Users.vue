<template>
  <div class="d-grid gap-4">
    <section class="row g-4">
      <div class="col-12 col-xl-5">
        <div class="page-panel">
          <div class="panel-title">{{ form.id ? "Cập nhật user" : "Thêm user" }}</div>
          <form class="form-grid" @submit.prevent="saveUser">
            <input v-model="form.fullName" class="form-control" placeholder="Họ tên" />
            <input v-model="form.username" class="form-control" placeholder="Username" />
            <select v-model="form.role" class="form-select">
              <option value="ADMIN">ADMIN</option>
              <option value="STAFF">STAFF</option>
              <option value="CUSTOMER">CUSTOMER</option>
            </select>
            <div class="row g-3">
              <div class="col-6"><input v-model="form.phone" class="form-control" placeholder="Số điện thoại" /></div>
              <div class="col-6"><input v-model="form.email" class="form-control" placeholder="Email" /></div>
            </div>
            <div class="row g-3">
              <div class="col-6">
                <select v-model="form.preferredAuthProvider" class="form-select">
                  <option value="">Provider mặc định</option>
                  <option value="password">Password</option>
                  <option value="google">Google</option>
                  <option value="facebook">Facebook</option>
                  <option value="apple">Apple</option>
                  <option value="zalo">Zalo</option>
                  <option value="vneid">VNeID</option>
                </select>
              </div>
              <div class="col-6">
                <select v-model="form.customerType" class="form-select">
                  <option value="">Loại khách</option>
                  <option value="REGULAR">REGULAR</option>
                  <option value="VIP">VIP</option>
                  <option value="OFFICE">OFFICE</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="TOURIST">TOURIST</option>
                </select>
              </div>
            </div>
            <input v-model="form.password" type="password" class="form-control" placeholder="Mật khẩu" />
            <textarea v-model="form.notes" rows="2" class="form-control" placeholder="Ghi chú nội bộ"></textarea>
            <button class="btn btn-ember">Lưu user</button>
          </form>
          <div v-if="form.authIdentityLabels.length" class="mt-3 small text-muted">
            Provider đã liên kết: {{ form.authIdentityLabels.join(", ") }}
          </div>
        </div>
      </div>

      <div class="col-12 col-xl-7">
        <div class="page-panel">
          <div class="panel-title">Danh sách user</div>
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Định danh</th>
                  <th>Đăng nhập qua</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.fullName }}</td>
                  <td>{{ user.username || "--" }}</td>
                  <td>{{ user.role }}</td>
                  <td>{{ [user.phone, user.email].filter(Boolean).join(" / ") || "--" }}</td>
                  <td>
                    <div v-if="getLoginProviders(user).length" class="d-flex flex-wrap gap-1">
                      <span
                        v-for="provider in getLoginProviders(user)"
                        :key="provider"
                        class="badge"
                        :class="provider === getPrimaryProvider(user) ? 'text-bg-dark' : 'text-bg-light border'"
                      >
                        {{ formatProviderLabel(provider) }}
                      </span>
                    </div>
                    <span v-else>--</span>
                  </td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-dark" @click="editUser(user)">Sửa</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../../api";

const users = ref<any[]>([]);

const form = reactive<any>({
  id: null,
  fullName: "",
  username: "",
  role: "STAFF",
  phone: "",
  email: "",
  preferredAuthProvider: "",
  customerType: "",
  password: "",
  notes: "",
  authIdentityLabels: [] as string[],
});

function resetForm() {
  Object.assign(form, {
    id: null,
    fullName: "",
    username: "",
    role: "STAFF",
    phone: "",
    email: "",
    preferredAuthProvider: "",
    customerType: "",
    password: "",
    notes: "",
    authIdentityLabels: [],
  });
}

async function loadUsers() {
  const { data } = await api.get("/users");
  users.value = data;
}

function getLoginProviders(user: any): string[] {
  const providers = Array.isArray(user.linkedAuthProviders) ? [...user.linkedAuthProviders] : [];
  if (user.hasPassword && !providers.includes("password")) {
    providers.unshift("password");
  }
  return providers;
}

function getPrimaryProvider(user: any): string {
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

function editUser(user: any) {
  Object.assign(form, {
    id: user.id,
    fullName: user.fullName,
    username: user.username || "",
    role: user.role,
    phone: user.phone || "",
    email: user.email || "",
    preferredAuthProvider: user.preferredAuthProvider || "",
    customerType: user.customerType || "",
    password: "",
    notes: user.notes || "",
    authIdentityLabels: (user.authIdentities || []).map((identity: any) => {
      const handle =
        identity.providerUsername || identity.providerEmail || identity.providerPhone || identity.providerUserId;
      return `${identity.provider}:${handle}`;
    }),
  });
}

async function saveUser() {
  const payload = {
    fullName: form.fullName,
    username: form.username || undefined,
    role: form.role,
    phone: form.phone || undefined,
    email: form.email || undefined,
    preferredAuthProvider: form.preferredAuthProvider || undefined,
    customerType: form.customerType || undefined,
    password: form.password || undefined,
    notes: form.notes || undefined,
  };
  if (form.id) {
    await api.put(`/users/${form.id}`, payload);
  } else {
    await api.post("/users", payload);
  }
  await loadUsers();
  resetForm();
}

onMounted(async () => {
  await loadUsers();
  resetForm();
});
</script>
