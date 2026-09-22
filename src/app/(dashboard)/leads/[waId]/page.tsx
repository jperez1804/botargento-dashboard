import { redirect } from "next/navigation";

// /leads/[waId] is only ever a modal over the board (intercepted from an
// in-app navigation). A hard load, a new tab or a shared link lands here
// instead, and the full conversation page is the right place for it.
export default async function LeadFullPage({ params }: { params: Promise<{ waId: string }> }) {
  const { waId } = await params;
  redirect(`/conversations/${encodeURIComponent(waId)}`);
}
