<template>
  <div class="app-shell">
    <AppSidebar :open="sidebarOpen" class="layout-sidebar" />
    <div class="app-main">
      <AppHeader :show-brand="showHeaderBrand" @toggle-sidebar="toggleSidebar" />
      <main class="app-content">
        <RouterView />
      </main>
    </div>
    <div v-if="sidebarOpen" class="app-overlay d-lg-none" @click="mobileSidebarOpen = false"></div>
  </div>
</template>

<script setup lang="ts">
import { RouterView, useRoute } from "vue-router";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppHeader from "../components/Header.vue";
import AppSidebar from "../components/Sidebar.vue";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 991px)";
const isMobile = ref(false);
const mobileSidebarOpen = ref(false);
const desktopSidebarOpen = ref(true);

const sidebarOpen = computed(() =>
  isMobile.value ? mobileSidebarOpen.value : desktopSidebarOpen.value
);
const showHeaderBrand = computed(() => isMobile.value && !mobileSidebarOpen.value);

const route = useRoute();
watch(() => route.path, () => {
  if (isMobile.value) mobileSidebarOpen.value = false;
});

let mobileQuery: MediaQueryList | null = null;

function syncViewportState(event?: MediaQueryList | MediaQueryListEvent) {
  const matches = event ? event.matches : mobileQuery?.matches ?? false;
  isMobile.value = matches;

  if (!matches) {
    mobileSidebarOpen.value = false;
  }
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileSidebarOpen.value = !mobileSidebarOpen.value;
  } else {
    desktopSidebarOpen.value = !desktopSidebarOpen.value;
  }
}

onMounted(() => {
  mobileQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
  syncViewportState(mobileQuery);
  mobileQuery.addEventListener("change", syncViewportState);
});

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener("change", syncViewportState);
});
</script>
