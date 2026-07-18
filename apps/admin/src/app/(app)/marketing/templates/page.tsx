"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/components/ui/card";
import { PlusIcon } from "@repo/ui/icons";

export default function MarketingTemplatesPage() {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Templates</h1>
          <p className="text-muted-foreground">
            Design and manage email templates for automated campaigns
          </p>
        </div>
        <Button onClick={() => router.push("/marketing/templates/new")}>
          <PlusIcon /> New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Templates will render here */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-sm">No templates yet</CardTitle>
            <CardDescription>
              Create your first campaign template to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
