"use client";

import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes } from "react";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending: boolean;
}

export function SubmitButton({ pending, children, className = "", ...rest }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-card bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...rest}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
