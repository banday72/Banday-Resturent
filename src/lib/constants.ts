export const TRIAL_DAYS = 10;

export const PERMISSIONS = [
  { code: "restaurant:read", name: "View restaurant", category: "Restaurant" },
  { code: "restaurant:update", name: "Update restaurant", category: "Restaurant" },
  { code: "branch:manage", name: "Manage branches", category: "Restaurant" },
  { code: "table:manage", name: "Manage tables", category: "Operations" },
  { code: "menu:manage", name: "Manage menu", category: "Operations" },
  { code: "station:manage", name: "Manage kitchen stations", category: "Operations" },
  { code: "order:read", name: "View orders", category: "Operations" },
  { code: "order:create", name: "Create manual orders", category: "Operations" },
  { code: "order:update", name: "Update orders", category: "Operations" },
  { code: "kitchen:manage", name: "Manage kitchen", category: "Operations" },
  { code: "bill:manage", name: "Manage bills and payments", category: "Finance" },
  { code: "analytics:read", name: "View analytics", category: "Analytics" },
  { code: "staff:manage", name: "Manage staff", category: "Administration" },
  { code: "subscription:manage", name: "Manage subscription", category: "Administration" },
] as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: PERMISSIONS.map((permission) => permission.code),
  MANAGER: [
    "restaurant:read",
    "branch:manage",
    "table:manage",
    "menu:manage",
    "station:manage",
    "order:read",
    "order:create",
    "order:update",
    "kitchen:manage",
    "bill:manage",
    "analytics:read",
    "staff:manage",
  ],
  CASHIER: ["restaurant:read", "order:read", "bill:manage", "analytics:read"],
  WAITER: ["restaurant:read", "order:read", "order:create", "order:update", "table:manage"],
  KITCHEN: ["restaurant:read", "order:read", "kitchen:manage"],
  CUSTOMER: [],
};

export const ORDER_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const TABLE_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "WAITING_FOR_FOOD",
  "FOOD_READY",
  "BILL_REQUESTED",
  "PARTIALLY_PAID",
  "FULLY_PAID",
] as const;

export const SUBSCRIPTION_PLANS = [
  {
    code: "FREE",
    name: "Free",
    priceCents: 0,
    description: "For a single small restaurant getting started.",
    features: ["1 restaurant", "1 branch", "5 tables", "QR ordering", "Basic reports"],
    limits: { restaurants: 1, branches: 1, tables: 5, users: 2 },
  },
  {
    code: "BASIC",
    name: "Basic",
    priceCents: 299900,
    description: "For growing restaurants with more tables.",
    features: ["1 restaurant", "3 branches", "25 tables", "Menu and kitchen", "Analytics"],
    limits: { restaurants: 1, branches: 3, tables: 25, users: 10 },
  },
  {
    code: "PRO",
    name: "Pro",
    priceCents: 799900,
    description: "For multi-branch operations and advanced billing.",
    features: ["3 restaurants", "Unlimited branches", "Unlimited tables", "Split payments", "Kitchen stations"],
    limits: { restaurants: 3, branches: -1, tables: -1, users: 50 },
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    priceCents: 1999900,
    description: "For restaurant groups and franchises.",
    features: ["Unlimited restaurants", "Unlimited branches", "Unlimited users", "Priority support"],
    limits: { restaurants: -1, branches: -1, tables: -1, users: -1 },
  },
] as const;
