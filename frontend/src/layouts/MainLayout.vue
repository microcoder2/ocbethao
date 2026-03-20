<template>
  <div class="app-shell">
    <AppSidebar :open="sidebarOpen" class="layout-sidebar" />
    <div class="app-main">
      <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main class="app-content">
        <RouterView />
      </main>
    </div>
    <div v-if="sidebarOpen" class="app-overlay d-lg-none" @click="sidebarOpen = false"></div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted, ref } from "vue";
import AppHeader from "../components/Header.vue";
import AppSidebar from "../components/Sidebar.vue";

const sidebarOpen = ref(true);

onMounted(() => {
  if (window.matchMedia("(max-width: 991px)").matches) {
    sidebarOpen.value = false;
  }
});
</script>
