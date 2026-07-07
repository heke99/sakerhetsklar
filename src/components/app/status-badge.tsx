import { cn } from "@/lib/utils";

/**
 * Platform-wide status color scheme (spec §9):
 * green = stable, yellow = missing required data, red = critical gap / missed
 * deadline, gray = not onboarded, blue = waiting for customer action,
 * purple = manual review needed.
 */
export type StatusColor = "green" | "yellow" | "red" | "gray" | "blue" | "purple";

const colorClasses: Record<StatusColor, string> = {
  green:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  yellow: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  purple:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

export function StatusBadge({
  color,
  children,
  className,
}: {
  color: StatusColor;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClasses[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
