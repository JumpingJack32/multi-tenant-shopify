"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";

interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface Correction {
  row: number;
  [field: string]: string | number;
}

interface CsvErrorResolverProps {
  errors: ImportError[];
  onResolve: (corrections: Correction[]) => Promise<void>;
  onClose: () => void;
  open: boolean;
}

export function CsvErrorResolver({
  errors,
  onResolve,
  onClose,
  open,
}: CsvErrorResolverProps) {
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uniqueRows = useMemo(() => {
    const seen = new Set<number>();
    return errors.filter((e) => {
      if (seen.has(e.row)) return false;
      seen.add(e.row);
      return true;
    });
  }, [errors]);

  const handleChange = useCallback(
    (row: number, field: string, value: string) => {
      const key = `${row}:${field}`;
      setCorrections((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    const grouped: Record<number, Correction> = {};
    for (const err of errors) {
      if (!grouped[err.row]) grouped[err.row] = { row: err.row };
      const corrected = corrections[`${err.row}:${err.field}`];
      if (corrected !== undefined && corrected !== "") {
        grouped[err.row]![err.field] = corrected;
      }
    }
    await onResolve(Object.values(grouped));
    setIsSubmitting(false);
  }, [errors, corrections, onResolve]);

  const hasCorrections = Object.keys(corrections).length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {errors.length} error{errors.length !== 1 ? "s" : ""} — review and
            correct
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-2 py-4">
          {uniqueRows.map((err) => {
            const cellKey = `${err.row}:${err.field}`;
            return (
              <div
                key={cellKey}
                className="grid grid-cols-[48px_1fr_1fr_1fr_2fr] gap-2 items-center text-sm p-2 rounded even:bg-muted/30"
              >
                <span className="text-muted-foreground text-xs font-mono">
                  #{err.row}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {err.field}
                </span>
                <span
                  className="text-xs text-destructive truncate"
                  title={err.value}
                >
                  {err.value}
                </span>
                <input
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                  placeholder="Corrected value..."
                  defaultValue={corrections[cellKey] ?? ""}
                  onChange={(e) =>
                    handleChange(err.row, err.field, e.target.value)
                  }
                />
                <span
                  className="text-xs text-muted-foreground truncate"
                  title={err.message}
                >
                  {err.message}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Discard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasCorrections || isSubmitting}
          >
            {isSubmitting ? "Applying..." : "Apply Corrections"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
