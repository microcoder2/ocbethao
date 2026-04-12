<template>
  <div class="app-pagination">
    <div class="app-pagination__meta">
      <div class="input-group input-group-sm app-pagination__page-size">
        <span class="input-group-text">Hiển thị</span>
        <select
          class="form-select"
          :value="pageSize"
          :disabled="disabled"
          @change="onPageSizeChange"
        >
          <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
            {{ opt }}
          </option>
        </select>
        <span class="input-group-text">mục</span>
      </div>

      <div v-if="total > 0" class="small text-muted app-pagination__summary">
        Hiển thị
        <strong>
          {{ Math.min((page - 1) * pageSize + 1, total) }}
          –
          {{ Math.min(page * pageSize, total) }}
        </strong>
        của
        <strong>{{ total }}</strong>
        mục
      </div>
      <div v-else class="small text-muted app-pagination__summary">
        Không có mục nào để hiển thị.
      </div>
    </div>

    <div class="app-pagination__controls">
      <div class="btn-group app-pagination__group" role="group" aria-label="Pager">
        <button
          class="btn btn-outline-secondary btn-sm"
          type="button"
          :disabled="page <= 1 || disabled"
          @click="go(1)"
          title="First"
        >
          <i class="bi bi-chevron-double-left"></i>
        </button>
        <button
          class="btn btn-outline-secondary btn-sm"
          type="button"
          :disabled="page <= 1 || disabled"
          @click="go(page - 1)"
          title="Prev"
        >
          <i class="bi bi-chevron-left"></i>
        </button>
      </div>

      <div class="input-group input-group-sm app-pagination__page-input">
        <span class="input-group-text">Trang</span>
        <input
          type="number"
          class="form-control"
          :min="1"
          :max="totalPages"
          v-model.number="inputPage"
          :disabled="disabled || totalPages === 0"
          @change="applyPage"
          @keyup.enter="applyPage"
        />
        <span class="input-group-text">/ {{ totalPages }}</span>
      </div>

      <div class="btn-group app-pagination__group" role="group" aria-label="Pager">
        <button
          class="btn btn-outline-secondary btn-sm"
          type="button"
          :disabled="page >= totalPages || disabled"
          @click="go(page + 1)"
          title="Next"
        >
          <i class="bi bi-chevron-right"></i>
        </button>
        <button
          class="btn btn-outline-secondary btn-sm"
          type="button"
          :disabled="page >= totalPages || disabled"
          @click="go(totalPages)"
          title="Last"
        >
          <i class="bi bi-chevron-double-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "AppPagination" });

import { computed, ref, watch } from "vue";

const props = defineProps<{
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  disabled?: boolean;
}>();
const emit = defineEmits<{
  (e: "update:page", value: number): void;
  (e: "update:page-size", value: number): void;
}>();

function parsePageSizeOptions(value?: string): number[] {
  if (!value) return [];
  const nums = value
    .split(",")
    .map((v) => Number(String(v).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(nums));
}

const envPageSizeOptions = parsePageSizeOptions((import.meta as any).env?.VITE_PAGE_SIZE_OPTIONS);

const pageSizeOptions = computed(() =>
  props.pageSizeOptions ?? (envPageSizeOptions.length ? envPageSizeOptions : [10, 20, 30, 40, 50])
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil((props.total || 0) / Math.max(1, props.pageSize || 10)))
);

const inputPage = ref(props.page || 1);
watch(
  () => props.page,
  (v) => {
    inputPage.value = v || 1;
  }
);

function go(p: number) {
  const np = Math.min(Math.max(1, p), totalPages.value);
  emit("update:page", np);
}
function applyPage() {
  const p = Number(inputPage.value || 1);
  go(p);
}
function onPageSizeChange(ev: Event) {
  const v = Number((ev.target as HTMLSelectElement).value);
  emit("update:page-size", v);
}
</script>

<style scoped>
.app-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.app-pagination__meta,
.app-pagination__controls {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
}

.app-pagination__meta {
  flex: 1 1 auto;
  justify-content: space-between;
}

.app-pagination__controls {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.app-pagination__summary {
  min-width: 0;
}

.app-pagination__page-size {
  max-width: 220px;
  flex: 0 1 220px;
  min-width: 0;
}

.app-pagination__page-input {
  max-width: 140px;
  flex: 0 1 140px;
  min-width: 0;
}

.app-pagination__group {
  flex: 0 0 auto;
}

.app-pagination :deep(.form-select),
.app-pagination :deep(.form-control) {
  min-width: 0;
}

@media (max-width: 767px) {
  .app-pagination {
    display: grid;
    justify-content: center;
  }

  .app-pagination__meta,
  .app-pagination__controls {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .app-pagination__meta {
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .app-pagination__summary {
    text-align: center;
  }

  .app-pagination__controls {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 100%;
    align-self: center;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .app-pagination__controls::-webkit-scrollbar {
    display: none;
  }

  .app-pagination__page-size,
  .app-pagination__page-input,
  .app-pagination__group {
    width: auto;
    max-width: none;
    flex: 1 1 auto;
  }

  .app-pagination__page-size {
    min-width: 160px;
    flex: 0 0 auto;
    margin-inline: auto;
  }

  .app-pagination__page-input {
    min-width: 124px;
    flex: 0 0 auto;
  }

  .app-pagination__group {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .app-pagination__summary {
    margin-inline: auto;
  }

  .app-pagination__group .btn {
    flex: 0 0 auto;
  }
}
</style>
