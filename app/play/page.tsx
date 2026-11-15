
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const GravityExplorerGame = dynamic(
  () => import("@/components/GravityExplorerGame"),
  { ssr: false }
);

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading planetary environment...</div>}>
      <GravityExplorerGame />
    </Suspense>
  );
}
