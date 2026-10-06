import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-indigo-600 text-white",
        secondary:   "bg-slate-900/[0.05] text-slate-700 ring-1 ring-inset ring-slate-900/[0.04]",
        destructive: "bg-rose-500/10 text-rose-700 ring-1 ring-inset ring-rose-500/15",
        outline:     "border border-slate-200 text-slate-600 bg-white",
        success:     "bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/15",
        warning:     "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/20",
        blue:        "bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/15",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
