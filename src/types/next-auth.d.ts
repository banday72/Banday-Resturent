import type { Session } from "next-auth";

export type MembershipSession = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogo: string | null;
  restaurantActive: boolean;
  branchId: string | null;
  branchName: string | null;
  role: string;
  roleName: string;
  permissions: string[];
};

declare module "next-auth" {
  interface User {
    isSuperAdmin?: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isSuperAdmin: boolean;
      memberships: MembershipSession[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isSuperAdmin?: boolean;
  }
}

export type AppSession = Session;
