import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:     "bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30",
        destructive: "bg-rose-500 text-white shadow-md shadow-rose-500/25 hover:bg-rose-600",
        outline:     "border-2 border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
        secondary:   "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ghost:       "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link:        "text-blue-600 underline-offset-4 hover:underline",
        success:     "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600",
        warning:     "bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600",
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
