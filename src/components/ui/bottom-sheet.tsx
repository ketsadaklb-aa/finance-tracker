"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const BottomSheet = DialogPrimitive.Root;
const BottomSheetTrigger = DialogPrimitive.Trigger;
const BottomSheetPortal = DialogPrimitive.Portal;
const BottomSheetClose = DialogPrimitive.Close;

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("sheet-overlay fixed inset-0 z-50 bg-black/50", className)}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

/**
 * Mobile-first bottom sheet: slides up from the bottom on small screens,
 * becomes a centered modal on `sm+`. Drag handle at top, scroll-locked body.
 * Animations defined in globals.css (.sheet-mobile, .sheet-overlay).
 */
const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Hide drag handle (e.g. for confirmation dialogs) */
    hideHandle?: boolean;
  }
>(({ className, children, hideHandle, ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "sheet-mobile",
        // Mobile: full-width sheet anchored bottom, rounded-top corners
        "fixed left-0 right-0 bottom-0 z-50 bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl max-h-[92dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]",
        // Tablet+: centered modal with original transform
        "sm:left-[50%] sm:right-auto sm:bottom-auto sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-200 sm:max-h-[88dvh]",
        className
      )}
      {...props}
    >
      {!hideHandle && (
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        </div>
      )}
      <div className="px-5 pt-3 pb-5 sm:p-6">{children}</div>
    </DialogPrimitive.Content>
  </BottomSheetPortal>
));
BottomSheetContent.displayName = "BottomSheetContent";

const BottomSheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1 mb-4", className)} {...props} />
);
BottomSheetHeader.displayName = "BottomSheetHeader";

const BottomSheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 mt-5 sm:flex-row sm:justify-end sm:gap-2 sm:mt-6",
      className
    )}
    {...props}
  />
);
BottomSheetFooter.displayName = "BottomSheetFooter";

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-slate-500", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetTitle,
  BottomSheetDescription,
};
