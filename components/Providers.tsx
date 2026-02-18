"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

const Providers = ({ children }: { children: ReactNode }) => {
  // ✅ Instance créée par utilisateur, pas partagée globalement
  const [client] = useState(() => new QueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

export default Providers;