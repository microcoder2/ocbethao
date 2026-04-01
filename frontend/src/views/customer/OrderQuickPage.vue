<template>
  <CustomerQuickOrderMobile v-if="isMobile" />

  <section v-else class="order-quick-desktop">
    <div class="order-quick-desktop__card">
      <div class="order-quick-desktop__eyebrow">Chọn món & gửi bếp</div>
      <h1>Trang này dành cho điện thoại</h1>
      <p>
        Luồng <strong>Đặt món</strong> được tối ưu như màn tạo đơn nhanh trên mobile.
        Nếu đang dùng màn hình lớn, quay về menu đầy đủ để xem món và đặt đơn theo layout desktop.
      </p>

      <div class="order-quick-desktop__actions">
        <RouterLink to="/customer/menu" class="btn btn-ember">
          Xem menu đầy đủ
        </RouterLink>
        <RouterLink to="/customer/orders" class="btn btn-outline-dark">
          Đơn của tôi
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import CustomerQuickOrderMobile from "../../components/customer/CustomerQuickOrderMobile.vue";

const MOBILE_QUERY = "(max-width: 767px)";

const isMobile = ref(
  typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
);

let mobileQuery: MediaQueryList | null = null;

function syncViewportState(event?: MediaQueryList | MediaQueryListEvent) {
  isMobile.value = event ? event.matches : mobileQuery?.matches ?? false;
}

onMounted(() => {
  if (typeof window === "undefined") return;

  mobileQuery = window.matchMedia(MOBILE_QUERY);
  syncViewportState(mobileQuery);
  mobileQuery.addEventListener("change", syncViewportState);
});

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener("change", syncViewportState);
});
</script>

<style scoped>
.order-quick-desktop {
  min-height: calc(100vh - 180px);
  display: grid;
  place-items: center;
  padding: 24px 0;
}

.order-quick-desktop__card {
  width: min(100%, 720px);
  display: grid;
  gap: 16px;
  padding: 32px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(var(--ember-rgb), 0.14), transparent 32%),
    rgba(var(--panel-rgb), 0.96);
  border: 1px solid rgba(var(--line-rgb), 0.72);
  box-shadow: var(--shadow);
}

.order-quick-desktop__eyebrow {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ember-strong);
}

.order-quick-desktop__card h1,
.order-quick-desktop__card p {
  margin: 0;
}

.order-quick-desktop__card p {
  color: var(--muted);
  line-height: 1.6;
}

.order-quick-desktop__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
