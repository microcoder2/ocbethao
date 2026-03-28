<template>
  <Teleport to="body">
    <div class="pm-backdrop" @click.self="emit('close')">
      <Transition name="pm-slide" appear>
        <div class="pm-modal">

          <!-- ── header ── -->
          <div class="pm-header">
            <div class="pm-hero">
              <div class="pm-avatar"><i class="bi bi-person-circle"></i></div>
              <div class="pm-hero-info">
                <div class="pm-hero-name">{{ form.fullName || user?.fullName || '—' }}</div>
                <div class="pm-role-badge">{{ roleLabel }}</div>
              </div>
            </div>
            <button class="pm-close" @click="emit('close')"><i class="bi bi-x-lg"></i></button>
          </div>

          <!-- ── body ── -->
          <div class="pm-body">

            <!-- thông tin cá nhân -->
            <div class="pm-section-title">Thông tin cá nhân</div>
            <div class="pm-fields">
              <label class="pm-field pm-field--full">
                <span>Họ tên <em>*</em></span>
                <input v-model="form.fullName" type="text" :disabled="!canEdit" placeholder="Họ và tên" />
              </label>

              <!-- username: read-only always -->
              <label class="pm-field pm-field--full">
                <span>
                  Tên đăng nhập
                  <span class="pm-field-lock"><i class="bi bi-lock-fill"></i> không thể đổi</span>
                </span>
                <input :value="user?.username || '—'" type="text" disabled class="pm-input--readonly" />
              </label>

              <label class="pm-field">
                <span>Điện thoại</span>
                <input v-model="form.phone" type="tel" :disabled="!canEdit" placeholder="0901 234 567" />
              </label>
              <label class="pm-field">
                <span>Email</span>
                <input v-model="form.email" type="email" :disabled="!canEdit" placeholder="email@example.com" />
              </label>
            </div>

            <!-- đổi mật khẩu -->
            <template v-if="canEdit">
              <div class="pm-divider">
                <span>Đổi mật khẩu</span>
                <span class="pm-divider-note">để trống nếu không đổi</span>
              </div>
              <div class="pm-fields">
                <!-- current password — full width -->
                <label class="pm-field pm-field--full">
                  <span>Mật khẩu hiện tại <em>*</em></span>
                  <div class="pm-pw-wrap">
                    <input
                      v-model="form.currentPassword"
                      :type="show.current ? 'text' : 'password'"
                      autocomplete="current-password"
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                    <button type="button" class="pm-pw-eye" @click="show.current = !show.current">
                      <i :class="['bi', show.current ? 'bi-eye-slash' : 'bi-eye']"></i>
                    </button>
                  </div>
                </label>

                <!-- new + confirm -->
                <label class="pm-field">
                  <span>Mật khẩu mới</span>
                  <div class="pm-pw-wrap">
                    <input
                      v-model="form.newPassword"
                      :type="show.newPw ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="••••••••"
                    />
                    <button type="button" class="pm-pw-eye" @click="show.newPw = !show.newPw">
                      <i :class="['bi', show.newPw ? 'bi-eye-slash' : 'bi-eye']"></i>
                    </button>
                  </div>
                </label>
                <label class="pm-field">
                  <span>Xác nhận</span>
                  <div class="pm-pw-wrap">
                    <input
                      v-model="form.confirmPassword"
                      :type="show.confirm ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="••••••••"
                    />
                    <button type="button" class="pm-pw-eye" @click="show.confirm = !show.confirm">
                      <i :class="['bi', show.confirm ? 'bi-eye-slash' : 'bi-eye']"></i>
                    </button>
                  </div>
                </label>
              </div>
              <p v-if="pwError" class="pm-msg pm-msg--error">{{ pwError }}</p>
            </template>

          </div>

          <!-- ── footer ── -->
          <div class="pm-footer">
            <p v-if="saveError" class="pm-msg pm-msg--error">{{ saveError }}</p>
            <p v-if="saveOk" class="pm-msg pm-msg--ok"><i class="bi bi-check2-circle"></i> Đã lưu thay đổi</p>
            <div class="pm-footer-actions">
              <button class="pm-btn" @click="emit('close')">Đóng</button>
              <button
                v-if="canEdit"
                class="pm-btn pm-btn--save btn-ember"
                :disabled="!isDirty || saving"
                @click="save"
              >
                <i v-if="saving" class="bi bi-hourglass-split"></i>
                <span v-else>Lưu thay đổi</span>
              </button>
            </div>
          </div>

        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { api } from "../api";
