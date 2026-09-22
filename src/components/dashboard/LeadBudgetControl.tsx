"use client";

// Budget typed by a person (amount + currency) on the lead card. Native
// controls, like the other lead controls. Saving goes through
// /api/leads/set-budget; "Quitar" clears it so the bot's figure shows again.
// The parent re-keys this component after router.refresh() so the prefilled
// state follows the server.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorText, postLead } from "@/lib/crm/api-client";
import { LEAD_CAPTION_CLASS, LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  waId: string;
  // The manual figure to prefill, or null when the lead has none of its own.
  manual: { amount: number; currency: string } | null;
  currencies: ReadonlyArray<string>;
  labels: CrmLabels;
};

export function LeadBudgetControl({ waId, manual, currencies, labels }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(manual ? String(manual.amount) : "");
  const [currency, setCurrency] = useState(manual?.currency ?? currencies[0] ?? "");
  const t = labels.budget;

  const parsed = Number(amount.replace(/[^\d]/g, ""));
  const valid = Number.isInteger(parsed) && parsed > 0;
  const unchanged = manual !== null && parsed === manual.amount && currency === manual.currency;

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const res = await postLead("set-budget", { contactWaId: waId, ...body });
    setBusy(false);
    if (res.ok) {
      toast.success(labels.saved);
      router.refresh();
    } else {
      toast.error(errorText(labels.errors, res.error));
    }
  }

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !unchanged) void run({ amount: parsed, currency });
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-1.5">
        <div className="space-y-1">
          <label htmlFor={`budget-amount-${waId}`} className={LEAD_CAPTION_CLASS}>
            {t.amountLabel}
          </label>
          <input
            id={`budget-amount-${waId}`}
            data-testid="lead-budget-amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t.amountPlaceholder}
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
            className={cn(LEAD_FIELD_CLASS, "tabular-nums")}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`budget-currency-${waId}`} className={LEAD_CAPTION_CLASS}>
            {t.currencyLabel}
          </label>
          <select
            id={`budget-currency-${waId}`}
            data-testid="lead-budget-currency"
            value={currency}
            disabled={busy}
            onChange={(e) => setCurrency(e.target.value)}
            className={LEAD_FIELD_CLASS}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {manual ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={busy}
            title={t.clearHint}
            data-testid="lead-budget-clear"
            onClick={() => void run({ amount: null })}
          >
            {t.clear}
          </Button>
        ) : null}
        <Button type="submit" size="xs" disabled={busy || !valid || unchanged} data-testid="lead-budget-save">
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          {t.save}
        </Button>
      </div>
    </form>
  );
}
