import Navbar from "@/components/Navbar";
import { Toaster } from "@/components/ui/toaster";
import dynamic from "next/dynamic";
import { ReactNode } from "react";

const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });
const Providers = dynamic(() => import("@/components/Providers"), { ssr: false });

const HomeLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Navbar />
      <main className="flex grainy-light flex-col min-h-[calc(100vh-3.5rem-1px)]">
        <div className="flex-1 flex flex-col h-full">
          <Providers>{children}</Providers>
        </div>
        <Footer />
      </main>

      <Toaster />
    </>
  );
};

export default HomeLayout;
