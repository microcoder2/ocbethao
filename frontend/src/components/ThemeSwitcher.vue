<template>
  <div class="tsw-wrap">
    <Transition name="tsw-panel">
      <div v-if="open" class="tsw-panel">
        <div class="tsw-label">Theme</div>
        <button
          v-for="t in THEMES"
          :key="t.id"
          class="tsw-option"
          :class="{ active: current === t.id }"
          @click="select(t.id)"
        >
          <span class="tsw-swatch" :style="{ background: t.swatch }"></span>
          <span class="tsw-name">{{ t.name }}</span>
          <i v-if="current === t.id" class="bi bi-check2 tsw-check"></i>
        </button>
      </div>
    </Transition>

    <button class="tsw-btn" :class="{ open }" title="Đổi theme (DEV)" @click="open = !open">
      <i class="bi bi-palette2"></i>
      <span class="tsw-dev-badge">DEV</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { THEMES, applyTheme, getCurrentTheme } from "../themes";

const open    = ref(false);
const current = ref(getCurrentTheme());

function select(id: string) {
  current.value = id;
  applyTheme(id);
}
</script>

<style scoped>
.tsw-wrap {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

/* ── toggle button ── */
.tsw-btn {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1.5px solid rgba(255,255,255,0.25);
  background: rgba(var(--ember-rgb), 0.92);
  color: #fff;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  transition: background 0.18s, transform 0.15s;
  position: relative;
  padding: 0;
}
.tsw-btn:hover  { background: rgba(var(--ember-rgb), 1); }
.tsw-btn.open   { transform: rotate(15deg); }
.tsw-btn:active { transform: scale(0.93); }

.tsw-dev-badge {
  position: absolute;
  top: -6px; right: -4px;
  background: #111;
  color: #fff;
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;
  pointer-events: none;
}

/* ── panel ── */
.tsw-panel {
  background: var(--panel);
  border: 1px solid rgba(var(--line-rgb), 0.7);
  border-radius: 16px;
  padding: 10px 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 140px;
}

.tsw-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 2px 8px 6px;
  border-bottom: 1px solid rgba(var(--line-rgb), 0.5);
  margin-bottom: 2px;
}

.tsw-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.12s;
  color: var(--text);
}
.tsw-option:hover  { background: rgba(var(--ember-rgb), 0.07); }
.tsw-option.active { background: rgba(var(--ember-rgb), 0.1); }

.tsw-swatch {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.tsw-name {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
}

.tsw-check {
  font-size: 0.8rem;
  color: var(--ember);
  flex-shrink: 0;
}

/* ── transition ── */
.tsw-panel-enter-active { transition: opacity 0.15s, transform 0.15s; }
.tsw-panel-leave-active { transition: opacity 0.12s, transform 0.1s; }
.tsw-panel-enter-from   { opacity: 0; transform: translateY(8px) scale(0.96); }
.tsw-panel-leave-to     { opacity: 0; transform: translateY(6px) scale(0.97); }
</style>
