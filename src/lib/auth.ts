import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        const memberships = await prisma.restaurantMembership.findMany({
          where: { userId: token.userId as string, isActive: true },
          include: {
            restaurant: { select: { id: true, name: true, slug: true, logoUrl: true, isActive: true } },
            branch: { select: { id: true, name: true } },
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        });
        session.user.memberships = memberships.map((membership) => ({
          restaurantId: membership.restaurantId,
          restaurantName: membership.restaurant.name,
          restaurantSlug: membership.restaurant.slug,
          restaurantLogo: membership.restaurant.logoUrl,
          restaurantActive: membership.restaurant.isActive,
          branchId: membership.branchId,
          branchName: membership.branch?.name ?? null,
          role: membership.role.code,
          roleName: membership.role.name,
          permissions: membership.role.permissions.map((item) => item.permission.code),
        }));
      }
      return session;
    },
  },
};
