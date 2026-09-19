"use client";

// Hidden actions on a board card, Jira-style: the ⋯ button moves the lead
// between stages (the keyboard / touch path for what drag-and-drop does with a
// mouse), and the owner avatar opens the assignee list. Both variants share
// this component; the board owns the optimistic state and the API calls.

import { Check, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadAvatar } from "@/components/dashboard/LeadAvatar";
import type { CrmLabels } from "@/config/verticals/_types";

// DropdownMenuContent defaults to the trigger's width (`w-(--anchor-width)`),
// which is a 24px icon here — force a readable popup instead.
const MENU_CLASS = "w-auto min-w-[220px] max-w-[280px]";

type Props = {
  variant: "move" | "assign";
  card: { waId: string; displayName: string; stageKey: string; ownerEmail: string | null; ownerLabel: string };
  stages: ReadonlyArray<{ key: string; label: string }>;
  members: ReadonlyArray<{ email: string; label: string }>;
  sessionEmail: string;
  labels: CrmLabels;
  disabled?: boolean;
  onMove: (waId: string, stage: string) => void;
  onAssign: (waId: string, ownerEmail: string | null) => void;
};

export function LeadCardMenu({
  variant,
  card,
  stages,
  members,
  sessionEmail,
  labels,
  disabled,
  onMove,
  onAssign,
}: Props) {
  const isAssign = variant === "assign";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        data-testid={isAssign ? "lead-assign" : "lead-menu"}
        aria-label={`${isAssign ? labels.ownerLabel : labels.moveTo} — ${card.displayName}`}
        className={cn(
          // Tailwind v4 preflight leaves buttons at cursor:default; the repo's
          // Button sets cursor-pointer explicitly and these triggers must too.
          "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--soft-ink)] transition-colors",
          "focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          isAssign
            ? "rounded-full hover:opacity-80"
            : // Kept out of the way until the card is hovered or the button is
              // focused; always visible on touch, where there is no hover.
              "size-6 opacity-0 hover:bg-[var(--canvas-2)] hover:text-[var(--ink)] focus-visible:opacity-100 group-hover/card:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        {isAssign ? (
          <LeadAvatar
            label={card.ownerEmail ? card.ownerLabel : null}
            seed={card.ownerEmail ?? undefined}
            emptyLabel={labels.unassigned}
          />
        ) : (
          <MoreHorizontal className="size-4" aria-hidden />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className={MENU_CLASS}>
        {isAssign ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{labels.ownerLabel}</DropdownMenuLabel>
            {members.map((m) => (
              <DropdownMenuItem
                key={m.email}
                onClick={() => onAssign(card.waId, m.email)}
                className="gap-2"
              >
                <LeadAvatar label={m.label} seed={m.email} emptyLabel={labels.unassigned} />
                <span className="flex-1 truncate">
                  {m.email === sessionEmail && card.ownerEmail !== sessionEmail
                    ? labels.takeLead
                    : m.label}
                </span>
                {m.email === card.ownerEmail ? <Check className="size-3.5" aria-hidden /> : null}
              </DropdownMenuItem>
            ))}
            {card.ownerEmail ? (
              <DropdownMenuItem onClick={() => onAssign(card.waId, null)} className="gap-2">
                <LeadAvatar label={null} emptyLabel={labels.unassigned} />
                <span className="flex-1 truncate">{labels.unassigned}</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{labels.moveTo}</DropdownMenuLabel>
            {stages
              .filter((s) => s.key !== card.stageKey)
              .map((s) => (
                <DropdownMenuItem key={s.key} onClick={() => onMove(card.waId, s.key)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
