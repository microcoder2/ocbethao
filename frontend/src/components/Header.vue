<template>
  <header class="topbar">
    <div class="d-flex align-items-center gap-3">
      <button class="btn btn-outline-light d-lg-none" @click="$emit('toggle-sidebar')">
        <i class="bi bi-list"></i>
      </button>
      <div>
        <div class="eyebrow">Quan tri van hanh</div>
        <div class="fw-semibold">{{ pageTitle }}</div>
      </div>
    </div>
    <div class="d-flex align-items-center gap-3">
      <div class="text-end small">
        <div class="fw-semibold">{{ user?.fullName || APP_NAME }}</div>
        <div class="text-muted">{{ user?.role || "GUEST" }}</div>
      </div>
      <button class="btn btn-sm btn-ember" @click="handleLogout">Dang xuat</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { APP_NAME } from "../config";
import { api } from "../api";
import { getUser, logout } from "../utils/auth";

defineEmits<{ "toggle-sidebar": [] }>();

const route = useRoute();
const router = useRouter();
const user = computed(() => getUser());
const pageTitle = computed(() => String(route.meta.title || APP_NAME));

async function handleLogout() {
  try {
    await api.post("/auth/logout");
  } finally {
    logout();
    router.replace("/login");
  }
}
</script>
