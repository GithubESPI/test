import { authOptions } from "@/lib/AuthOptions";
import NextAuth, { NextAuthOptions } from "next-auth";

const options: NextAuthOptions = {
  ...authOptions,
  events: {
    signIn: async (message) => {
      console.log("User signed in:", message);
    },
    // ... other events ...
  },
  logger: {
    error(code, ...message) {
      console.error("NextAuth error:", code, ...message);
    },
  },
};

const handler = NextAuth(options);

export { handler as GET, handler as POST };
