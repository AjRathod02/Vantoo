import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  reviews,
  className,
}: {
  value: number;
  reviews?: number;
  className?: string;
}) {
  if (value <= 0) {
    return (
      <span className={cn("text-xs font-medium text-ink-soft", className)}>
        New
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-ink",
        className
      )}
    >
      <Star className="h-3.5 w-3.5 fill-brand-accent text-brand-accent" />
      {value.toFixed(1)}
      {reviews !== undefined && (
        <span className="text-ink-soft">({reviews})</span>
      )}
    </span>
  );
}
