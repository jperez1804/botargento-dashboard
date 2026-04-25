import Image from "next/image";
import Link from "next/link";
import { tenantConfig } from "@/config/tenant";

export function TenantBadge() {
  const { name, logoUrl } = tenantConfig();
  return (
    <Link href="/" className="flex items-center gap-3 min-w-0">
      <div className="size-8 shrink-0 rounded-md overflow-hidden bg-white ring-1 ring-black/5 flex items-center justify-center">
        <Image
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="size-full object-contain"
          unoptimized
        />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{name}</div>
        <div className="text-[11px] leading-tight text-[#6b7280]">Panel de reportes</div>
      </div>
    </Link>
  );
}
