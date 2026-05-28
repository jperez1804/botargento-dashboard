import Image from "next/image";
import Link from "next/link";
import { tenantConfig } from "@/config/tenant";

export function TenantBadge() {
  const { name, logoUrl } = tenantConfig();
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 min-w-0 rounded-md px-1 -mx-1 hover:bg-[var(--canvas-2)] transition-colors focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2"
      aria-label={`${name} — ir a inicio`}
    >
      <div className="size-7 shrink-0 rounded-md overflow-hidden bg-white ring-1 ring-[var(--rule)] flex items-center justify-center">
        <Image
          src={logoUrl}
          alt=""
          width={28}
          height={28}
          className="size-full object-contain"
          unoptimized
        />
      </div>
      <div className="min-w-0 leading-tight">
        {/* Tenant name only — the "Panel de reportes" subtitle was redundant
         * with the page H1 and added visual weight. Brand identity belongs
         * on this line; product context belongs in the page header. */}
        <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--ink)] truncate">
          {name}
        </div>
      </div>
    </Link>
  );
}
