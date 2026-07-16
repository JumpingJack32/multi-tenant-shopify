"use client";

import { useCallback, useRef, useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Progress } from "@repo/ui/components/ui/progress";
import { UploadIcon } from "@repo/ui/icons";

import { useImportCsv } from "@/features/customers/hooks/use-customers";

interface ImportCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string | null;
}

export function ImportCustomerDialog({
  open,
  onOpenChange,
  tenantId,
}: ImportCustomerDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportCsv(tenantId);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".csv")) setFile(f);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) setFile(f);
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (!file) return;
    await importMutation.mutateAsync(file);
    setFile(null);
    onOpenChange(false);
  }, [file, importMutation, onOpenChange]);

  const result = importMutation.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
        </DialogHeader>

        {!result && (
          <div className="space-y-4 py-2">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                Drop your CSV file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Headers: email, first_name, last_name, phone,
                subscription_status, store_credit_pounds, tags
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {file && (
              <div className="flex items-center justify-between text-sm p-2 rounded border">
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {importMutation.isPending && (
              <Progress value={50} className="w-full" />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || importMutation.isPending}
              >
                {importMutation.isPending ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 py-2">
            <p className="text-sm">
              <Badge variant="secondary" className="mr-1">
                {result.imported}
              </Badge>{" "}
              customers imported
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                <p className="text-sm font-medium text-destructive">Errors:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Row {String(err.row)}: {String(err.field)} —{" "}
                    {String(err.message)}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
