export type AppMenuItem = {
  label: string;
  to: string;
  icon: string;
};

const MENU: Record<string, AppMenuItem[]> = {
  ADMIN: [
    { label: "Tổng Quan", to: "/admin/dashboard", icon: "bi-grid-1x2-fill" },
    { label: "Quản Lý Đơn", to: "/admin/orders", icon: "bi-receipt-cutoff" },
    { label: "Đi Chợ Hôm Nay", to: "/admin/stock", icon: "bi-box-seam-fill" },
    {
      label: "Menu Hôm Nay",
      to: "/admin/daily-menus",
      icon: "bi-calendar2-week-fill",
    },
    { label: "Ngân Hàng Món", to: "/admin/menu-items", icon: "bi-egg-fried" },
    { label: "Tập Khách Hàng", to: "/admin/users", icon: "bi-people-fill" },
  ],
  STAFF: [
    {
      label: "Console",
      to: "/staff/console",
      icon: "bi-lightning-charge-fill",
    },
    { label: "Đơn hàng", to: "/staff/orders", icon: "bi-cup-hot-fill" },
  ],
  CUSTOMER: [
    { label: "Thực đơn", to: "/customer/menu", icon: "bi-egg-fried" },
    { label: "Đơn của tôi", to: "/customer/orders", icon: "bi-bag-check-fill" },
  ],
};

export function getMenuByRole(role?: string): AppMenuItem[] {
  return MENU[String(role || "").toUpperCase()] || [];
}
