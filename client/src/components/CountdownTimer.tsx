import { useEffect, useState, useRef } from "react";
import { formatTimeRemaining, isAuctionEnding, isAuctionClosed } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CountdownTimerProps {
  endTime: Date | string;
  className?: string;
  onClose?: () => void;
}

export function CountdownTimer({ endTime, className, onClose }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(endTime));
  const [isEnding, setIsEnding] = useState(() => isAuctionEnding(endTime));
  const [isClosed, setIsClosed] = useState(() => isAuctionClosed(endTime));
  const hasCalledOnClose = useRef(false);

  useEffect(() => {
    hasCalledOnClose.current = false;
  }, [endTime]);

  useEffect(() => {
    const updateTimer = () => {
      const wasOpen = !isClosed;
      const nowClosed = isAuctionClosed(endTime);
      
      setTimeRemaining(formatTimeRemaining(endTime));
      setIsEnding(isAuctionEnding(endTime));
      setIsClosed(nowClosed);
      
      if (wasOpen && nowClosed && onClose && !hasCalledOnClose.current) {
        hasCalledOnClose.current = true;
        onClose();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime, isClosed, onClose]);

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
