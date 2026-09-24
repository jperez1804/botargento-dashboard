import { ListSkeleton } from "@/components/dashboard/skeletons";

// Same footprint as the loaded modal so the content doesn't jump in.
export default function LeadModalLoading() {
  return (
    <div className="grid min-h-[480px] gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
      <ListSkeleton rows={6} />
      <ListSkeleton rows={4} />
    </div>
  );
}
