"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Loader2Icon, PlusIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const ROLES = ["Owner", "Admin", "Fulfillment Manager", "Customer Support"];

export default function UsersPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Admin");

  const { data: users, isLoading } = useQuery({
    queryKey: ["tenant-users", currentTenantId],
    queryFn: () => request("/admin/users", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const list = (users ?? []) as Array<{ email: string; role: string; id: string }>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users & Permissions</h1>
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon className="mr-2 h-4 w-4" />Invite User
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" /></div>
              <div><Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v: string | null) => v && setInviteRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!inviteEmail}>Send Invitation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No team members added yet</TableCell></TableRow>
            ) : list.map((u, i) => (
              <TableRow key={u.id || i}>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="outline">{u.role || "Member"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
