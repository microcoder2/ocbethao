<template>
  <div class="obt-login-min">
    <div class="obt-login-min__ambient obt-login-min__ambient--left"></div>
    <div class="obt-login-min__ambient obt-login-min__ambient--right"></div>

    <section class="obt-login-min__card">
      <img :src="logoUrl" alt="Oc Be Thao" class="obt-login-min__logo" />

      <form v-if="showPasswordForm" class="obt-login-min__form" @submit.prevent="submitPasswordLogin">
        <div class="obt-login-min__field">
          <span class="obt-login-min__icon">
            <i class="bi bi-person-circle"></i>
          </span>
          <input
            v-model="loginForm.identifier"
            class="form-control obt-login-min__input"
            placeholder="Email / số điện thoại / username"
            autocomplete="username"
          />
        </div>

        <div class="obt-login-min__field">
          <span class="obt-login-min__icon">
            <i class="bi bi-shield-lock-fill"></i>
          </span>
          <input
            v-model="loginForm.password"
            type="password"
            class="form-control obt-login-min__input"
            placeholder="Mật khẩu"
            autocomplete="current-password"
          />
        </div>

        <button class="btn btn-ember obt-login-min__submit" :disabled="Boolean(pendingProvider)">
          <span v-if="pendingProvider === 'password'">Đang đăng nhập...</span>
          <span v-else>Đăng nhập</span>
        </button>
      </form>

      <div v-if="externalProviders.length" class="obt-login-min__divider">
        <span>Hoặc tiếp tục với</span>
      </div>

      <div v-if="googleProvider" class="obt-login-min__provider-slot">
        <div
          v-if="googleProvider.isReady"
          ref="googleButtonHost"
          class="obt-login-min__google-host"
        ></div>
        <button
          v-else
          class="btn obt-login-min__provider obt-login-min__provider--disabled"
          disabled
        >
          <i class="bi bi-google"></i>
          <span>{{ googleProvider.label }}</span>
        </button>
      </div>

      <div v-if="placeholderProviders.length" class="obt-login-min__providers">
        <button
          v-for="provider in placeholderProviders"
          :key="provider.key"
          class="btn obt-login-min__provider"
          :class="{ 'obt-login-min__provider--disabled': !provider.isReady }"
          :disabled="true"
        >
          <i :class="providerIconClass(provider.key)"></i>
          <span>{{ provider.label }}</span>
        </button>
      </div>

      <div v-if="providerHint" class="obt-login-min__hint">{{ providerHint }}</div>
      <div v-if="error" class="alert alert-danger mt-3 mb-0">{{ error }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api";
import { saveAuth } from "../utils/auth";
import { loadGoogleIdentityScript } from "../utils/googleIdentity";
import logoUrl from "../assets/oc-be-thao-logo.svg";

type AuthProviderItem = {
  key: string;
  label: string;
  kind: string;
  supportsLogin: boolean;
  supportsLink: boolean;
  isEnabled: boolean;
  isLinkEnabled?: boolean;
  isReady: boolean;
  notes?: string;
  publicConfig?: Record<string, string | boolean | number | null>;
};

const router = useRouter();
const error = ref("");
const pendingProvider = ref("");
const providersLoaded = ref(false);
const providers = ref<AuthProviderItem[]>([]);
const googleButtonHost = ref<HTMLElement | null>(null);
let initializedGoogleClientId = "";

const loginForm = ref({
  identifier: "admin",
  password: "123456",
});

const passwordProvider = computed(
  () => providers.value.find((provider) => provider.key === "password") || null
);
const showPasswordForm = computed(
  () => !providersLoaded.value || passwordProvider.value?.isEnabled !== false
);
const externalProviders = computed(() =>
  providers.value.filter(
    (provider) => provider.supportsLogin && provider.key !== "password" && provider.isEnabled
  )
);
const googleProvider = computed(
  () => externalProviders.value.find((provider) => provider.key === "google") || null
);
const placeholderProviders = computed(() =>
  externalProviders.value.filter((provider) => provider.key !== "google")
);
const providerHint = computed(() => {
  const firstPendingProvider = externalProviders.value.find((provider) => !provider.isReady && provider.notes);
  return firstPendingProvider?.notes || "";
});

function providerIconClass(providerKey: string): string {
  if (providerKey === "google") return "bi bi-google";
  if (providerKey === "facebook") return "bi bi-facebook";
  if (providerKey === "apple") return "bi bi-apple";
  if (providerKey === "zalo") return "bi bi-chat-dots-fill";
  if (providerKey === "vneid") return "bi bi-shield-check";
  return "bi bi-box-arrow-in-right";
}

function getHomePath(role?: string): string {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN") return "/admin/dashboard";
  if (normalized === "STAFF") return "/staff/console";
  if (normalized === "CUSTOMER") return "/customer/menu";
  return "/";
}

async function finishLogin(data: any) {
  saveAuth(data);
  try {
    await router.replace(getHomePath(data?.user?.role));
  } catch {
    window.location.hash = `#${getHomePath(data?.user?.role)}`;
  }
}

async function submitPasswordLogin() {
  pendingProvider.value = "password";
  error.value = "";
  try {
    const { data } = await api.post("/auth/login", {
      username: loginForm.value.identifier,
      password: loginForm.value.password,
    });
    await finishLogin(data);
  } catch (caught: any) {
    if (caught?.response?.data?.message) {
      error.value = caught.response.data.message;
    } else if (caught?.message) {
      error.value = caught.message;
    } else {
      error.value = "Đăng nhập thất bại";
    }
  } finally {
    pendingProvider.value = "";
  }
}

async function handleGoogleCredential(response: GoogleCredentialResponse) {
  if (!response?.credential || pendingProvider.value) {
    return;
  }

  pendingProvider.value = "google";
  error.value = "";
  try {
    const { data } = await api.post("/auth/external/google/complete", {
      idToken: response.credential,
    });
    await finishLogin(data);
  } catch (caught: any) {
    if (caught?.response?.data?.message) {
      error.value = caught.response.data.message;
    } else if (caught?.message) {
      error.value = caught.message;
    } else {
      error.value = "Đăng nhập Google thất bại";
    }
  } finally {
    pendingProvider.value = "";
  }
}

async function renderGoogleButton() {
  const provider = googleProvider.value;
  const host = googleButtonHost.value;

  if (!provider || !provider.isReady || !host) {
    if (host) {
      host.innerHTML = "";
    }
    return;
  }

  const clientId = String(provider.publicConfig?.clientId || "").trim();
  if (!clientId) {
    host.innerHTML = "";
    return;
  }

  try {
    const google = await loadGoogleIdentityScript();
    const hostWidth = Math.floor(host.getBoundingClientRect().width || host.clientWidth || 0);
    const viewportWidth = Math.max(280, Math.floor(window.innerWidth - 40));
    const buttonWidth = Math.max(220, Math.min(hostWidth || viewportWidth, 360));

    if (initializedGoogleClientId !== clientId) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
      });
      initializedGoogleClientId = clientId;
    }

    host.innerHTML = "";
    google.accounts.id.renderButton(host, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      width: buttonWidth,
      logo_alignment: "left",
    });
  } catch (caught: any) {
    error.value = caught?.message || "Không tải được Google Sign-In";
  }
}

