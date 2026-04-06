import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from "vue-router";
import { getRole, isAuthenticated } from "../utils/auth";
import { APP_NAME } from "../config";

const MainLayout = () => import("../layouts/MainLayout.vue");

function getHomeByRole() {
  const role = getRole();
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "STAFF") return "/staff/console";
  if (role === "CUSTOMER") return "/customer/menu";
  return "/login";
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: () => getHomeByRole(),
  },
  {
    path: "/",
    component: MainLayout,
    meta: { auth: true },
    children: [
      {
        path: "admin/dashboard",
        component: () => import("../views/admin/Dashboard.vue"),
        meta: { title: "Tổng quan" },
      },
      {
        path: "admin/menu-items",
        component: () => import("../views/admin/MenuItemsV2.vue"),
        meta: { title: "Ngân hàng món" },
      },
      {
        path: "admin/menu-items/classic",
        component: () => import("../views/admin/MenuItems.vue"),
        meta: { title: "Ngân hàng món cũ" },
      },
      {
        path: "admin/daily-menus",
        component: () => import("../views/admin/DailyMenus.vue"),
        meta: { title: "Menu ngày" },
      },
      {
        path: "admin/orders",
        component: () => import("../views/admin/Orders.vue"),
        meta: { title: "Đơn hàng" },
      },
      {
        path: "admin/stock",
        component: () => import("../views/admin/Stock.vue"),
        meta: { title: "Nhập kho hải sản" },
      },
      {
        path: "admin/users",
        component: () => import("../views/admin/Users.vue"),
        meta: { title: "Người dùng" },
      },
      {
        path: "staff/console",
        component: () => import("../views/staff/Console.vue"),
        meta: { title: "Console staff" },
      },
      {
        path: "staff/orders",
        component: () => import("../views/staff/Orders.vue"),
        meta: { title: "Đơn hàng staff" },
      },
      {
        path: "customer/menu",
        component: () => import("../views/customer/CustomerMenuPage.vue"),
        meta: { title: "Thực đơn hôm nay" },
      },
      {
        path: "customer/order-quick",
        component: () => import("../views/customer/OrderQuickPage.vue"),
        meta: { title: "Chọn món & gửi bếp" },
      },
      {
        path: "customer/orders",
        component: () => import("../views/customer/Orders.vue"),
        meta: { title: "Đơn của tôi" },
      },
    ],
  },
  {
    path: "/login",
    component: () => import("../views/Login.vue"),
    meta: { title: "Đăng Nhập" },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/",
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  if (to.meta.auth && !isAuthenticated()) {
    next("/login");
    return;
  }
  if (to.path.startsWith("/admin") && getRole() !== "ADMIN") {
    next(getHomeByRole());
    return;
  }
  if (to.path.startsWith("/staff") && !["STAFF", "ADMIN"].includes(getRole())) {
    next(getHomeByRole());
    return;
  }
  if (to.path.startsWith("/customer") && getRole() !== "CUSTOMER") {
    next(getHomeByRole());
    return;
  }
  next();
});

router.afterEach((to) => {
  document.title = `${to.meta.title || APP_NAME} - ${APP_NAME}`;
});

export default router;
