import * as React from "react";

import { HomeDashboardView } from "@/components/features/home-dashboard-view";
import { fetchHomeDashboard } from "@/lib/data/home-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.ReactElement> {
  const dashboard = await fetchHomeDashboard();
  return <HomeDashboardView dashboard={dashboard} />;
}
