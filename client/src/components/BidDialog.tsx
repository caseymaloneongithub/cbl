import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, calculateTotalValue, calculateMinimumBid, formatNumberWithCommas } from "@/lib/utils";
import { CountdownTimer } from "./CountdownTimer";
import type { FreeAgentWithBids, LeagueSettings, BidWithUser } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Loader2 } from "lucide-react";

const bidSchema = z.object({
  amount: z.number().min(1, "Bid amount must be at least $1"),
  years: z.number().min(1).max(5),
});

type BidFormData = z.infer<typeof bidSchema>;

interface BidDialogProps {
  freeAgent: FreeAgentWithBids | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidIncrement?: number;
}

export function BidDialog({ freeAgent, open, onOpenChange, bidIncrement = 0.10 }: BidDialogProps) {
  const { toast } = useToast();
  const [selectedYears, setSelectedYears] = useState(1);

  const { data: settings } = useQuery<LeagueSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: bidHistory } = useQuery<BidWithUser[]>({
    queryKey: ["/api/free-agents", freeAgent?.id, "bids"],
    enabled: !!freeAgent?.id,
  });

  const yearFactors = settings
    ? [settings.yearFactor1, settings.yearFactor2, settings.yearFactor3, settings.yearFactor4, settings.yearFactor5]
    : [1, 1.25, 1.33, 1.43, 1.55];

  const currentTotalValue = freeAgent?.currentBid?.totalValue || 0;
  const playerMinimumBid = freeAgent?.minimumBid || 1;
  const playerMinimumYears = freeAgent?.minimumYears || 1;
  // Minimum bid is always at least the player's minimum bid (dollar amount)
  // When there's a current bid, also ensure it beats the total value by the required increment
  const minimumBid = currentTotalValue > 0
    ? Math.max(calculateMinimumBid(currentTotalValue, selectedYears, yearFactors, bidIncrement), playerMinimumBid)
    : playerMinimumBid;

  const form = useForm<BidFormData>({
    resolver: zodResolver(bidSchema),
    defaultValues: {
      amount: minimumBid,
      years: 1,
    },
  });

  useEffect(() => {
    if (open) {
      // Ensure selected years respects minimum years
      const validYears = Math.max(selectedYears, playerMinimumYears);
      if (validYears !== selectedYears) {
        setSelectedYears(validYears);
      }
      form.reset({
        amount: minimumBid,
        years: validYears,
      });
    }
  }, [open, minimumBid, selectedYears, playerMinimumYears, form]);

  const watchAmount = form.watch("amount");
  const totalValue = calculateTotalValue(watchAmount || 0, selectedYears, yearFactors);
  const isValidBid = totalValue >= currentTotalValue * (1 + bidIncrement) || currentTotalValue === 0;
  const bidIncrementPercent = Math.round(bidIncrement * 100);

  const submitBid = useMutation({
    mutationFn: async (data: BidFormData) => {
      const response = await apiRequest("POST", `/api/free-agents/${freeAgent!.id}/bids`, {
        amount: data.amount,
        years: data.years,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bid Placed",
        description: `Your bid of ${formatCurrency(watchAmount)} for ${selectedYears} year(s) has been submitted!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents", freeAgent?.id, "bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // If auto-bids were triggered, force full data refresh
      if (data?.autoBidsTriggered) {
        queryClient.invalidateQueries({ queryKey: ["/api/my-auto-bids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-bundles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/results"] });
        queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
        queryClient.invalidateQueries({ queryKey: ["/api/limits"] });
      }
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Bid Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: BidFormData) => {
    submitBid.mutate({ ...data, years: selectedYears });
  };

  if (!freeAgent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl">{freeAgent.name}</span>
            <Badge variant="secondary">{freeAgent.playerType === "pitcher" ? "Pitcher" : "Hitter"}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1">
          {/* Current Bid Info */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Current High Bid</span>
              <CountdownTimer endTime={freeAgent.auctionEndTime} />
            </div>
            {freeAgent.currentBid ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono" data-testid="text-current-bid">
                  {formatCurrency(freeAgent.currentBid.amount)}
                </span>
                <span className="text-muted-foreground">
                  × {freeAgent.currentBid.years} yr = {formatCurrency(freeAgent.currentBid.totalValue)} total
                </span>
              </div>
            ) : (
              <div>
                <span className="text-lg text-muted-foreground">No bids yet</span>
                <p className="text-sm text-muted-foreground mt-1">
                  Minimum opening bid: {formatCurrency(playerMinimumBid)}
                </p>
              </div>
            )}
            {freeAgent.highBidder && (
              <p className="text-sm text-muted-foreground mt-1">
                by {freeAgent.highBidder.firstName} {freeAgent.highBidder.lastName}
              </p>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Year Selection */}
              <div>
                <FormLabel>Contract Years</FormLabel>
                {playerMinimumYears > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    This player requires at least a {playerMinimumYears}-year contract
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((year) => (
                    <Button
                      key={year}
                      type="button"
                      variant={selectedYears === year ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => {
                        setSelectedYears(year);
                        form.setValue("years", year);
                        const newMinBid = currentTotalValue > 0
                          ? calculateMinimumBid(currentTotalValue, year, yearFactors)
                          : playerMinimumBid;
                        form.setValue("amount", newMinBid);
                      }}
                      disabled={year < playerMinimumYears}
                      data-testid={`button-year-${year}`}
                    >
                      {year}yr
                      <span className="text-xs ml-1 opacity-70">×{yearFactors[year - 1]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Bid Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bid Amount ($/year)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(field.value)}
                          onChange={(e) => {
                            const numericOnly = e.target.value.replace(/[^\d]/g, '');
                            field.onChange(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="pl-7 font-mono text-lg"
                          data-testid="input-bid-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      {currentTotalValue > 0 
                        ? `Minimum bid: ${formatCurrency(minimumBid)}/yr (${bidIncrementPercent}% increase in total value)`
                        : `Minimum opening bid: ${formatCurrency(playerMinimumBid)}/yr`
                      }
                    </p>
                  </FormItem>
                )}
              />

              {/* Total Value Display */}
              <div className="rounded-lg border p-4 bg-background">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Your Total Contract Value</span>
                  <span
                    className={`text-2xl font-bold font-mono ${
                      !isValidBid ? "text-destructive" : "text-primary"
                    }`}
                    data-testid="text-total-value"
                  >
                    {formatCurrency(totalValue)}
                  </span>
                </div>
                {!isValidBid && currentTotalValue > 0 && (
                  <p className="text-xs text-destructive mt-2">
                    Must be at least {formatCurrency(Math.ceil(currentTotalValue * (1 + bidIncrement)))} ({bidIncrementPercent}% above current)
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitBid.isPending || !isValidBid}
                data-testid="button-submit-bid"
              >
                {submitBid.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Placing Bid...
                  </>
                ) : (
                  `Place Bid - ${formatCurrency(watchAmount || 0)}/yr × ${selectedYears}yr`
                )}
              </Button>
            </form>
          </Form>

          {/* Bid History */}
          {bidHistory && bidHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Recent Bids</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {bidHistory.slice(0, 5).map((bid, index) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between text-sm py-1"
                      data-testid={`bid-history-${index}`}
                    >
                      <span className="text-muted-foreground">
                        {bid.user.firstName} {bid.user.lastName}
                        {bid.isAutoBid && <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>}
                      </span>
                      <span className="font-mono">
                        {formatCurrency(bid.amount)} × {bid.years}yr = {formatCurrency(bid.totalValue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
