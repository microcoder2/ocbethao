<template>
  <section class="stock-workspace">
    <div v-if="snapshotNotice" class="stock-workspace__notice" :class="`is-${snapshotNotice.kind}`">
      {{ snapshotNotice.text }}
    </div>

    <DailyStockPanel>
      <template #filter-meta>
        <div ref="headerInfoRef" class="stock-workspace__info-wrap">
          <button
            class="stock-workspace__info-btn"
            type="button"
            :aria-label="headerInfoOpen ? 'Đóng ghi chú' : 'Mở ghi chú'"
            :title="headerInfoOpen ? 'Đóng ghi chú' : 'Mở ghi chú'"
            @click.stop="headerInfoOpen = !headerInfoOpen"
          >
            <i class="bi bi-question-lg"></i>
          </button>
          <div v-if="headerInfoOpen" class="stock-workspace__info-popup" role="tooltip">
            <div>Quản lý trực tiếp nguyên liệu đang có và số lượng còn bán.</div>
            <div>Lưu số buổi sáng xong rồi chụp snapshot đầu ngày để khóa log kiểm toán.</div>
            <div>
              {{
                snapshotStatus
                  ? `Snapshot hôm nay đã chụp lúc ${formatDateTime(snapshotStatus.capturedAt)}.`
                  : "Chưa chụp snapshot đầu ngày hôm nay."
              }}
            </div>
            <div v-if="snapshotStatus">
              Tổng kho đầu ngày: {{ formatQuantity(snapshotStatus.totalRemainingQuantity) }}
            </div>
          </div>
        </div>
      </template>

      <template #filter-actions>
        <button
          class="stock-workspace__snapshot"
          type="button"
          :aria-label="snapshotActionLabel"
          :title="snapshotActionLabel"
          :disabled="snapshotSaving || snapshotLoading"
          @click="handleSnapshotClick"
        >
          <span class="stock-workspace__snapshot-frame" aria-hidden="true">
            <span class="stock-workspace__snapshot-corner stock-workspace__snapshot-corner--tl"></span>
            <span class="stock-workspace__snapshot-corner stock-workspace__snapshot-corner--tr"></span>
            <span class="stock-workspace__snapshot-corner stock-workspace__snapshot-corner--bl"></span>
            <span class="stock-workspace__snapshot-corner stock-workspace__snapshot-corner--br"></span>
            <i class="bi bi-journal-text"></i>
          </span>
        </button>
      </template>
    </DailyStockPanel>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { api } from "../../api";
import DailyStockPanel from "../../components/admin/DailyStockPanel.vue";

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

const snapshotLoading = ref(false);
const snapshotSaving = ref(false);
const snapshotStatus = ref<OpeningSnapshot | null>(null);
const snapshotNotice = ref<SnapshotNotice | null>(null);
const headerInfoOpen = ref(false);
const headerInfoRef = ref<HTMLElement | null>(null);

const snapshotActionLabel = computed(() =>
  snapshotStatus.value ? "Chụp lại đầu ngày" : "Chụp đầu ngày"
);

function closeHeaderInfoOnOutside(event: MouseEvent) {
  if (headerInfoRef.value && !headerInfoRef.value.contains(event.target as Node)) {
    headerInfoOpen.value = false;
  }
}

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

watch(headerInfoOpen, (isOpen) => {
  if (isOpen) {
    document.addEventListener("click", closeHeaderInfoOnOutside);
  } else {
    document.removeEventListener("click", closeHeaderInfoOnOutside);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", closeHeaderInfoOnOutside);
});

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

onMounted(() => {
  void loadOpeningSnapshotStatus();
});
</script>

<style scoped>
.stock-workspace {
  display: grid;
  gap: 16px;
  width: 100%;
}

.stock-workspace__info-wrap {
  position: relative;
  display: inline-flex;
}

.stock-workspace__info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(var(--ember-rgb), 0.14);
  border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  padding: 0;
  transition: color 0.18s, background 0.18s, border-color 0.18s;
}

.stock-workspace__info-btn:hover,
.stock-workspace__info-btn:focus-visible {
  color: var(--ember-strong);
  border-color: rgba(var(--ember-rgb), 0.24);
  background: rgba(var(--ember-rgb), 0.14);
  outline: none;
}

.stock-workspace__info-btn i {
  font-size: 0.88rem;
}

.stock-workspace__info-popup {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(30, 20, 14, 0.92);
  color: #fff;
  font-size: 0.8rem;
  line-height: 1.6;
  z-index: 200;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.stock-workspace__info-popup div + div {
  margin-top: 2px;
}

.stock-workspace__note {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.5;
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

.stock-workspace__snapshot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  padding: 0;
  border: none;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--ember-strong);
  font-size: 0.82rem;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: visible;
}

.stock-workspace__snapshot-frame {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  color: currentColor;
}

.stock-workspace__snapshot-frame i {
  position: relative;
  z-index: 1;
  font-size: 1.1rem;
  line-height: 1;
}

.stock-workspace__snapshot-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 3px solid currentColor;
  pointer-events: none;
  opacity: 0.98;
}

.stock-workspace__snapshot-corner--tl {
  top: -1px;
  left: -1px;
  border-right: 0;
  border-bottom: 0;
  border-top-left-radius: 8px;
}

.stock-workspace__snapshot-corner--tr {
  top: -1px;
  right: -1px;
  border-left: 0;
  border-bottom: 0;
  border-top-right-radius: 8px;
}

.stock-workspace__snapshot-corner--bl {
  bottom: -1px;
  left: -1px;
  border-right: 0;
  border-top: 0;
  border-bottom-left-radius: 8px;
}

.stock-workspace__snapshot-corner--br {
  right: -1px;
  bottom: -1px;
  border-left: 0;
  border-top: 0;
  border-bottom-right-radius: 8px;
}

.stock-workspace__snapshot:hover,
.stock-workspace__snapshot:focus-visible {
  background: rgba(var(--ember-rgb), 0.08);
  color: var(--ember-strong);
  outline: none;
}

.stock-workspace__snapshot:disabled {
  opacity: 0.65;
  cursor: default;
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
  .stock-workspace__snapshot {
    width: 46px;
    height: 46px;
    min-width: 46px;
  }
}
</style>
