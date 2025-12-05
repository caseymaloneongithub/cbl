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
import { formatCurrency, calculateTotalValue } from "@/lib/utils";
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
}

export function AutoBidDialog({ freeAgent, open, onOpenChange }: AutoBidDialogProps) {
  const { toast } = useToast();
  const [selectedYears, setSelectedYears] = useState(1);

  const { data: settings } = useQuery<LeagueSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: existingAutoBid } = useQuery<AutoBid | null>({
    queryKey: ["/api/free-agents", freeAgent?.id, "auto-bid"],
    enabled: !!freeAgent?.id,
  });

  const yearFactors = settings
    ? [settings.yearFactor1, settings.yearFactor2, settings.yearFactor3, settings.yearFactor4, settings.yearFactor5]
    : [1, 1.25, 1.33, 1.43, 1.55];

  const playerMinimumYears = freeAgent?.minimumYears || 1;

  const form = useForm<AutoBidFormData>({
    resolver: zodResolver(autoBidSchema),
    defaultValues: {
      maxAmount: 100,
      years: 1,
      isActive: true,
    },
  });

  useEffect(() => {
    if (open && freeAgent) {
      const validYears = existingAutoBid 
        ? Math.max(existingAutoBid.years, playerMinimumYears)
        : playerMinimumYears;
      form.reset({
        maxAmount: freeAgent.minimumBid,
        years: validYears,
        isActive: existingAutoBid?.isActive ?? true,
      });
      setSelectedYears(validYears);
    }
  }, [open, existingAutoBid, playerMinimumYears, freeAgent, form]);

  const watchMaxAmount = form.watch("maxAmount");
  const watchIsActive = form.watch("isActive");
  const factor = yearFactors[selectedYears - 1] || 1;
  const maxTotalValue = (watchMaxAmount || 0) * factor;

  const saveAutoBid = useMutation({
    mutationFn: async (data: AutoBidFormData) => {
      await apiRequest("POST", `/api/free-agents/${freeAgent!.id}/auto-bid`, {
        maxAmount: data.maxAmount,
        years: data.years,
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      toast({
        title: "Auto-Bid Saved",
        description: watchIsActive
          ? `Auto-bid configured up to ${formatCurrency(watchMaxAmount)} for ${selectedYears} year(s)`
          : "Auto-bid has been disabled",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-agents", freeAgent?.id, "auto-bid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-auto-bids"] });
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
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Auction ends</span>
              <CountdownTimer endTime={freeAgent.auctionEndTime} />
            </div>
            {freeAgent.currentBid ? (
              <div className="mt-2 text-sm">
                Current high bid: <span className="font-mono font-medium">{formatCurrency(freeAgent.currentBid.totalValue)}</span>
              </div>
            ) : (
              <div className="mt-2 text-sm">
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
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              className="pl-7 font-mono text-lg"
                              min={1}
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
                      Auto-bid will place bids in 10% increments until your maximum is reached or you win the auction.
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
