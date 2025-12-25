import * as React from "react"
import { cn } from "@/lib/utils"

interface DualProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  spent: number;
  committed: number;
  total: number;
  spentLabel?: string;
  committedLabel?: string;
}

const DualProgress = React.forwardRef<HTMLDivElement, DualProgressProps>(
  ({ className, spent, committed, total, spentLabel = "Spent", committedLabel = "Committed", ...props }, ref) => {
    const spentPercent = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
    const committedPercent = total > 0 ? Math.min((committed / total) * 100, 100 - spentPercent) : 0;
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className="absolute left-0 top-0 h-full bg-primary transition-all"
          style={{ width: `${spentPercent}%` }}
          title={`${spentLabel}: ${spentPercent.toFixed(1)}%`}
        />
        <div
          className="absolute top-0 h-full bg-amber-500 dark:bg-amber-600 transition-all"
          style={{ left: `${spentPercent}%`, width: `${committedPercent}%` }}
          title={`${committedLabel}: ${committedPercent.toFixed(1)}%`}
        />
      </div>
    )
  }
)
DualProgress.displayName = "DualProgress"

export { DualProgress }