async function loadProviders() {
  try {
    const { data } = await api.get("/auth/providers");
    providers.value = Array.isArray(data?.providers) ? data.providers : [];
  } catch {
    providers.value = [];
  } finally {
    providersLoaded.value = true;
    await nextTick();
    await renderGoogleButton();
  }
}

watch(
  () => [googleProvider.value?.key, googleProvider.value?.isReady, googleProvider.value?.publicConfig?.clientId, googleButtonHost.value] as const,
  async () => {
    await nextTick();
    await renderGoogleButton();
  }
);

onMounted(async () => {
  await loadProviders();
});
</script>

<style scoped>
.obt-login-min {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: var(--app-height, 100svh);
  height: var(--app-height, 100svh);
  display: grid;
  place-items: center;
  padding:
    max(18px, env(safe-area-inset-top))
    clamp(10px, 4vw, 16px)
    max(18px, env(safe-area-inset-bottom));
  overflow: clip;
  overscroll-behavior: none;
  background:
    radial-gradient(circle at top left, rgba(255, 197, 125, 0.22), transparent 24%),
    radial-gradient(circle at bottom right, rgba(201, 87, 43, 0.16), transparent 28%),
    linear-gradient(160deg, #fff8f0 0%, #fffdf9 55%, #f8ead9 100%);
}

.obt-login-min__ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(12px);
  opacity: 0.7;
}

.obt-login-min__ambient--left {
  top: 5%;
  left: -120px;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(233, 152, 88, 0.4), transparent 66%);
}

.obt-login-min__ambient--right {
  right: -120px;
  bottom: 2%;
  width: 340px;
  height: 340px;
  background: radial-gradient(circle, rgba(98, 35, 19, 0.18), transparent 68%);
}

