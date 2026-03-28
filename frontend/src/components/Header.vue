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
      <button
        class="btn topbar-icon-button topbar-account-button"
        type="button"
        aria-label="Hồ sơ"
        title="Hồ sơ"
        @click="showProfile = true"
      >
        <i class="bi bi-person-circle"></i>
      </button>
      <div class="topbar-user">{{ displayName }}</div>
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

  <ProfileModal
    v-if="showProfile"
    @close="showProfile = false"
    @saved="onProfileSaved"
  />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { APP_NAME } from "../config";
import logoUrl from "../assets/logo.header.svg";
import { api } from "../api";
import { getUser, logout } from "../utils/auth";
import ProfileModal from "./ProfileModal.vue";

withDefaults(defineProps<{ showBrand?: boolean }>(), {
  showBrand: false,
});

defineEmits<{ "toggle-sidebar": [] }>();

const router      = useRouter();
const user        = ref(getUser());
const showProfile = ref(false);

const displayName = computed(() => user.value?.fullName || APP_NAME);

function onProfileSaved() {
  user.value = getUser();
}

async function handleLogout() {
  try {
    await api.post("/auth/logout");
  } finally {
    logout();
    router.replace("/login");
  }
}
</script>
