<template>
  <header class="topbar">
    <div class="topbar-main">
      <button
        class="btn topbar-icon-button topbar-menu-button"
        type="button"
        aria-label="Ẩn/hiện menu"
        title="Ẩn/hiện menu"
        @click="$emit('toggle-sidebar')"
      >
        <i class="bi bi-list"></i>
      </button>

      <RouterLink
        v-if="showBrand"
        to="/"
        class="topbar-brand"
        :aria-label="APP_NAME"
        :title="APP_NAME"
      >
        <img :src="logoUrl" :alt="APP_NAME" class="topbar-logo" />
      </RouterLink>
    </div>

    <div class="topbar-actions">
      <RouterLink
        v-if="accountPath"
        :to="accountPath"
        class="btn topbar-icon-button topbar-account-button"
        aria-label="Tài khoản"
        title="Tài khoản"
      >
        <i class="bi bi-person-circle"></i>
      </RouterLink>
      <div class="topbar-user">{{ user?.fullName || APP_NAME }}</div>
      <button
        class="btn topbar-icon-button topbar-logout-button"
        type="button"
        aria-label="Đăng xuất"
        title="Đăng xuất"
        @click="handleLogout"
      >
        <i class="bi bi-box-arrow-right"></i>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { APP_NAME } from "../config";
import logoUrl from "../assets/logo.header.svg";
import { api } from "../api";
import { getUser, logout } from "../utils/auth";

withDefaults(defineProps<{ showBrand?: boolean }>(), {
  showBrand: false,
});

defineEmits<{ "toggle-sidebar": [] }>();

const router = useRouter();
const user = computed(() => getUser());
const accountPath = computed(() => {
  const role = String(user.value?.role || "").toUpperCase();
  if (role === "ADMIN") return "/admin/users";
  if (role === "STAFF") return "/staff/orders";
  if (role === "CUSTOMER") return "/customer/orders";
  return "";
});

async function handleLogout() {
  try {
    await api.post("/auth/logout");
  } finally {
    logout();
    router.replace("/login");
  }
}
</script>
