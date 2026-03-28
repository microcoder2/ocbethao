<template>
  <component :is="activeComponent" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from "vue";

const MOBILE_QUERY = "(max-width: 767px)";

const DesktopMenu = defineAsyncComponent(() => import("./Menu.vue"));
const MobileMenu = defineAsyncComponent(() => import("./CustomerMenuMobile.vue"));

const isMobile = ref(
  typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
);

const activeComponent = computed(() => (isMobile.value ? MobileMenu : DesktopMenu));

let mobileQuery: MediaQueryList | null = null;

function syncViewportState(event?: MediaQueryList | MediaQueryListEvent) {
  isMobile.value = event ? event.matches : mobileQuery?.matches ?? false;
}

onMounted(() => {
  if (typeof window === "undefined") return;

  mobileQuery = window.matchMedia(MOBILE_QUERY);
  syncViewportState(mobileQuery);
  mobileQuery.addEventListener("change", syncViewportState);
});

onBeforeUnmount(() => {
  if (!mobileQuery) return;
  mobileQuery.removeEventListener("change", syncViewportState);
});
</script>
