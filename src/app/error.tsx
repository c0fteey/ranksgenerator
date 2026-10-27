"use client";

import { useEffect } from "react";
import { ErrorScreen, describeError } from "@/components/ErrorScreen";

// Catches errors in every page below the root layout.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen {...describeError(error)} digest={error.digest} retry={retry} />;
}
