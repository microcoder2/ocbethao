<template>
  <div class="obt-login-min">
    <div class="obt-login-min__ambient obt-login-min__ambient--left"></div>
    <div class="obt-login-min__ambient obt-login-min__ambient--right"></div>

    <section class="obt-login-min__card">
      <img :src="logoUrl" alt="Oc Be Thao" class="obt-login-min__logo" />

      <form class="obt-login-min__form" @submit.prevent="submitLogin">
        <div class="obt-login-min__field">
          <span class="obt-login-min__icon">
            <i class="bi bi-person-circle"></i>
          </span>
          <input
            v-model="loginForm.identifier"
            class="form-control obt-login-min__input"
            placeholder="Email / so dien thoai / username"
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
            placeholder="Password"
            autocomplete="current-password"
          />
        </div>

        <button class="btn btn-ember obt-login-min__submit" :disabled="pending">
          <span v-if="pending">Dang dang nhap...</span>
          <span v-else>Dang nhap</span>
        </button>
      </form>

      <div v-if="error" class="alert alert-danger mt-3 mb-0">{{ error }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api";
import { saveAuth } from "../utils/auth";
import logoUrl from "../assets/oc-be-thao-logo.svg";

const router = useRouter();
const pending = ref(false);
const error = ref("");

const loginForm = reactive({
  identifier: "admin",
  password: "123456",
});

function getHomePath(role?: string): string {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN") return "/admin/dashboard";
  if (normalized === "STAFF") return "/staff/console";
  if (normalized === "CUSTOMER") return "/customer/menu";
  return "/";
}

async function submitLogin() {
  pending.value = true;
  error.value = "";
  try {
    const { data } = await api.post("/auth/login", {
      username: loginForm.identifier,
      password: loginForm.password,
    });
    saveAuth(data);
    try {
      await router.replace(getHomePath(data?.user?.role));
    } catch {
      window.location.hash = `#${getHomePath(data?.user?.role)}`;
    }
  } catch (caught: any) {
    if (caught?.response?.data?.message) {
      error.value = caught.response.data.message;
    } else if (caught?.message) {
      error.value = caught.message;
    } else {
      error.value = "Dang nhap that bai";
    }
  } finally {
    pending.value = false;
  }
}
</script>

<style scoped>
.obt-login-min {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px 16px;
  overflow: hidden;
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
  position: relative;
  z-index: 1;
  width: min(100%, 420px);
  padding: 34px 24px 24px;
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 249, 241, 0.92));
  border: 1px solid rgba(230, 209, 192, 0.9);
  box-shadow:
    0 30px 60px rgba(88, 38, 17, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.obt-login-min__logo {
  display: block;
  width: min(220px, 62%);
  margin: 0 auto 28px;
}

.obt-login-min__form {
  display: grid;
  gap: 14px;
}

.obt-login-min__field {
  display: flex;
  align-items: center;
  min-height: 58px;
  padding: 0 16px;
  border-radius: 20px;
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
  min-height: 56px;
  background: transparent;
  box-shadow: none;
  font-size: 0.98rem;
}

.obt-login-min__input:focus {
  box-shadow: none;
}

.obt-login-min__submit {
  min-height: 56px;
  margin-top: 6px;
  border-radius: 18px;
  font-size: 0.98rem;
  font-weight: 800;
}

@media (max-width: 576px) {
  .obt-login-min {
    padding: 18px 12px;
  }

  .obt-login-min__card {
    padding: 26px 16px 16px;
    border-radius: 24px;
  }

  .obt-login-min__logo {
    width: min(210px, 72%);
    margin-bottom: 22px;
  }
}
</style>
