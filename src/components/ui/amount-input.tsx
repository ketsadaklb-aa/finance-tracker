"use client";
import { forwardRef } from "react";
import { Input } from "./input";

interface AmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (raw: string) => void;
}

function formatDisplay(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const formatted = parseInt(intPart || "0", 10).toLocaleString("en-US");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const stripped = e.target.value.replace(/,/g, "");
      if (stripped === "" || /^\d*\.?\d*$/.test(stripped)) {
        onChange(stripped);
      }
    }

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={formatDisplay(value)}
        onChange={handleChange}
      />
    );
  }
);
AmountInput.displayName = "AmountInput";
