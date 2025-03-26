"use client";

import dynamic from "next/dynamic";

const ConfigureForm = dynamic(() => import("./ConfigureForm"), {
  ssr: false,
});

export default function Page() {
  return <ConfigureForm />;
}
