import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Navbar from "@/components/Navbar";
import Steps from "@/components/Steps";
import { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <Navbar />
      <MaxWidthWrapper className="flex-1 flex flex-col">
        <Steps />
        {children}
      </MaxWidthWrapper>
    </>
  );
};

export default Layout;