import { getUser, saveAuth } from "../utils/auth";

const emit = defineEmits<{ close: []; saved: [] }>();

const user = ref(getUser());

const form = reactive({
  fullName:        user.value?.fullName ?? "",
  phone:           user.value?.phone    ?? "",
  email:           user.value?.email    ?? "",
  currentPassword: "",
  newPassword:     "",
  confirmPassword: "",
});

// eye visibility toggles
const show = reactive({ current: false, newPw: false, confirm: false });

const saving    = ref(false);
const saveOk    = ref(false);
const saveError = ref("");
const pwError   = ref("");

const canEdit = computed(() => !!user.value);

const isDirty = computed(() => {
  if (form.fullName.trim() !== (user.value?.fullName ?? "")) return true;
  if (form.phone.trim()    !== (user.value?.phone    ?? "")) return true;
  if (form.email.trim()    !== (user.value?.email    ?? "")) return true;
  if (form.currentPassword || form.newPassword || form.confirmPassword) return true;
  return false;
});

const roleLabel = computed(() => {
  const r = String(user.value?.role || "").toUpperCase();
  if (r === "ADMIN")    return "Quản trị viên";
  if (r === "STAFF")    return "Nhân viên";
  if (r === "CUSTOMER") return "Khách hàng";
  return r;
});

onMounted(async () => {
  try {
    const res = await api.get("/me");
    Object.assign(user.value ??= {} as any, res.data);
    form.fullName = res.data.fullName ?? form.fullName;
    form.phone    = res.data.phone    ?? "";
    form.email    = res.data.email    ?? "";
  } catch { /* keep local data */ }
});

