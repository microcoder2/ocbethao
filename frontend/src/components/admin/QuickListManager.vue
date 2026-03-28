<template>
  <Teleport to="body">
    <div class="qlm-backdrop" @click.self="emit('close')">
      <div class="qlm-panel">

        <div class="qlm-header">
          <span>{{ title }}</span>
          <button class="qlm-close" @click="emit('close')"><i class="bi bi-x-lg"></i></button>
        </div>

        <div class="qlm-body">
          <div v-if="items.length === 0 && !allowAdd" class="qlm-empty">Chưa có mục nào.</div>

          <!-- list -->
          <div v-for="item in items" :key="item.id" class="qlm-row">

            <!-- confirm delete -->
            <template v-if="deleteId === item.id">
              <span class="qlm-label qlm-label--del">Xóa "{{ item[fields[0].key] }}"?</span>
              <button class="qlm-btn qlm-btn--del" @click="doRemove(item.id)">Xóa</button>
              <button class="qlm-btn" @click="deleteId = null">Không</button>
            </template>

            <!-- edit mode -->
            <template v-else-if="editId === item.id">
              <div class="qlm-edit-fields">
                <template v-for="f in fields" :key="f.key">
                  <label v-if="f.type === 'checkbox'" class="qlm-check">
                    <input v-model="(draft as any)[f.key]" type="checkbox" />
                    <span>{{ f.label }}</span>
                  </label>
                  <input
                    v-else
                    v-model="(draft as any)[f.key]"
                    :type="f.type || 'text'"
                    :placeholder="f.placeholder || f.label"
                    class="qlm-input"
                    @keyup.enter="doUpdate(item.id)"
                  />
                </template>
              </div>
              <button class="qlm-btn qlm-btn--save" :disabled="busy" @click="doUpdate(item.id)">OK</button>
              <button class="qlm-btn" @click="editId = null">✕</button>
            </template>

            <!-- normal view -->
            <template v-else>
              <span class="qlm-label">{{ item[fields[0].key] }}</span>
              <span
                v-if="fields[1] && item[fields[1].key] !== undefined && fields[1].type !== 'checkbox'"
                class="qlm-extra"
              >#{{ item[fields[1].key] }}</span>
              <span
                v-if="fields.find(f => f.type === 'checkbox') as FieldDef | undefined"
                class="qlm-badge"
                :class="item[(fields.find(f => f.type === 'checkbox') as FieldDef).key] ? 'qlm-badge--on' : 'qlm-badge--off'"
              >
                {{ item[(fields.find(f => f.type === 'checkbox') as FieldDef).key] ? 'on' : 'off' }}
              </span>
              <div class="qlm-row-actions">
                <button class="qlm-icon-btn" title="Sửa" @click="startEdit(item)">
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  v-if="allowDelete"
                  class="qlm-icon-btn qlm-icon-btn--del"
                  title="Xóa"
                  @click="deleteId = item.id"
                >
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            </template>

          </div>

          <!-- add new -->
          <div v-if="allowAdd" class="qlm-add-row">
            <template v-for="f in fields.filter(f => f.type !== 'checkbox')" :key="f.key">
              <input
                v-model="(newDraft as any)[f.key]"
                :type="f.type || 'text'"
                :placeholder="f.placeholder || `Thêm ${f.label.toLowerCase()}...`"
                class="qlm-input"
                @keyup.enter="doAdd"
              />
            </template>
            <button
              class="qlm-btn qlm-btn--add"
              :disabled="busy || !String((newDraft as any)[fields[0].key] ?? '').trim()"
              @click="doAdd"
            >
              <i v-if="busy" class="bi bi-hourglass-split"></i>
              <i v-else class="bi bi-plus-lg"></i>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox";
  placeholder?: string;
}

export interface ListItem {
  id: string | number;
  [key: string]: any;
}

const props = withDefaults(defineProps<{
  title: string;
  items: ListItem[];
  fields?: FieldDef[];
  allowAdd?: boolean;
  allowDelete?: boolean;
  busy?: boolean;
}>(), {
  fields: () => [{ key: "name", label: "Tên" }],
  allowAdd: true,
  allowDelete: true,
  busy: false,
});

const emit = defineEmits<{
  add:    [data: Record<string, any>];
  update: [id: string | number, data: Record<string, any>];
  remove: [id: string | number];
  close:  [];
}>();

const editId   = ref<string | number | null>(null);
const deleteId = ref<string | number | null>(null);
const draft    = ref<Record<string, any>>({});
const newDraft = ref<Record<string, any>>(buildBlank());

