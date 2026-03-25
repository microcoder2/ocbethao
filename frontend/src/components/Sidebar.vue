<template>
  <aside :class="['sidebar-panel', { hidden: !open }]">
    <div class="brand-block">
      <RouterLink
        to="/"
        class="sidebar-brand"
        aria-label="Ốc Bé Thảo"
        title="Ốc Bé Thảo"
      >
        <img :src="logoUrl" alt="Ốc Bé Thảo" class="sidebar-logo" />
      </RouterLink>
    </div>

    <nav class="nav flex-column gap-2 px-3 pb-4">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="sidebar-link"
      >
        <i :class="['bi', item.icon]"></i>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import logoUrl from "../assets/oc-be-thao-logo.svg";
import { getMenuByRole } from "../menu";
import { getRole } from "../utils/auth";

defineProps<{ open: boolean }>();

const items = computed(() => getMenuByRole(getRole()));
</script>
