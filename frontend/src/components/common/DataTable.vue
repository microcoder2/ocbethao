<template>
  <div class="position-relative">
    <LoadingOverlay :show="loading" />
    <div class="table-responsive dt-responsive" :class="responsiveClass">
      <table class="table table-sm align-middle mb-0 dt-table" :class="tableClass">
        <thead>
          <tr :class="headerRowClass || 'text-uppercase text-muted small'">
            <th v-if="showCheckbox" :class="headerCellClass" style="width: 36px">
              <input
                class="form-check-input"
                type="checkbox"
                :checked="allPageSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[headerCellClass, col.thClass]"
            >
              {{ col.title }}
            </th>
            <th
              v-if="$slots['row-actions']"
              :class="['text-end', headerCellClass, actionHeaderClass]"
            >
              {{ actionHeaderText || "" }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in items"
            :key="row[rowKey]"
            class="dt-row"
            :class="bodyRowClass"
          >
            <td v-if="showCheckbox" :class="bodyCellClass">
              <input
                class="form-check-input"
                type="checkbox"
                :checked="isSelected(row)"
                @change="(e) => onToggle(row, e)"
              />
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="dt-td"
              :class="[bodyCellClass, col.tdClass]"
            >
              <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
            <td
              v-if="$slots['row-actions']"
              class="text-end dt-actions-td"
              :class="[bodyCellClass, actionCellClass]"
            >
              <slot name="row-actions" :row="row" />
            </td>
          </tr>
          <tr v-if="!loading && items.length === 0">
            <td
              :colspan="
                columns.length +
                (showCheckbox ? 1 : 0) +
                ($slots['row-actions'] ? 1 : 0)
              "
              class="text-center text-muted dt-empty-cell"
              :class="[bodyCellClass, emptyCellClass]"
            >
              {{ emptyText || "Không có dữ liệu" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LoadingOverlay from "./LoadingOverlay.vue";

type Column = {
  key: string;
  title: string;
  thClass?: string;
  tdClass?: string;
};

const props = defineProps<{
  columns: Column[];
  items: any[];
  rowKey: string;
  loading?: boolean;
  showCheckbox?: boolean;
  selectedIds?: Set<any>;
  emptyText?: string;
  responsiveClass?: string;
  tableClass?: string;
  headerCellClass?: string;
  headerRowClass?: string;
  bodyRowClass?: string;
  bodyCellClass?: string;
  actionHeaderClass?: string;
  actionHeaderText?: string;
  actionCellClass?: string;
  emptyCellClass?: string;
}>();

function isSelected(row: any) {
  if (!props.selectedIds) return false;
  return props.selectedIds.has(row[props.rowKey]);
}

const allPageSelected = computed(
  () =>
    !!props.showCheckbox &&
    (props.items?.length || 0) > 0 &&
    props.items.every((r) =>
      props.selectedIds ? props.selectedIds.has(r[props.rowKey]) : false
    )
);

function onToggle(row: any, ev: Event) {
  if (!props.selectedIds) return;
  const id = row[props.rowKey];
  const checked = (ev.target as HTMLInputElement).checked;
  if (checked) props.selectedIds.add(id);
  else props.selectedIds.delete(id);
}

function toggleSelectAll(ev: Event) {
  if (!props.selectedIds) return;
  const checked = (ev.target as HTMLInputElement).checked;
  props.items.forEach((r) =>
    checked
      ? props.selectedIds!.add(r[props.rowKey])
      : props.selectedIds!.delete(r[props.rowKey])
  );
}
</script>

<style scoped>
</style>
