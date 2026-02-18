import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AZURE_AD_TENANT_ID as string,
      authorization: {
        params: { scope: "openid profile user.Read email" },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || !profile) {
        console.error("Sign-in error: Missing account or profile");
        return false;
      }

      try {
        // ✅ upsert user : 1 seule requête au lieu de findUnique + create séparés
        const user = await prisma.user.upsert({
          where: { email: profile.email as string },
          update: {
            name: profile.name as string,
          },
          create: {
            email: profile.email as string,
            name: profile.name as string,
          },
        });

        // ✅ upsert account : 1 seule requête au lieu de update + create séparés
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            access_token: account.access_token,
            token_type: account.token_type,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          },
          create: {
            userId: user.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            token_type: account.token_type,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
            type: "oauth",
          },
        });

        return true;
      } catch (error) {
        console.error("Sign-in error:", error);
        return false;
      }
    },

    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  events: {
    signIn: async ({ user }) => {
      if (!user) {
        console.error("NextAuth error: User not found");
      }
    },
  },
  logger: {
    error(code, metadata) {
      console.error("NextAuth error:", code, metadata);
    },
  },
};