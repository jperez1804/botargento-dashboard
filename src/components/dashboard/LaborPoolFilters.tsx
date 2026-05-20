"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const DEBOUNCE_MS = 300;

const MODE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "seeking", label: "Busca trabajo" },
  { value: "offering", label: "Ofrece servicios" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "archived", label: "Archivado" },
];

type Props = {
  specialties: ReadonlyArray<string>;
};

export function LaborPoolFilters({ specialties }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQ = sp.get("q") ?? "";
  const urlSpec = sp.get("specialty") ?? "";
  const urlZone = sp.get("zone") ?? "";
  const urlMode = sp.get("mode") ?? "";
  const urlStatus = sp.get("status") ?? "";

  const [search, setSearch] = useState(urlQ);
  const [specialty, setSpecialty] = useState(urlSpec);
  const [zone, setZone] = useState(urlZone);
  const [mode, setMode] = useState(urlMode);
  const [status, setStatus] = useState(urlStatus);

  const [prev, setPrev] = useState({
    q: urlQ, specialty: urlSpec, zone: urlZone, mode: urlMode, status: urlStatus,
  });
  if (
    prev.q !== urlQ ||
    prev.specialty !== urlSpec ||
    prev.zone !== urlZone ||
    prev.mode !== urlMode ||
    prev.status !== urlStatus
  ) {
    setPrev({ q: urlQ, specialty: urlSpec, zone: urlZone, mode: urlMode, status: urlStatus });
    setSearch(urlQ);
    setSpecialty(urlSpec);
    setZone(urlZone);
    setMode(urlMode);
    setStatus(urlStatus);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      if (specialty) params.set("specialty", specialty);
      else params.delete("specialty");
      if (zone) params.set("zone", zone);
      else params.delete("zone");
      if (mode) params.set("mode", mode);
      else params.delete("mode");
      if (status) params.set("status", status);
      else params.delete("status");
      params.delete("page");
      const next = params.toString();
      const current = sp.toString();
      if (next !== current) {
        startTransition(() => {
          router.replace(`/labor-pool${next ? `?${next}` : ""}`);
        });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, specialty, zone, mode, status]);

  const clearable = search || specialty || zone || mode || status;

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto] md:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="lp-search" className="text-xs text-[#6b7280]">
          Buscar por nombre
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af]" />
          <Input
            id="lp-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: Juan"
            className="pl-8"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lp-specialty" className="text-xs text-[#6b7280]">
          Especialidad
        </Label>
        <select
          id="lp-specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          <option value="">Todas</option>
          {specialties.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lp-zone" className="text-xs text-[#6b7280]">Zona</Label>
        <Input
          id="lp-zone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          placeholder="Ej: Lanus"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lp-mode" className="text-xs text-[#6b7280]">Modalidad</Label>
        <select
          id="lp-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
        >
          {MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lp-status" className="text-xs text-[#6b7280]">Estado</Label>
        <select
          id="lp-status"
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
              setSpecialty("");
              setZone("");
              setMode("");
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
