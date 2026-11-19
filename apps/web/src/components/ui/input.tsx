import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/80 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(field, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(field, "min-h-20 py-2", className)} {...props} />;
}

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select data-slot="select" className={cn(field, "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b6b68%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-[13px] font-medium text-foreground", className)} {...props} />;
}

export function Field({ label, hint, error, children, className, htmlFor }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
