import { Suspense } from "react";
import Generator from "@/components/Generator";
import { Gate, PageFallback } from "@/components/auth/Gate";

export default function Home() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Gate permission="generator.use">
        {() => (
          <>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Bluesky&apos;s Ranks</h1>
              <p className="mt-1 text-sm text-muted">Customize your rank tag in real-time and export as PNG.</p>
            </div>
            <Generator />
          </>
        )}
      </Gate>
    </Suspense>
  );
}