async function save() {
  pwError.value   = "";
  saveError.value = "";
  saveOk.value    = false;

  const changingPw = form.newPassword || form.confirmPassword || form.currentPassword;
  if (changingPw) {
    if (!form.currentPassword) {
      pwError.value = "Vui lòng nhập mật khẩu hiện tại";
      return;
    }
    if (!form.newPassword) {
      pwError.value = "Vui lòng nhập mật khẩu mới";
      return;
    }
    if (form.newPassword.length < 6) {
      pwError.value = "Mật khẩu mới tối thiểu 6 ký tự";
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      pwError.value = "Mật khẩu xác nhận không khớp";
      return;
    }
  }

  saving.value = true;
  try {
    const body: Record<string, any> = {
      fullName: form.fullName.trim(),
      phone:    form.phone.trim()  || null,
      email:    form.email.trim()  || null,
    };
    if (changingPw) {
      body.currentPassword = form.currentPassword;
      body.password = form.newPassword;
    }

    const res = await api.put("/me", body);
    saveAuth({ user: { ...user.value!, ...res.data } });
    user.value = getUser();
    form.currentPassword = "";
    form.newPassword     = "";
    form.confirmPassword = "";
    show.current = false; show.newPw = false; show.confirm = false;
    saveOk.value = true;
    emit("saved");
    setTimeout(() => { saveOk.value = false; }, 3000);
  } catch (e: any) {
    saveError.value = e?.response?.data?.message || "Lưu thất bại, thử lại sau";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.pm-backdrop {
  position: fixed; inset: 0; z-index: 1100;
  background: var(--overlay);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.pm-modal {
  background: var(--panel);
  border-radius: 22px;
  width: 100%; max-width: 420px;
  max-height: 90dvh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,0.22);
  overflow: hidden;
}

/* ── header ── */
.pm-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 20px 20px 16px;
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.pm-hero { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pm-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: rgba(var(--ember-rgb), 0.12); color: var(--ember);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; flex-shrink: 0;
}
.pm-hero-info { min-width: 0; }
.pm-hero-name {
  font-weight: 700; font-size: 1rem; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pm-role-badge {
  display: inline-block; margin-top: 3px;
  padding: 2px 8px; border-radius: 999px;
  background: rgba(var(--ember-rgb), 0.1); color: var(--ember-strong);
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
}
.pm-close {
  width: 32px; height: 32px; border-radius: 10px; border: none;
  background: transparent; color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 0.8rem;
  flex-shrink: 0; transition: background 0.12s, color 0.12s;
}
.pm-close:hover { background: rgba(0,0,0,0.06); color: var(--text); }

/* ── body ── */
.pm-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }

.pm-section-title {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--muted);
}

.pm-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pm-field { display: flex; flex-direction: column; gap: 5px; }
.pm-field--full { grid-column: 1 / -1; }

.pm-field > span {
  font-size: 0.8rem; font-weight: 600; color: var(--text);
  display: flex; align-items: center; gap: 6px;
}
.pm-field em { color: var(--ember); font-style: normal; }

.pm-field-lock {
  font-size: 0.7rem; font-weight: 500; color: var(--muted);
  display: inline-flex; align-items: center; gap: 3px;
}

.pm-field input,
.pm-pw-wrap input {
  padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px;
  background: rgba(var(--panel-rgb), 0.8); color: var(--text);
  font-size: 0.92rem; font: inherit; outline: none; width: 100%; box-sizing: border-box;
  transition: border-color 0.15s;
}
.pm-field input:focus,
.pm-pw-wrap input:focus { border-color: var(--ember); }
.pm-field input:disabled,
.pm-input--readonly {
  background: rgba(var(--panel-rgb), 0.45) !important;
  color: var(--muted) !important; cursor: default;
}

/* ── password wrap with eye toggle ── */
.pm-pw-wrap { position: relative; }
.pm-pw-wrap input { padding-right: 38px; }
.pm-pw-eye {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  border: none; background: transparent; cursor: pointer;
  color: var(--muted); padding: 4px; display: flex; align-items: center;
  font-size: 0.88rem; transition: color 0.12s;
}
.pm-pw-eye:hover { color: var(--text); }

/* ── divider ── */
.pm-divider {
  display: flex; align-items: baseline; gap: 8px;
  border-top: 1px dashed var(--line); padding-top: 14px; margin-top: 2px;
}
.pm-divider span:first-child {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--muted);
}
.pm-divider-note { font-size: 0.72rem; color: var(--muted); }

/* ── messages ── */
.pm-msg { margin: 0; font-size: 0.82rem; display: flex; align-items: center; gap: 5px; }
.pm-msg--error { color: var(--danger); }
.pm-msg--ok    { color: var(--green); }

/* ── footer ── */
.pm-footer {
  padding: 14px 20px; border-top: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;
}
.pm-footer-actions { display: flex; justify-content: flex-end; gap: 8px; }
.pm-btn {
  padding: 8px 18px; border-radius: 10px; border: 1px solid var(--line);
  background: transparent; color: var(--text); font-size: 0.88rem;
  font-weight: 600; cursor: pointer; transition: background 0.12s;
  display: inline-flex; align-items: center; gap: 6px;
}
.pm-btn:hover { background: rgba(0,0,0,0.05); }
.pm-btn--save {
  min-width: 110px; justify-content: center;
  background: linear-gradient(135deg, var(--ember), var(--ember-strong));
  color: #fff; border-color: transparent;
}
.pm-btn--save:hover:not(:disabled) { opacity: 0.9; }
.pm-btn--save:disabled { opacity: 0.45; pointer-events: none; }
.pm-btn:disabled { opacity: 0.6; cursor: default; }

/* ── transition ── */
.pm-slide-enter-active { transition: opacity 0.18s, transform 0.2s; }
.pm-slide-leave-active { transition: opacity 0.14s, transform 0.15s; }
.pm-slide-enter-from   { opacity: 0; transform: translateY(16px) scale(0.97); }
.pm-slide-leave-to     { opacity: 0; transform: translateY(8px)  scale(0.98); }

/* ── mobile ── */
@media (max-width: 639px) {
  .pm-backdrop { padding: 0; align-items: flex-end; }
  .pm-modal { border-radius: 0; max-width: 100%; max-height: 92dvh; }
  .pm-fields { grid-template-columns: 1fr; }
  .pm-field--full { grid-column: 1; }
}
</style>
