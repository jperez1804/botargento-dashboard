"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "new", label: "Nuevo" },
  { value: "approved", label: "Aprobado" },
  { value: "rejected", label: "Rechazado" },
];

type Props = {
  categories: ReadonlyArray<string>;
};

export function ProvidersFilters({ categories }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQ = sp.get("q") ?? "";
  const urlCategory = sp.get("category") ?? "";
  const urlZone = sp.get("zone") ?? "";
  const urlStatus = sp.get("status") ?? "";

  const [search, setSearch] = useState(urlQ);
  const [category, setCategory] = useState(urlCategory);
  const [zone, setZone] = useState(urlZone);
  const [status, setStatus] = useState(urlStatus);

  // Sync from URL on back/forward navigation
  const [prev, setPrev] = useState({
    q: urlQ, category: urlCategory, zone: urlZone, status: urlStatus,
  });
  if (
    prev.q !== urlQ ||
    prev.category !== urlCategory ||
    prev.zone !== urlZone ||
    prev.status !== urlStatus
  ) {
    setPrev({ q: urlQ, category: urlCategory, zone: urlZone, status: urlStatus });
    setSearch(urlQ);
    setCategory(urlCategory);
    setZone(urlZone);
    setStatus(urlStatus);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      if (category) params.set("category", category);
      else params.delete("category");
      if (zone) params.set("zone", zone);
      else params.delete("zone");
      if (status) params.set("status", status);
      else params.delete("status");
      params.delete("page");
      const next = params.toString();
      const current = sp.toString();
      if (next !== current) {
        startTransition(() => {
          router.replace(`/providers${next ? `?${next}` : ""}`);
        });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, zone, status]);

  const clearable = search || category || zone || status;

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="prov-search" className="text-xs text-[#6b7280]">
          Buscar por empresa, contacto o email
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af]" />
          <Input
            id="prov-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: Albanileria SRL"
            className="pl-8"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prov-category" className="text-xs text-[#6b7280]">
          Rubro
        </Label>
        <select
          id="prov-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          <option value="">Todos</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prov-zone" className="text-xs text-[#6b7280]">Zona</Label>
        <Input
          id="prov-zone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          placeholder="Ej: Tigre"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prov-status" className="text-xs text-[#6b7280]">Estado</Label>
        <select
          id="prov-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        {clearable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setCategory("");
              setZone("");
              setStatus("");
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
