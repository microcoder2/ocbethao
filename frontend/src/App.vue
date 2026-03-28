<template>
  <RouterView />
  <ThemeSwitcher v-if="isDev" />
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { onMounted } from "vue";
import ThemeSwitcher from "./components/ThemeSwitcher.vue";
import { initTheme } from "./themes";

const isDev = import.meta.env.DEV;

onMounted(() => initTheme());
</script>
