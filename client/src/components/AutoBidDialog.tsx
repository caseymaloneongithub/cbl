import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, calculateTotalValue, formatNumberWithCommas, parseFormattedNumber } from "@/lib/utils";
import { CountdownTimer } from "./CountdownTimer";
import type { FreeAgentWithBids, LeagueSettings, AutoBid } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Loader2, Zap, AlertTriangle } from "lucide-react";

const autoBidSchema = z.object({
  maxAmount: z.number().min(1, "Maximum bid must be at least $1"),
  years: z.number().min(1).max(5),
  isActive: z.boolean(),
});

type AutoBidFormData = z.infer<typeof autoBidSchema>;

interface AutoBidDialogProps {
  freeAgent: FreeAgentWithBids | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidIncrement?: number;
}

export function AutoBidDialog({ freeAgent, open, onOpenChange, bidIncrement = 0.10 }: AutoBidDialogProps) {
  const { toast } = useToast();
  const [selectedYears, setSelectedYears] = useState(1);
  const initializedForRef = useRef<number | null>(null);

  const { data: settings } = useQuery<LeagueSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: existingAutoBid } = useQuery<AutoBid | null>({
    queryKey: ["/api/free-agents", freeAgent?.id, "auto-bid"],
    enabled: !!freeAgent?.id,
  });

  // Fetch fresh free agent data to get current bid info (needed when editing from MyBids)
  const { data: freshFreeAgent } = useQuery<FreeAgentWithBids>({
    queryKey: ["/api/free-agents", freeAgent?.id],
    enabled: !!freeAgent?.id && open,
  });

  // Use fresh data if available, otherwise fall back to passed prop
  const currentBidInfo = freshFreeAgent?.currentBid ?? freeAgent?.currentBid;

  const yearFactors = useMemo(() => 
    settings
      ? [settings.yearFactor1, settings.yearFactor2, settings.yearFactor3, settings.yearFactor4, settings.yearFactor5]
      : [1, 1.25, 1.33, 1.43, 1.55],
    [settings]
  );

  const playerMinimumYears = freeAgent?.minimumYears || 1;

  const form = useForm<AutoBidFormData>({
    resolver: zodResolver(autoBidSchema),
    defaultValues: {
      maxAmount: 100,
      years: 1,
      isActive: true,
    },
  });

  // Reset form when dialog opens for a player, or when existingAutoBid loads for first time
  useEffect(() => {
    // Clear initialization tracking when dialog closes
    if (!open) {
      initializedForRef.current = null;
      return;
    }
    
    if (!freeAgent) return;
    
    // Check if we need to initialize: either new player or existingAutoBid just loaded
    const needsInit = initializedForRef.current !== freeAgent.id;
    const autoBidJustLoaded = initializedForRef.current === freeAgent.id && existingAutoBid && 
      form.getValues("maxAmount") !== existingAutoBid.maxAmount;
    
    if (needsInit || autoBidJustLoaded) {
      const validYears = existingAutoBid 
        ? Math.max(existingAutoBid.years, playerMinimumYears)
        : playerMinimumYears;
      
      let amount: number;
      
      if (existingAutoBid) {
        // Editing existing auto-bid: use the saved values
        amount = existingAutoBid.maxAmount;
      } else {
        // Creating new auto-bid: calculate suggested amount to beat current high bid
        const currentFactor = yearFactors[validYears - 1] || 1;
        if (freeAgent.currentBid) {
          const targetTotalValue = freeAgent.currentBid.totalValue * (1 + bidIncrement);
          amount = Math.ceil(targetTotalValue / currentFactor);
        } else {
          amount = freeAgent.minimumBid;
        }
      }
      
      form.reset({
        maxAmount: amount,
        years: validYears,
        isActive: existingAutoBid?.isActive ?? true,
      });
      setSelectedYears(validYears);
      initializedForRef.current = freeAgent.id;
    }
  }, [open, existingAutoBid, playerMinimumYears, freeAgent, form, bidIncrement, yearFactors]);

  const watchMaxAmount = form.watch("maxAmount");
  const watchIsActive = form.watch("isActive");
  const factor = yearFactors[selectedYears - 1] || 1;
  const maxTotalValue = (watchMaxAmount || 0) * factor;
  const bidIncrementPercent = Math.round(bidIncrement * 100);

  const saveAutoBid = useMutation({
    mutationFn: async (data: AutoBidFormData) => {
      const response = await apiRequest("POST", `/api/free-agents/${freeAgent!.id}/auto-bid`, {
        maxAmount: data.maxAmount,
        years: data.years,
        isActive: data.isActive,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Auto-Bid Saved",
        description: watchIsActive
          ? `Auto-bid configured up to ${formatCurrency(watchMaxAmount)} for ${selectedYears} year(s)`
          : "Auto-bid has been disabled",
      });
      // Invalidate all bid-related queries immediately for instant refresh
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents", freeAgent?.id, "auto-bid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-auto-bids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-outbid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-bundles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/limits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
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
        title: "Failed to Save",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AutoBidFormData) => {
    saveAutoBid.mutate({ ...data, years: selectedYears });
  };

  if (!freeAgent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <span>Auto-Bid: {freeAgent.name} {freeAgent.team ? `(${freeAgent.team})` : ""}</span>
          </DialogTitle>
          <DialogDescription>
            Set a maximum bid and the system will automatically bid for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1">
          {/* Current Status */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Auction ends</span>
              <CountdownTimer endTime={freeAgent.auctionEndTime} />
            </div>
            {currentBidInfo ? (
              <>
                <div className="text-sm">
                  Current high bid value: <span className="font-mono font-medium">{formatCurrency(currentBidInfo.totalValue)}</span>
                </div>
                <div className="text-sm">
                  Target to beat (+{Math.round(bidIncrement * 100)}%): <span className="font-mono font-medium text-primary">{formatCurrency(currentBidInfo.totalValue * (1 + bidIncrement))}</span>
                </div>
              </>
            ) : (
              <div className="text-sm">
                Minimum opening bid: <span className="font-mono font-medium">{formatCurrency(freeAgent.minimumBid)}</span>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Enable/Disable */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel>Enable Auto-Bid</FormLabel>
                      <FormDescription>
                        Automatically place bids on your behalf
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-auto-bid"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchIsActive && (
                <>
                  {/* Year Selection */}
                  <div>
                    <FormLabel>Preferred Contract Length</FormLabel>
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
                          }}
                          disabled={year < playerMinimumYears}
                          data-testid={`button-auto-year-${year}`}
                        >
                          {year}yr
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Max Amount */}
                  <FormField
                    control={form.control}
                    name="maxAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Bid ($/year)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberWithCommas(field.value)}
                              onChange={(e) => {
                                const val = e.target.value;
                                const numericOnly = val.replace(/[^\d]/g, '');
                                field.onChange(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                              className="pl-7 font-mono text-lg"
                              data-testid="input-max-bid"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Total Value */}
                  <div className="rounded-lg border p-4 bg-background">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Maximum Total Value</span>
                      <span className="text-xl font-bold font-mono text-primary" data-testid="text-max-total">
                        {formatCurrency(maxTotalValue)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatCurrency(watchMaxAmount)} × {factor}
                    </p>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Auto-bid will place bids in {bidIncrementPercent}% increments until your maximum is reached or you win the auction.
                    </span>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={saveAutoBid.isPending}
                data-testid="button-save-auto-bid"
              >
                {saveAutoBid.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : existingAutoBid ? (
                  "Update Auto-Bid"
                ) : (
                  "Set Auto-Bid"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
