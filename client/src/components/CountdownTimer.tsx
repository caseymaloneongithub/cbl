import { useEffect, useState } from "react";
import { formatTimeRemaining, isAuctionEnding, isAuctionClosed } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CountdownTimerProps {
  endTime: Date | string;
  className?: string;
}

export function CountdownTimer({ endTime, className }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(endTime));
  const [isEnding, setIsEnding] = useState(() => isAuctionEnding(endTime));
  const [isClosed, setIsClosed] = useState(() => isAuctionClosed(endTime));

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(formatTimeRemaining(endTime));
      setIsEnding(isAuctionEnding(endTime));
      setIsClosed(isAuctionClosed(endTime));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  if (isClosed) {
    return (
      <Badge variant="secondary" className={cn("font-mono", className)}>
        CLOSED
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        "font-mono text-sm",
        isEnding && "text-destructive font-medium animate-pulse",
        className
      )}
      data-testid="text-countdown"
    >
      {timeRemaining}
    </span>
  );
}
