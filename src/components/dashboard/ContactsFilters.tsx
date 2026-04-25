"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const DEBOUNCE_MS = 300;

export function ContactsFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQ = sp.get("q") ?? "";
  const urlFrom = sp.get("from") ?? "";
  const urlTo = sp.get("to") ?? "";

  const [search, setSearch] = useState(urlQ);
  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);

  // Sync local state when the URL changes from outside (e.g. browser back).
  const [prevUrl, setPrevUrl] = useState({ q: urlQ, from: urlFrom, to: urlTo });
  if (
    prevUrl.q !== urlQ ||
    prevUrl.from !== urlFrom ||
    prevUrl.to !== urlTo
  ) {
    setPrevUrl({ q: urlQ, from: urlFrom, to: urlTo });
    setSearch(urlQ);
    setFrom(urlFrom);
    setTo(urlTo);
  }

  // Debounced URL sync. Filters live in the URL so state survives reload + share.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      if (from) params.set("from", from);
      else params.delete("from");
      if (to) params.set("to", to);
      else params.delete("to");
      params.delete("page"); // reset pagination when filters change
      const next = params.toString();
      const current = sp.toString();
      if (next !== current) {
        startTransition(() => {
          router.replace(`/conversations${next ? `?${next}` : ""}`);
        });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, from, to]);

  const clearable = search || from || to;

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="contact-search" className="text-xs text-[#6b7280]">
          Buscar por nombre o teléfono
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af]" />
          <Input
            id="contact-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: Juan o 5491155…"
            className="pl-8"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-from" className="text-xs text-[#6b7280]">Desde</Label>
        <Input id="contact-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-to" className="text-xs text-[#6b7280]">Hasta</Label>
        <Input id="contact-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div>
        {clearable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
            }}
            disabled={pending}
            className="w-full"
          >
            <X className="size-4 mr-1" /> Limpiar
          </Button>
        ) : (
          <span className="block text-xs text-[#9ca3af] text-center">
            {pending ? "Buscando…" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
