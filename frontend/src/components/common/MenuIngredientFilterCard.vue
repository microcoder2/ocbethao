<template>
  <div class="mi2f-picker">
    <fieldset
      v-for="bucket in buckets"
      :key="bucket.name"
      class="mi2f-fieldset"
    >
      <button type="button" class="mi2f-legend" @click="$emit('toggle-bucket', bucket.name)">
        <i :class="['bi', openBucketNames.includes(bucket.name) ? 'bi-chevron-down' : 'bi-chevron-right']"></i>
        {{ bucket.name }}
      </button>

      <div
        v-if="openBucketNames.includes(bucket.name)"
        class="mi2f-ingredients"
      >
        <button
          v-for="group in bucket.groups"
          :key="group.key"
          type="button"
          class="mi2f-ingredient"
          :class="{ 'is-active': selectedKey === group.key }"
          @click="$emit('select-group', group.key)"
        >
          {{ group.label }}
          <span v-if="resolveBadge(group) != null" class="mi2f-remaining">{{ resolveBadge(group) }}</span>
        </button>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
type Group = {
  key: string;
  label: string;
  badge?: number | null;
  items: any[];
};

defineProps<{
  buckets: Array<{
    name: string;
    groups: Group[];
  }>;
  openBucketNames: string[];
  selectedKey: string | null;
}>();

defineEmits<{
  "toggle-bucket": [bucketName: string];
  "select-group": [key: string];
}>();

function resolveBadge(group: Group): number | null {
  if (group.badge !== undefined) return group.badge ?? null;
  return group.items.length > 0 ? group.items.length : null;
}
</script>

<style scoped>
.mi2f-picker {
  display: grid;
  gap: 6px;
  padding: 0 6px;
}

.mi2f-fieldset {
  display: grid;
  padding: 0;
  margin: 0;
  min-width: 0;
  border: 1px solid rgba(var(--muted-rgb), 0.15);
  border-radius: 10px;
  background: rgba(var(--panel-rgb), 0.94);
  overflow: hidden;
}

.mi2f-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  margin: 0;
  border: 0;
  background: rgba(var(--line-rgb), 0.12);
  font-size: .76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
  text-align: left;
}

.mi2f-legend:hover {
  color: var(--text);
}

.mi2f-ingredient {
  border: 1px solid rgba(var(--text-rgb), 0.12);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
}

.mi2f-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
}

.mi2f-ingredient {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 0;
  padding: 5px 12px;
  font-size: .82rem;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s, border-color .12s;
}

.mi2f-remaining {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.12);
  color: var(--ember-strong);
  font-size: .74rem;
  font-weight: 800;
}

.mi2f-ingredient.is-active {
  background: rgba(var(--ember-rgb), 0.15);
  border-color: rgba(var(--ember-rgb), 0.5);
  color: var(--ember-strong);
}

.mi2f-ingredient.is-active .mi2f-remaining {
  background: rgba(255, 255, 255, 0.25);
  color: inherit;
}

.mi2f-ingredient:hover:not(:disabled):not(.is-active) {
  background: rgba(var(--ember-rgb), 0.12);
  border-color: rgba(var(--ember-rgb), 0.4);
  color: var(--ember-strong);
}
</style>
