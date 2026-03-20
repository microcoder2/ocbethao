<template>
  <div class="d-grid gap-4">
    <section class="row g-4">
      <div class="col-12 col-xl-5">
        <div class="page-panel">
          <div class="panel-title">{{ form.id ? "Cap nhat user" : "Them user" }}</div>
          <form class="form-grid" @submit.prevent="saveUser">
            <input v-model="form.fullName" class="form-control" placeholder="Ho ten" />
            <input v-model="form.username" class="form-control" placeholder="Username" />
            <select v-model="form.role" class="form-select">
              <option value="ADMIN">ADMIN</option>
              <option value="STAFF">STAFF</option>
              <option value="CUSTOMER">CUSTOMER</option>
            </select>
            <div class="row g-3">
              <div class="col-6"><input v-model="form.phone" class="form-control" placeholder="So dien thoai" /></div>
              <div class="col-6"><input v-model="form.email" class="form-control" placeholder="Email" /></div>
            </div>
            <div class="row g-3">
              <div class="col-6"><input v-model="form.zaloId" class="form-control" placeholder="Zalo ID" /></div>
              <div class="col-6"><input v-model="form.appleId" class="form-control" placeholder="Apple ID" /></div>
            </div>
            <div class="row g-3">
              <div class="col-6">
                <select v-model="form.preferredAuthProvider" class="form-select">
                  <option value="">Provider mac dinh</option>
                  <option value="PHONE">PHONE</option>
                  <option value="EMAIL">EMAIL</option>
                  <option value="ZALO">ZALO</option>
                  <option value="APPLE">APPLE</option>
                </select>
              </div>
              <div class="col-6">
                <select v-model="form.customerType" class="form-select">
                  <option value="">Loai khach</option>
                  <option value="REGULAR">REGULAR</option>
                  <option value="VIP">VIP</option>
                  <option value="OFFICE">OFFICE</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="TOURIST">TOURIST</option>
                </select>
              </div>
            </div>
            <input v-model="form.password" type="password" class="form-control" placeholder="Mat khau" />
            <textarea v-model="form.notes" rows="2" class="form-control" placeholder="Ghi chu noi bo"></textarea>
            <button class="btn btn-ember">Luu user</button>
          </form>
        </div>
      </div>

      <div class="col-12 col-xl-7">
        <div class="page-panel">
          <div class="panel-title">Danh sach user</div>
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Ho ten</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Dinh danh</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td>{{ user.fullName }}</td>
                  <td>{{ user.username || "--" }}</td>
                  <td>{{ user.role }}</td>
                  <td>{{ user.phone || user.email || user.zaloId || user.appleId || "--" }}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-dark" @click="editUser(user)">Sua</button>
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
  zaloId: "",
  appleId: "",
  preferredAuthProvider: "",
  customerType: "",
  password: "",
  notes: "",
});

function resetForm() {
  Object.assign(form, {
    id: null,
    fullName: "",
    username: "",
    role: "STAFF",
    phone: "",
    email: "",
    zaloId: "",
    appleId: "",
    preferredAuthProvider: "",
    customerType: "",
    password: "",
    notes: "",
  });
}

async function loadUsers() {
  const { data } = await api.get("/users");
  users.value = data;
}

function editUser(user: any) {
  Object.assign(form, {
    id: user.id,
    fullName: user.fullName,
    username: user.username || "",
    role: user.role,
    phone: user.phone || "",
    email: user.email || "",
    zaloId: user.zaloId || "",
    appleId: user.appleId || "",
    preferredAuthProvider: user.preferredAuthProvider || "",
    customerType: user.customerType || "",
    password: "",
    notes: user.notes || "",
  });
}

async function saveUser() {
  const payload = {
    fullName: form.fullName,
    username: form.username || undefined,
    role: form.role,
    phone: form.phone || undefined,
    email: form.email || undefined,
    zaloId: form.zaloId || undefined,
    appleId: form.appleId || undefined,
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
