export type AppMenuItem = {
  label: string;
  to: string;
  icon: string;
};

const MENU: Record<string, AppMenuItem[]> = {
  ADMIN: [
    { label: "Tong quan", to: "/admin/dashboard", icon: "bi-grid-1x2-fill" },
    { label: "Mon an", to: "/admin/menu-items", icon: "bi-egg-fried" },
    { label: "Thuc don ngay", to: "/admin/daily-menus", icon: "bi-calendar2-week-fill" },
    { label: "Don hang", to: "/admin/orders", icon: "bi-receipt-cutoff" },
    { label: "Nguoi dung", to: "/admin/users", icon: "bi-people-fill" },
  ],
  STAFF: [
    { label: "Console", to: "/staff/console", icon: "bi-lightning-charge-fill" },
    { label: "Don hang", to: "/staff/orders", icon: "bi-cup-hot-fill" },
  ],
  CUSTOMER: [
    { label: "Thuc don", to: "/customer/menu", icon: "bi-egg-fried" },
    { label: "Don cua toi", to: "/customer/orders", icon: "bi-bag-check-fill" },
  ],
};

export function getMenuByRole(role?: string): AppMenuItem[] {
  return MENU[String(role || "").toUpperCase()] || [];
}