.obt-login-min__card {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  width: min(100%, 420px);
  max-width: calc(var(--app-width, 100vw) - 20px);
  max-height: calc(var(--app-height, 100svh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 36px);
  padding: clamp(20px, 3.2dvh, 34px) clamp(14px, 4vw, 24px) clamp(16px, 2.6dvh, 24px);
  border-radius: clamp(22px, 4vw, 30px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 249, 241, 0.92));
  border: 1px solid rgba(230, 209, 192, 0.9);
  box-shadow:
    0 30px 60px rgba(88, 38, 17, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.74);
  overflow: hidden;
}

.obt-login-min__logo {
  display: block;
  width: min(220px, 64%);
  max-width: 100%;
  margin: 0 auto clamp(18px, 2.5dvh, 28px);
}

.obt-login-min__form {
  display: grid;
  gap: clamp(10px, 1.5dvh, 14px);
}

.obt-login-min__field {
  display: flex;
  align-items: center;
  min-height: clamp(52px, 6.2dvh, 58px);
  padding: 0 clamp(12px, 3.5vw, 16px);
  border-radius: clamp(16px, 3vw, 20px);
  border: 1px solid rgba(219, 191, 171, 0.95);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.obt-login-min__icon {
  width: 34px;
  color: #9a6c55;
  font-size: 1.05rem;
}

.obt-login-min__input {
  border: 0;
  padding: 0;
  min-height: clamp(50px, 6vh, 56px);
  background: transparent;
  box-shadow: none;
  font-size: 1rem;
}

.obt-login-min__input:focus {
  box-shadow: none;
}

.obt-login-min__submit {
  min-height: clamp(52px, 6vh, 56px);
  margin-top: 4px;
  border-radius: clamp(16px, 3vw, 18px);
  font-size: 1rem;
  font-weight: 800;
}

.obt-login-min__divider {
  position: relative;
  margin: clamp(14px, 2dvh, 18px) 0 clamp(12px, 1.6dvh, 16px);
  text-align: center;
  color: #9a7d6a;
  font-size: 0.85rem;
}

.obt-login-min__divider::before {
  content: "";
  position: absolute;
  inset: 50% 0 auto;
  border-top: 1px solid rgba(216, 191, 172, 0.75);
}

.obt-login-min__divider span {
  position: relative;
  padding: 0 12px;
  background: rgba(255, 251, 247, 0.92);
}

.obt-login-min__provider-slot,
.obt-login-min__providers {
  display: grid;
  gap: clamp(8px, 1.2dvh, 10px);
}

.obt-login-min__google-host {
  width: 100%;
  max-width: 100%;
  min-height: 42px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.obt-login-min__provider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  min-height: clamp(46px, 5.3dvh, 50px);
  border-radius: clamp(16px, 3vw, 18px);
  border: 1px solid rgba(216, 191, 172, 0.9);
  background: rgba(255, 255, 255, 0.8);
  color: #543322;
  font-weight: 700;
}

.obt-login-min__provider--disabled {
  opacity: 0.65;
}

.obt-login-min__hint {
  margin-top: clamp(10px, 1.4dvh, 12px);
  color: #8c6d59;
  font-size: 0.82rem;
  text-align: center;
}

@media (max-width: 576px) {
  .obt-login-min {
    padding:
      max(14px, env(safe-area-inset-top))
      10px
      max(14px, env(safe-area-inset-bottom));
  }

  .obt-login-min__card {
    max-width: calc(var(--app-width, 100vw) - 16px);
    max-height: calc(var(--app-height, 100svh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px);
    padding: 18px 14px 14px;
    border-radius: 22px;
  }

  .obt-login-min__logo {
    width: min(196px, 68%);
    margin-bottom: 16px;
  }

  .obt-login-min__ambient {
    opacity: 0.45;
    filter: blur(18px);
  }

  .obt-login-min__ambient--left {
    left: -150px;
    width: 220px;
    height: 220px;
  }

  .obt-login-min__ambient--right {
    right: -160px;
    width: 260px;
    height: 260px;
  }
}

@media (max-height: 760px) {
  .obt-login-min {
    padding:
      max(10px, env(safe-area-inset-top))
      10px
      max(10px, env(safe-area-inset-bottom));
  }

  .obt-login-min__card {
    padding: 16px 14px 12px;
  }

  .obt-login-min__logo {
    width: min(176px, 58%);
    margin-bottom: 12px;
  }
}
</style>
