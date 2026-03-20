<template>
  <aside :class="['sidebar-panel', { hidden: !open }]">
    <div class="brand-block">
      <div class="brand-kicker">F&B Ops</div>
      <h1>{{ brand.name }}</h1>
      <p>{{ brand.tagline }}</p>
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
import { brand } from "../content/brand";
import { getMenuByRole } from "../menu";
import { getRole } from "../utils/auth";

defineProps<{ open: boolean }>();

const items = computed(() => getMenuByRole(getRole()));
</script>
