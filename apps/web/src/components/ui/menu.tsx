"use client";
import { DropdownMenu as M, Popover as P, Tooltip as T, Tabs as Tb, Switch as Sw, Checkbox as Cb } from "radix-ui";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn("z-50 min-w-48 rounded-lg border bg-popover p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0", className)} {...props} />
    </M.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return <M.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground", className)} {...props} />;
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />;
}
export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export function PopoverContent({ className, align = "start", ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={6} className={cn("z-50 rounded-lg border bg-popover p-3 shadow-lg", className)} {...props} />
    </P.Portal>
  );
}

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Provider delayDuration={300}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 rounded-md bg-ink px-2 py-1 text-xs text-white shadow">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}

export const Tabs = Tb.Root;
export const TabsContent = Tb.Content;
export function TabsList({ className, ...props }: React.ComponentProps<typeof Tb.List>) {
  return <Tb.List className={cn("inline-flex items-center gap-1 border-b w-full", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof Tb.Trigger>) {
  return (
    <Tb.Trigger
      className={cn("-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:font-medium data-[state=active]:text-foreground cursor-pointer", className)}
      {...props}
    />
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-border-strong transition-colors data-[state=checked]:bg-primary", className)} {...props}>
      <Sw.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </Sw.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof Cb.Root>) {
  return (
    <Cb.Root className={cn("flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white", className)} {...props}>
      <Cb.Indicator>
        <Check className="size-3" strokeWidth={3} />
      </Cb.Indicator>
    </Cb.Root>
  );
}
