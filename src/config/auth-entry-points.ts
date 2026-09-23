export const loginEntryHref = "/login/";

// Destinations, not permissions: each existing portal still owns authentication
// and authorization. New account types can add their real entry point here.
export const authEntryPoints: { id: string; label: string; href: string; icon: string }[] = [
  { id: "seller", label: "ผู้ขาย", href: "/seller/", icon: "shopping-bag" },
  { id: "admin", label: "ผู้ดูแลระบบ", href: "/admin/", icon: "shield-check" },
];
