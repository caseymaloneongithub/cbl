import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, isAuctionClosed, formatNumberWithCommas } from "@/lib/utils";
import type { FreeAgentWithBids } from "@shared/schema";
import { Plus, Trash2, GripVertical, Package, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BundleItem {
  id: string;
  freeAgentId: number;
  freeAgentName: string;
  amount: number;
  years: number;
  priority: number;
}

interface BundleDialogProps {
  auctionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BundleDialog({ auctionId, open, onOpenChange }: BundleDialogProps) {
  const { toast } = useToast();
  const [bundleName, setBundleName] = useState("");
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [years, setYears] = useState("1");
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false);

  const { data: freeAgents } = useQuery<FreeAgentWithBids[]>({
    queryKey: ["/api/free-agents", auctionId],
    enabled: open && !!auctionId,
  });

  const createBundleMutation = useMutation({
    mutationFn: async (data: { auctionId: number; name: string; items: { freeAgentId: number; amount: number; years: number; priority: number }[] }) => {
      const response = await apiRequest("POST", "/api/bundles", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-bundles"] });
      toast({ title: "Bundle created successfully" });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create bundle", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setBundleName("");
    setBundleItems([]);
    setSelectedAgentId("");
    setAmount(0);
    setYears("1");
  };

  const availableAgents = freeAgents?.filter(
    (agent) => !isAuctionClosed(agent.auctionEndTime)
  ) || [];

  const handleAddItem = () => {
    if (!selectedAgentId || !amount) return;

    const agent = freeAgents?.find((a) => a.id === parseInt(selectedAgentId));
    if (!agent) return;

    const parsedYears = parseInt(years);

    // Validate amount is a positive number
    if (amount <= 0) {
      toast({ title: "Please enter a valid positive amount", variant: "destructive" });
      return;
    }

    // Validate amount meets minimum bid
    if (amount < agent.minimumBid) {
      toast({ 
        title: `Amount must be at least ${formatCurrency(agent.minimumBid)} (player minimum)`, 
        variant: "destructive" 
      });
      return;
    }

    // Validate years meets minimum
    const minYears = agent.minimumYears || 1;
    if (parsedYears < minYears) {
      toast({ 
        title: `This player requires at least a ${minYears}-year contract`, 
        variant: "destructive" 
      });
      return;
    }

    const newItem: BundleItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      freeAgentId: parseInt(selectedAgentId),
      freeAgentName: agent.name,
      amount: amount,
      years: parsedYears,
      priority: bundleItems.length + 1,
    };

    setBundleItems([...bundleItems, newItem]);
    setSelectedAgentId("");
    setAmount(0);
    setYears("1");
  };

  const handleRemoveItem = (itemId: string) => {
    const filtered = bundleItems.filter((item) => item.id !== itemId);
    setBundleItems(
      filtered.map((item, idx) => ({ ...item, priority: idx + 1 }))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...bundleItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setBundleItems(newItems.map((item, idx) => ({ ...item, priority: idx + 1 })));
  };

  const handleMoveDown = (index: number) => {
    if (index === bundleItems.length - 1) return;
    const newItems = [...bundleItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setBundleItems(newItems.map((item, idx) => ({ ...item, priority: idx + 1 })));
  };

  const handleSubmit = () => {
    if (bundleItems.length === 0) {
      toast({ title: "Add at least one player to the bundle", variant: "destructive" });
      return;
    }

    if (bundleItems.length > 5) {
      toast({ title: "Bundle can have at most 5 players", variant: "destructive" });
      return;
    }

    createBundleMutation.mutate({
      auctionId,
      name: bundleName || `Bundle ${new Date().toLocaleDateString()}`,
      items: bundleItems.map(({ id, freeAgentName, ...rest }) => rest),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Bid Bundle
          </DialogTitle>
          <DialogDescription>
            Add up to 5 bids in priority order. You can add the same player multiple times
            with different amounts/years (e.g., $5M/2yr first, then $7M/1yr as fallback).
            When outbid, the system moves to your next priority.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="bundle-name">Bundle Name (optional)</Label>
            <Input
              id="bundle-name"
              placeholder="e.g., Top Pitching Targets"
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
              data-testid="input-bundle-name"
            />
          </div>

          <div className="space-y-4">
            <Label>Players ({bundleItems.length}/5)</Label>
            
            {bundleItems.length > 0 && (
              <div className="space-y-2">
                {bundleItems.map((item, idx) => (
                  <Card key={item.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={idx === 0}
                            onClick={() => handleMoveUp(idx)}
                            data-testid={`button-move-up-${item.id}`}
                          >
                            <span className="text-xs">^</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={idx === bundleItems.length - 1}
                            onClick={() => handleMoveDown(idx)}
                            data-testid={`button-move-down-${item.id}`}
                          >
                            <span className="text-xs">v</span>
                          </Button>
                        </div>
                        <Badge variant="outline" className="font-mono">#{idx + 1}</Badge>
                        <div>
                          <div className="font-medium">{item.freeAgentName}</div>
                          <div className="text-sm text-muted-foreground">
                            Max: {formatCurrency(item.amount)} / {item.years}yr
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        data-testid={`button-remove-item-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {bundleItems.length < 5 && (
              <Card className="border-dashed">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">Player</Label>
                      <Popover open={playerSearchOpen} onOpenChange={setPlayerSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={playerSearchOpen}
                            className="w-full justify-between font-normal"
                            data-testid="select-player"
                          >
                            {selectedAgentId
                              ? availableAgents.find((agent) => agent.id.toString() === selectedAgentId)?.name
                              : "Search players..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search players..." data-testid="input-player-search" />
                            <CommandList>
                              <CommandEmpty>No player found.</CommandEmpty>
                              <CommandGroup>
                                {availableAgents.map((agent) => (
                                  <CommandItem
                                    key={agent.id}
                                    value={agent.name}
                                    onSelect={() => {
                                      setSelectedAgentId(agent.id.toString());
                                      setPlayerSearchOpen(false);
                                    }}
                                    data-testid={`option-player-${agent.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedAgentId === agent.id.toString() ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {agent.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs">Max Amount ($)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Max bid"
                        value={formatNumberWithCommas(amount)}
                        onChange={(e) => {
                          const numericOnly = e.target.value.replace(/[^\d]/g, '');
                          setAmount(numericOnly === "" ? 0 : parseInt(numericOnly, 10));
                        }}
                        data-testid="input-amount"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Years</Label>
                      <Select value={years} onValueChange={setYears}>
                        <SelectTrigger data-testid="select-years">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 year</SelectItem>
                          <SelectItem value="2">2 years</SelectItem>
                          <SelectItem value="3">3 years</SelectItem>
                          <SelectItem value="4">4 years</SelectItem>
                          <SelectItem value="5">5 years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleAddItem}
                    disabled={!selectedAgentId || !amount}
                    data-testid="button-add-player"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Player to Bundle
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-bundle"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bundleItems.length === 0 || createBundleMutation.isPending}
            data-testid="button-submit-bundle"
          >
            {createBundleMutation.isPending ? "Creating..." : "Create Bundle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
