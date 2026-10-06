import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:     "bg-[linear-gradient(135deg,#2563EB,#6D5BF5)] text-white shadow-md shadow-indigo-500/25 ring-1 ring-inset ring-white/15 hover:shadow-lg hover:shadow-indigo-500/35 hover:brightness-110 hover:-translate-y-px",
        destructive: "bg-rose-500 text-white shadow-sm shadow-rose-500/20 hover:bg-rose-600",
        outline:     "border border-slate-200/90 bg-white/80 backdrop-blur text-slate-700 shadow-sm shadow-slate-900/[0.03] hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700",
        secondary:   "bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.09]",
        ghost:       "text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900",
        link:        "text-indigo-600 underline-offset-4 hover:underline",
        success:     "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600",
        warning:     "bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-7 rounded-lg px-3 text-xs",
        lg:      "h-11 rounded-xl px-6 text-base",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
