import type { WatchStatus } from "@/app/generated/prisma";

const config: Record<WatchStatus, { label: string; className: string }> = {
  WATCHING:      { label: "Watching",       className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  COMPLETED:     { label: "Completed",      className: "bg-green-500/20 text-green-300 border-green-500/30" },
  DROPPED:       { label: "Dropped",        className: "bg-red-500/20 text-red-300 border-red-500/30" },
  PLAN_TO_WATCH: { label: "Plan to Watch",  className: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  NOT_INTERESTED:  { label: "Not Interested", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function StatusBadge({ status }: { status: WatchStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

export { config as STATUS_CONFIG };
