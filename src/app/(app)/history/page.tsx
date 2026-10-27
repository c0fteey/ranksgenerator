import { Suspense } from "react";
import { History } from "lucide-react";
import { Gate, PageFallback } from "@/components/auth/Gate";

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Gate permission="history.use">
        {() => (
          <>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">History</h1>
              <p className="mt-1 text-sm text-muted">Tags you have downloaded.</p>
            </div>
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <History className="size-8 text-gold" aria-hidden />
              <p className="font-medium">Coming soon</p>
              <p className="text-sm text-muted">Your download history will show up here.</p>
            </div>
          </>
        )}
      </Gate>
    </Suspense>
  );
}
