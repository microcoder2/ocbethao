<template>
  <div class="row g-2 d-flex">
    <div
      class="col-12 col-xxl-6 col-xl-6 col-lg-8 col-md-6 d-flex align-items-center gap-2 flex-wrap justify-content-start"
    >
      <div class="input-group input-group-sm" style="max-width: 200px">
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
      <div v-if="total > 0" class="small text-muted">
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
      <div v-else class="small text-muted">Không có mục nào để hiển thị.</div>
    </div>
    <div
      class="col-12 col-xxl-6 col-xl-6 col-lg-4 col-md-6 d-flex align-items-center gap-2 flex-wrap justify-content-start justify-content-xxl-end justify-content-xl-end justify-content-lg-end justify-content-md-end"
    >
      <div class="btn-group" role="group" aria-label="Pager">
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
      <div class="input-group input-group-sm" style="max-width: 140px">
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
      <div class="btn-group" role="group" aria-label="Pager">
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

const envPageSizeOptions = parsePageSizeOptions(
  (import.meta as any).env?.VITE_PAGE_SIZE_OPTIONS
);

const pageSizeOptions = computed(() =>
  props.pageSizeOptions ??
  (envPageSizeOptions.length ? envPageSizeOptions : [10, 20, 30, 40, 50])
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
/* No numbered list — compact layout. The grid ensures 2 rows on small screens. */
</style>
