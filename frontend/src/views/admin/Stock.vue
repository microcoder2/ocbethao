<template>
  <section class="stock-workspace">
    <header class="stock-workspace__header">
      <div class="stock-workspace__copy">
        <h1 class="stock-workspace__title">Tồn kho hiện tại</h1>
        <p class="stock-workspace__note">
          Quản lý trực tiếp nguyên liệu đang có và số lượng còn bán.
        </p>
        <p class="stock-workspace__snapshot-note">
          Lưu số buổi sáng xong rồi chụp snapshot đầu ngày để khóa log kiểm toán.
        </p>
        <div class="stock-workspace__snapshot-status" :class="{ 'is-ready': snapshotStatus, 'is-empty': !snapshotStatus }">
          <i :class="snapshotStatus ? 'bi bi-calendar-check' : 'bi bi-calendar-x'"></i>
          <span>
            {{
              snapshotStatus
                ? `Snapshot hôm nay đã chụp lúc ${formatDateTime(snapshotStatus.capturedAt)}`
                : "Chưa chụp snapshot đầu ngày hôm nay."
            }}
          </span>
          <strong v-if="snapshotStatus">
            Tổng kho đầu ngày: {{ formatQuantity(snapshotStatus.totalRemainingQuantity) }}
          </strong>
        </div>
      </div>
      <div class="stock-workspace__actions">
        <button
          class="stock-workspace__snapshot btn btn-outline-dark"
          type="button"
          :disabled="snapshotSaving || snapshotLoading"
          @click="handleSnapshotClick"
        >
          <i :class="snapshotActionIcon"></i>
          <span>{{ snapshotActionLabel }}</span>
        </button>

        <button
          class="stock-workspace__save btn-ember"
          type="button"
          :disabled="saving"
          @click="saveStocks"
        >
          <i :class="saving ? 'bi bi-hourglass-split' : 'bi bi-floppy'"></i>
          <span>{{ saving ? "Đang lưu..." : "Lưu tồn kho" }}</span>
        </button>
      </div>
    </header>

    <div v-if="snapshotNotice" class="stock-workspace__notice" :class="`is-${snapshotNotice.kind}`">
      {{ snapshotNotice.text }}
    </div>

    <div v-if="errorMessage" class="stock-workspace__error">{{ errorMessage }}</div>

    <DailyStockPanel @updated="stockDraft = $event" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../../api";
import DailyStockPanel, { type PoolSummary } from "../../components/admin/DailyStockPanel.vue";

type OpeningSnapshot = {
  day: string;
  capturedAt: string;
  totalRemainingQuantity: number;
};

type OpeningSnapshotLookupResponse = {
  snapshot: OpeningSnapshot | null;
};

type OpeningSnapshotCaptureResponse = {
  created: boolean;
  snapshot: OpeningSnapshot;
};

type SnapshotNotice = {
  kind: "success" | "info" | "error";
  text: string;
};

const stockDraft = ref<PoolSummary[]>([]);
const saving = ref(false);
const errorMessage = ref("");
const snapshotLoading = ref(false);
const snapshotSaving = ref(false);
const snapshotStatus = ref<OpeningSnapshot | null>(null);
const snapshotNotice = ref<SnapshotNotice | null>(null);

const snapshotActionLabel = computed(() =>
  snapshotStatus.value ? "Chụp lại đầu ngày" : "Chụp đầu ngày"
);

