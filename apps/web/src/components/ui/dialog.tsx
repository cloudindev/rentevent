"use client";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, size = "md", ...props }: React.ComponentProps<typeof D.Content> & { size?: "sm" | "md" | "lg" | "xl" }) {
  const w = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border bg-popover p-5 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          w,
          className,
        )}
        {...props}
      >
        {children}
        <D.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Cerrar">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1 pr-6", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof D.Title>) {
  return <D.Title className={cn("text-base font-semibold", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof D.Description>) {
  return <D.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export function Sheet({ open, onOpenChange, children, title, description, side = "right", className }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; title: string; description?: string; side?: "right" | "left"; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/25" />
        <D.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-full max-w-md flex-col border-l bg-popover shadow-xl data-[state=open]:animate-in",
            side === "right" ? "right-0 data-[state=open]:slide-in-from-right" : "left-0 border-r data-[state=open]:slide-in-from-left",
            className,
          )}
        >
          <div className="flex items-start justify-between border-b px-5 py-4">
            <div>
              <D.Title className="text-base font-semibold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Cerrar">
              <X className="size-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
