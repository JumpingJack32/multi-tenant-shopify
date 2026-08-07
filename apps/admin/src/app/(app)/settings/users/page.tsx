"use client";

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

import { useRbac } from "@/contexts/rbac-context";
import {
  useInviteUser,
  useRemoveUser,
  useTeam,
  useTransferOwnership,
  useUpdateUser,
} from "@/features/team/hooks/use-team";

const ROLES = [
  "owner",
  "admin",
  "ops_manager",
  "support_agent",
  "catalog_specialist",
  "marketing_manager",
  "finance",
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Store Owner",
  admin: "Store Administrator",
  ops_manager: "Operations Manager",
  support_agent: "Support Agent",
  catalog_specialist: "Catalog Specialist",
  marketing_manager: "Marketing Manager",
  finance: "Finance",
};

export default function UsersPage() {
  const { can, role: myRole } = useRbac();
  const { data: users, isLoading } = useTeam();
  const inviteMutation = useInviteUser();
  const updateMutation = useUpdateUser();
  const removeMutation = useRemoveUser();
  const transferMutation = useTransferOwnership();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [error, setError] = useState("");

  const canManageStaff = can("settings.manage_staff");
  const isOwner = myRole === "owner" || myRole === "superuser";
  const list = users ?? [];

  const handleInvite = async () => {
    setError("");
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setShowInvite(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    }
  };

  const handleRoleChange = (id: string, role: string) => {
    updateMutation.mutate({ id, patch: { role } });
  };

  const handleToggleActive = (member: (typeof list)[number]) => {
    updateMutation.mutate({
      id: member.id,
      patch: { is_active: !member.is_active },
    });
  };

  const handleRemove = (id: string) => {
    if (confirm("Remove this team member?")) removeMutation.mutate(id);
  };

  const handleTransfer = (id: string) => {
    if (confirm("Transfer ownership to this user? You will become admin.")) {
      transferMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users & Permissions</h1>
        {canManageStaff && (
          <Dialog open={showInvite} onOpenChange={setShowInvite}>
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />Invite User
            </Button>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
              <div className="space-y-3 py-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r !== "owner").map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  className="w-full"
                  disabled={!inviteEmail || inviteMutation.isPending}
                  onClick={handleInvite}
                >
                  {inviteMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Send Invitation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No team members added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((u) => {
                    const isOwnerRow = u.role === "owner";
                    return (
                      <TableRow key={u.id}>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {canManageStaff && !isOwnerRow ? (
                            <Select
                              value={u.role}
                              onValueChange={(v) => v && handleRoleChange(u.id, v)}
                            >
                              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ROLES.filter((r) => r !== "owner").map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "default" : "secondary"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {canManageStaff && !isOwnerRow && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleToggleActive(u)}>
                                  {u.is_active ? "Suspend" : "Activate"}
                                </Button>
                                {isOwner && (
                                  <Button size="sm" variant="outline" onClick={() => handleTransfer(u.id)}>
                                    Transfer
                                  </Button>
                                )}
                                <Button size="sm" variant="destructive" onClick={() => handleRemove(u.id)}>
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
