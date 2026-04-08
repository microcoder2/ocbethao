<template>
  <section class="stock-workspace">
    <header class="stock-workspace__header">
      <div>
        <h1 class="stock-workspace__title">Tồn kho hiện tại</h1>
        <p class="stock-workspace__note">
          Quản lý trực tiếp nguyên liệu đang có và số lượng còn bán.
        </p>
      </div>
      <button
        class="stock-workspace__save btn-ember"
        type="button"
        :disabled="saving"
        @click="saveStocks"
      >
        <i :class="saving ? 'bi bi-hourglass-split' : 'bi bi-floppy'"></i>
        <span>{{ saving ? "Đang lưu..." : "Lưu tồn kho" }}</span>
      </button>
    </header>

    <div v-if="errorMessage" class="stock-workspace__error">{{ errorMessage }}</div>

    <DailyStockPanel @updated="stockDraft = $event" />
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";
import DailyStockPanel, { type PoolSummary } from "../../components/admin/DailyStockPanel.vue";

const stockDraft = ref<PoolSummary[]>([]);
const saving = ref(false);
const errorMessage = ref("");

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

async function saveStocks() {
  saving.value = true;
  errorMessage.value = "";
  try {
    await api.put(
      "/ingredient-stocks",
      stockDraft.value.map((item) => ({
        ingredientId: item.ingredientId,
        label: item.label,
        quantity: Number(item.quantity || 0),
        isAvailable: item.isAvailable,
        note: item.note,
      }))
    );
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Không lưu được tồn kho.");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.stock-workspace {
  display: grid;
  gap: 16px;
}

.stock-workspace__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.stock-workspace__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
}

.stock-workspace__note {
  margin: 6px 0 0;
  color: var(--muted);
}

.stock-workspace__save {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  color: #fff;
  font-weight: 700;
}

.stock-workspace__save:disabled {
  opacity: 0.6;
}

.stock-workspace__error {
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(var(--danger-rgb), 0.08);
  color: var(--danger);
}

@media (max-width: 767px) {
  .stock-workspace__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
