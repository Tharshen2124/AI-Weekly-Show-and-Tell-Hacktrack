"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useState } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      // Allows `next build` to succeed without env; real usage requires the var.
      console.warn("NEXT_PUBLIC_CONVEX_URL is not set");
      return new ConvexReactClient("https://unconfigured.convex.cloud");
    }
    return new ConvexReactClient(url);
  });
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
