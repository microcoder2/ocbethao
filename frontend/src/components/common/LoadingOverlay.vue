<template>
  <div v-if="show" class="loading-overlay">
    <div class="loading-overlay__spinner" aria-label="Đang tải"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show?: boolean;
}>();
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(1px);
}

.loading-overlay__spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(0, 0, 0, 0.12);
  border-top-color: var(--ember, #c56a2d);
  animation: loading-overlay-spin 0.7s linear infinite;
}

@keyframes loading-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