function buildBlank(): Record<string, any> {
  const d: Record<string, any> = {};
  for (const f of props.fields) {
    d[f.key] = f.type === "checkbox" ? false : f.type === "number" ? 0 : "";
  }
  return d;
}

// reset newDraft when fields change
watch(() => props.fields, () => { newDraft.value = buildBlank(); }, { deep: true });

function startEdit(item: ListItem) {
  editId.value   = item.id;
  deleteId.value = null;
  const d: Record<string, any> = {};
  for (const f of props.fields) {
    d[f.key] = item[f.key] ?? (f.type === "checkbox" ? false : f.type === "number" ? 0 : "");
  }
  draft.value = d;
}

function doUpdate(id: string | number) {
  if (props.busy) return;
  emit("update", id, { ...draft.value });
  editId.value = null;
}

function doAdd() {
  const name = String((newDraft.value as any)[props.fields[0].key] ?? "").trim();
  if (!name || props.busy) return;
  emit("add", { ...newDraft.value });
  newDraft.value = buildBlank();
}

function doRemove(id: string | number) {
  emit("remove", id);
  deleteId.value = null;
}
</script>

<style scoped>
.qlm-backdrop {
  position: fixed; inset: 0; z-index: 1050;
  background: rgba(18, 16, 13, 0.4);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.qlm-panel {
  background: #fff;
  border-radius: 18px;
  width: 100%;
  max-width: 380px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}

.qlm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text);
  flex-shrink: 0;
}

.qlm-close {
  width: 28px; height: 28px;
  border-radius: 8px; border: none;
  background: transparent; cursor: pointer;
  color: var(--muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem;
  transition: background 0.12s, color 0.12s;
}
.qlm-close:hover { background: rgba(0, 0, 0, 0.06); color: var(--text); }

.qlm-body {
  padding: 10px 14px 14px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.qlm-empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 16px 0;
}

/* ── rows ── */
.qlm-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 8px;
  min-height: 36px;
  transition: background 0.1s;
}
.qlm-row:hover { background: rgba(0, 0, 0, 0.03); }

.qlm-label {
  flex: 1;
  font-size: 0.88rem;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qlm-label--del {
  color: var(--muted);
  font-style: italic;
}

.qlm-extra {
  font-size: 0.75rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.qlm-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
.qlm-badge--on  { background: rgba(34,197,94,0.12); color: #166534; }
.qlm-badge--off { background: rgba(0,0,0,0.07);     color: var(--muted); }

/* ── edit fields inline ── */
.qlm-edit-fields {
  flex: 1;
  display: flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
}

.qlm-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text);
  background: rgba(255,255,255,0.9);
  outline: none;
  transition: border-color 0.12s;
}
.qlm-input:focus { border-color: var(--ember); }
.qlm-input[type="number"] { width: 60px; flex: none; }

.qlm-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── row buttons ── */
.qlm-row-actions {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.qlm-icon-btn {
  width: 26px; height: 26px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.75rem; padding: 0;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.qlm-icon-btn:hover {
  background: rgba(201,87,43,0.08);
  color: var(--ember);
  border-color: rgba(201,87,43,0.2);
}
.qlm-icon-btn--del:hover {
  background: rgba(201,50,30,0.09);
  color: rgb(201,50,30);
  border-color: rgba(201,50,30,0.2);
}

.qlm-btn {
  padding: 4px 10px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s;
}
.qlm-btn:hover { background: rgba(0,0,0,0.05); }
.qlm-btn:disabled { opacity: 0.5; cursor: default; }

.qlm-btn--save {
  background: linear-gradient(135deg, var(--ember), var(--ember-strong, #b5521a));
  color: #fff;
  border-color: transparent;
}
.qlm-btn--save:hover { opacity: 0.88; background: linear-gradient(135deg, var(--ember), var(--ember-strong, #b5521a)); }

.qlm-btn--del {
  background: rgba(201,50,30,0.1);
  color: rgb(201,50,30);
  border-color: rgba(201,50,30,0.2);
}
.qlm-btn--del:hover { background: rgba(201,50,30,0.18); }

/* ── add new row ── */
.qlm-add-row {
  display: flex;
  gap: 5px;
  align-items: center;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}

.qlm-btn--add {
  width: 32px; height: 32px; padding: 0; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--ember), var(--ember-strong, #b5521a));
  color: #fff;
  border-color: transparent;
  border-radius: 9px;
}
.qlm-btn--add:hover { opacity: 0.88; }
</style>
