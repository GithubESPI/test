"use client";

import { ArrowRight } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import MaxWidthWrapper from "./MaxWidthWrapper";
import { buttonVariants } from "./ui/button";

const Navbar = () => {
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = user?.email === process.env.ADMIN_EMAIL;

  return (
    <nav className="sticky z-[100] h-20 inset-x-0 top-0 w-full border-b border-gray-200 bg-gradient-to-r/75 from-yellow-50 to-pink-50 backdrop-blur-lg transition-all">
      <MaxWidthWrapper>
        <div className="flex h-20 items-center justify-between border-b border-zinc-200">
          <Link href="/home" className="flex z-40 font-semibold">
            <Image
              src="/images/logo.png"
              width={200}
              height={50}
              alt="Logo de l'application"
              loading="lazy"
            />
          </Link>

          <div className="h-full flex items-center space-x-4">
            {user ? (
              <>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={buttonVariants({ size: "lg", variant: "ghost" })}
                >
                  Déconnexion
                </button>
                {isAdmin && (
                  <Link
                    href="/dashboard"
                    className={buttonVariants({ size: "lg", variant: "ghost" })}
                  >
                    Dashboard ✨
                  </Link>
                )}
                {/* <Link
                  href="#utilisation"
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                >
                  Guide d&apos;utilisation
                </Link> */}
                <Link href="#faq" className={buttonVariants({ size: "lg", variant: "ghost" })}>
                  Questions/Réponses
                </Link>
                <Link
                  href="/configure/upload"
                  className={buttonVariants({
                    size: "lg",
                    className: "hidden lg:flex items-center gap-1",
                  })}
                >
                  Générer vos bulletins
                  <ArrowRight className="ml-1.5 h-5 w-5" />
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => signIn("azure-ad", { callbackUrl: "/home" })}
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                >
                  Se connecter
                </button>

                <div className="h-8 w-px bg-zinc-200 hidden sm:block" />

                <Link
                  href="/configure/upload"
                  className={buttonVariants({
                    size: "sm",
                    className: "hidden sm:flex items-center gap-1",
                  })}
                >
                  Générer vos bulletins
                  <ArrowRight className="ml-1.5 h-5 w-5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </MaxWidthWrapper>
    </nav>
  );
};

export default Navbar;