const snapshotActionIcon = computed(() =>
  snapshotSaving.value ? "bi bi-hourglass-split" : snapshotStatus.value ? "bi bi-arrow-repeat" : "bi bi-camera"
);

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatQuantity(value: number) {
  const amount = Number(value || 0);
  return amount.toLocaleString("vi-VN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function setSnapshotNotice(kind: SnapshotNotice["kind"], text: string) {
  snapshotNotice.value = { kind, text };
}

async function loadOpeningSnapshotStatus() {
  snapshotLoading.value = true;

  try {
    const { data } = await api.get("/inventory-movements/opening-snapshot");
    const response = data as OpeningSnapshotLookupResponse;
    snapshotStatus.value = response.snapshot || null;
  } catch (error) {
    snapshotStatus.value = null;
    setSnapshotNotice("error", getErrorMessage(error, "Không tải được trạng thái snapshot đầu ngày."));
  } finally {
    snapshotLoading.value = false;
  }
}

async function captureOpeningSnapshot(force = false) {
  if (force && snapshotStatus.value) {
    const confirmed = window.confirm(
      "Snapshot đầu ngày hôm nay đã có rồi. Chụp lại sẽ dùng số hiện tại và thay snapshot kiểm toán của ngày này. Tiếp tục?"
    );
    if (!confirmed) {
      return;
    }
  }

  snapshotSaving.value = true;
  snapshotNotice.value = null;

  try {
    const { data } = await api.post("/inventory-movements/opening-snapshot", {
      force,
    });
    const response = data as OpeningSnapshotCaptureResponse;
    snapshotStatus.value = response.snapshot;

    setSnapshotNotice(
      force
        ? "success"
        : response.created
          ? "success"
          : "info",
      force
        ? `Đã chụp lại snapshot đầu ngày lúc ${formatDateTime(response.snapshot.capturedAt)}.`
        : response.created
          ? `Đã ghi nhận snapshot đầu ngày lúc ${formatDateTime(response.snapshot.capturedAt)}.`
          : `Snapshot đầu ngày hôm nay đã có sẵn từ ${formatDateTime(response.snapshot.capturedAt)}.`
    );
  } catch (error) {
    setSnapshotNotice("error", getErrorMessage(error, "Không chụp được snapshot đầu ngày."));
  } finally {
    snapshotSaving.value = false;
  }
}

async function handleSnapshotClick() {
  await captureOpeningSnapshot(Boolean(snapshotStatus.value));
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

onMounted(() => {
  void loadOpeningSnapshotStatus();
});
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

.stock-workspace__copy {
  display: grid;
  gap: 6px;
  min-width: 0;
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

.stock-workspace__snapshot-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.stock-workspace__snapshot-status {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.82);
  color: var(--muted);
  font-size: 0.8rem;
}

.stock-workspace__snapshot-status.is-ready {
  border-color: rgba(var(--green-rgb), 0.24);
  background: rgba(var(--green-rgb), 0.08);
  color: var(--green);
}

.stock-workspace__snapshot-status.is-empty {
  border-color: rgba(var(--line-rgb), 0.9);
}

.stock-workspace__snapshot-status strong {
  font-weight: 800;
}

.stock-workspace__snapshot-status i {
  font-size: 0.9rem;
}

.stock-workspace__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.stock-workspace__snapshot {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 0;
  padding: 10px 14px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.stock-workspace__snapshot i {
  font-size: 0.9rem;
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

.stock-workspace__notice {
  padding: 10px 12px;
  border: 1px solid rgba(var(--line-rgb), 0.9);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.82);
  font-size: 0.84rem;
  line-height: 1.4;
}

.stock-workspace__notice.is-success {
  border-color: rgba(var(--green-rgb), 0.24);
  background: rgba(var(--green-rgb), 0.08);
  color: var(--green);
}

.stock-workspace__notice.is-info {
  border-color: rgba(var(--orange-rgb), 0.24);
  background: rgba(var(--orange-rgb), 0.08);
  color: var(--ember-strong);
}

.stock-workspace__notice.is-error {
  border-color: rgba(var(--danger-rgb), 0.24);
  background: rgba(var(--danger-rgb), 0.08);
  color: var(--danger);
}

@media (max-width: 767px) {
  .stock-workspace__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .stock-workspace__actions {
    width: 100%;
    justify-content: stretch;
    flex-direction: column;
    align-items: stretch;
  }

  .stock-workspace__snapshot,
  .stock-workspace__save {
    width: 100%;
    justify-content: center;
  }
}
</style>
