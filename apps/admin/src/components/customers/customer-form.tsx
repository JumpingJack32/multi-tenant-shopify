"use client";

import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Separator } from "@repo/ui/components/ui/separator";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { ChevronDownIcon, PlusIcon, XIcon } from "@repo/ui/icons";

const SUGGESTED_TAGS = ["VIP", "Wholesale", "New-2026", "Local"];

interface CustomerFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function CustomerForm({ onSubmit, onCancel }: CustomerFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);
  const [taxReason, setTaxReason] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProvince, setAddrProvince] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCountry, setAddrCountry] = useState("");
  const [addrCompany, setAddrCompany] = useState("");
  const [addrPhone, setAddrPhone] = useState("");

  const addTag = (t: string) => {
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      first_name: firstName || null,
      last_name: lastName || null,
      email: email || null,
      phone: phone || null,
      language,
      email_marketing_consent: emailConsent,
      sms_marketing_consent: smsConsent,
      tax_exempt: taxExempt,
      tax_exempt_reason: taxExempt ? taxReason : null,
      notes: notes || null,
      tags: Object.fromEntries(tags.map((t) => [t, true])),
    };
    if (addrLine1 || addrCity || addrPostal || addrCountry) {
      data.address_line1 = addrLine1;
      data.address_line2 = addrLine2 || null;
      data.address_city = addrCity;
      data.address_province = addrProvince || null;
      data.address_postal_code = addrPostal;
      data.address_country = addrCountry;
      data.address_company = addrCompany || null;
      data.address_phone = addrPhone || null;
    }
    onSubmit(data);
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Section 1: Customer Overview */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Customer Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>First Name</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Last Name</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v ?? "en")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English (Default)</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Customer will receive notifications in this language
            </p>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Phone Number</Label>
            <Input
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={emailConsent}
              onCheckedChange={(v) => setEmailConsent(v === true)}
              id="email-consent"
            />
            <Label htmlFor="email-consent" className="text-sm font-normal">
              Customer agrees to receive marketing emails
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={smsConsent}
              onCheckedChange={(v) => setSmsConsent(v === true)}
              id="sms-consent"
            />
            <Label htmlFor="sms-consent" className="text-sm font-normal">
              Customer agrees to receive SMS marketing text messages
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Note for Operator: Ask customer for permission before subscribing
            them to marketing materials.
          </p>
        </div>
      </section>

      <Separator />

      {/* Section 2: Primary Address */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Primary Address</h2>
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDownIcon className="h-4 w-4" />
            {addrCountry || "Select Country / Region"}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Country / Region</Label>
              <Input
                placeholder="Search or type country name..."
                value={addrCountry}
                onChange={(e) => setAddrCountry(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company (Optional)</Label>
              <Input
                value={addrCompany}
                onChange={(e) => setAddrCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Apartment, suite, etc.</Label>
              <Input
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>State / County</Label>
                <Input
                  value={addrProvince}
                  onChange={(e) => setAddrProvince(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ZIP / Postal Code</Label>
              <Input
                value={addrPostal}
                onChange={(e) => setAddrPostal(e.target.value)}
              />
            </div>
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <PlusIcon className="h-3 w-3" /> Add a different phone number
                for delivery
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Input
                  placeholder="Delivery contact phone"
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                />
              </CollapsibleContent>
            </Collapsible>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <Separator />

      {/* Section 3: Tax Exemptions */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Tax Exemptions</h2>
        <div className="flex items-center gap-2 mb-4">
          <Switch
            checked={taxExempt}
            onCheckedChange={setTaxExempt}
            id="tax-exempt"
          />
          <Label htmlFor="tax-exempt" className="text-sm font-normal">
            This customer is tax exempt
          </Label>
        </div>
        {taxExempt && (
          <div className="space-y-2">
            <Label>Exemption Reason</Label>
            <Select
              value={taxReason}
              onValueChange={(v) => setTaxReason(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wholesale">Wholesale Reseller</SelectItem>
                <SelectItem value="nonprofit">
                  Nonprofit Organization
                </SelectItem>
                <SelectItem value="government">Government Entity</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <Separator />

      {/* Section 4: Notes */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Notes</h2>
        <Label className="text-sm text-muted-foreground mb-2 block">
          Notes (Internal)
        </Label>
        <Textarea
          placeholder="Write any specific notes about this customer here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </section>

      <Separator />

      {/* Section 5: Tags */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Tags &amp; Categorization
        </h2>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Add tags (e.g., VIP, Wholesale, Local)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(tagInput.trim());
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => addTag(tagInput.trim())}
            disabled={!tagInput.trim()}
          >
            <PlusIcon /> Add
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {t}
                <button
                  onClick={() => removeTag(t)}
                  className="hover:text-destructive"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground mr-1 self-center">
            Suggested:
          </span>
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="cursor-pointer text-xs"
              onClick={() => addTag(t)}
            >
              {t}
            </Badge>
          ))}
        </div>
      </section>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 flex justify-end gap-3 z-10">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Save Customer</Button>
      </div>
    </div>
  );
}
