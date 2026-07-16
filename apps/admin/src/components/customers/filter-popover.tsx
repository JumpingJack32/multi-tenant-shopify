"use client";

import { useCallback, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { FilterIcon } from "@repo/ui/icons";

interface FilterValues {
  status: string;
  location: string;
  min_spent: string;
  max_spent: string;
  tag: string;
}

interface FilterPopoverProps {
  initial: FilterValues;
  onApply: (filters: FilterValues) => void;
  onSaveSegment: (name: string, filters: FilterValues) => void;
}

export function FilterPopover({
  initial,
  onApply,
  onSaveSegment,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(initial);
  const [segmentName, setSegmentName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const handleApply = useCallback(() => {
    onApply(filters);
    setOpen(false);
  }, [filters, onApply]);

  const handleSave = useCallback(() => {
    if (!segmentName.trim()) return;
    onSaveSegment(segmentName.trim(), filters);
    setSegmentName("");
    setShowSave(false);
    setOpen(false);
  }, [segmentName, filters, onSaveSegment]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="h-9" />}>
        <FilterIcon />
        {hasActiveFilters ? "Filters Active" : "+ Add Filter"}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Filters</h4>

          <div className="space-y-2">
            <Label>Subscription Status</Label>
            <Select
              value={filters.status}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v ?? "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="City or country..."
              value={filters.location}
              onChange={(e) =>
                setFilters((f) => ({ ...f, location: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Min Spent (£)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={filters.min_spent}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, min_spent: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Spent (£)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="999.99"
                value={filters.max_spent}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, max_spent: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tag</Label>
            <Input
              placeholder="e.g. VIP"
              value={filters.tag}
              onChange={(e) =>
                setFilters((f) => ({ ...f, tag: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleApply}>
              Apply Filters
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSave(!showSave)}
            >
              Save
            </Button>
          </div>

          {showSave && (
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label>Segment name</Label>
                <Input
                  placeholder="UK High Spenders"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!segmentName.trim()}
              >
                Save
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
