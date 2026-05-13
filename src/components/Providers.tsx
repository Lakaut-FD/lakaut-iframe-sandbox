"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
