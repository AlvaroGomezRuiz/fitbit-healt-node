import type * as React from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function MainSectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return <AppShell>{children}</AppShell>;
}
