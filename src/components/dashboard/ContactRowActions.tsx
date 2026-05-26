import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";

type Context = "provider" | "labor";

type Props = {
  contactWaId: string;
  displayName: string;
  brandName: string;
  context: Context;
};

const GREETING_SUFFIX: Record<Context, string> = {
  provider: "por tu alta como proveedor",
  labor: "por tu registro en mano de obra",
};

function buildGreeting(displayName: string, brandName: string, context: Context): string {
  const firstName = displayName.trim().split(/\s+/)[0] ?? "";
  const intro = firstName ? `Hola ${firstName}, ` : "Hola, ";
  return `${intro}te escribo desde ${brandName} ${GREETING_SUFFIX[context]}.`;
}

export function ContactRowActions({
  contactWaId,
  displayName,
  brandName,
  context,
}: Props) {
  const digits = contactWaId.replace(/\D/g, "");
  if (!digits) return null;

  const text = buildGreeting(displayName, brandName, context);
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  const conversationHref = `/conversations/${encodeURIComponent(digits)}`;

  return (
    <div className="flex items-center gap-1 justify-end">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir WhatsApp"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-600 hover:bg-[var(--canvas)]"
      >
        <WhatsAppIcon className="size-4" />
        <span className="sr-only">Abrir WhatsApp</span>
      </a>
      <Link
        href={conversationHref}
        title="Ver conversación"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--canvas)]"
      >
        <MessageSquare className="size-4" />
        <span className="sr-only">Ver conversación</span>
      </Link>
    </div>
  );
}
