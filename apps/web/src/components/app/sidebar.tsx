"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Check, ChevronsUpDown, LogOut, Monitor, Moon, PanelLeftClose, PanelLeft, Plus, Search, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { can } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";
import { Kbd } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from "@/components/ui/menu";
import { NAV, SETTINGS_ITEM } from "./nav";
import { switchWorkspace } from "@/server/actions/workspace";
import { useCommandPalette } from "./command-palette";

export type ShellUser = { name: string; email: string; image: string | null };
export type ShellTenant = { tenantId: string; slug: string; name: string; logo: string | null; role: string };

function TenantLogo({ name, logo, size = 26 }: { name: string; logo: string | null; size?: number }) {
  if (logo) return <img src={logo} alt="" width={size} height={size} className="rounded-md object-contain" style={{ width: size, height: size }} />;
  return (
    <span className="flex items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-white dark:bg-white dark:text-ink" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}

export function Sidebar({ user, tenant, memberships }: { user: ShellUser; tenant: ShellTenant; memberships: ShellTenant[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const palette = useCommandPalette();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a per-viewer preference
      setCollapsed(localStorage.getItem("rv.sidebar") === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("rv.sidebar", c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const item = (it: (typeof NAV)[number]["items"][number]) => {
    const active = isActive(it.href);
    const link = (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-foreground/75 transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-accent font-medium text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <it.icon className="size-[17px] shrink-0" strokeWidth={1.6} />
        {!collapsed && <span className="truncate">{it.label}</span>}
      </Link>
    );
    return collapsed ? (
      <Tooltip key={it.href} content={it.label} side="right">
        {link}
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r bg-background transition-[width] duration-200 md:flex",
        collapsed ? "w-[64px]" : "w-[var(--sidebar-width)]",
      )}
      aria-label="Navegación principal"
    >
      <div className={cn("flex items-center gap-1 p-3 pb-2", collapsed && "flex-col")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-accent", collapsed && "justify-center")} aria-label="Cambiar de empresa">
              <TenantLogo name={tenant.name} logo={tenant.logo} />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{tenant.name}</span>
                  <ChevronsUpDown className="size-4 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Espacios de trabajo</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.tenantId}
                onSelect={async () => {
                  await switchWorkspace({ tenantId: m.tenantId });
                  router.push("/app/inicio");
                  router.refresh();
                }}
              >
                <TenantLogo name={m.name} logo={m.logo} size={20} />
                <span className="flex-1 truncate">{m.name}</span>
                {m.tenantId === tenant.tenantId && <Check />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/registro/empresa")}>
              <Plus /> Crear otra empresa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => palette.setOpen(true)}
          className={cn("flex h-8 w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground hover:bg-subtle", collapsed && "justify-center px-0")}
          aria-label="Acciones rápidas"
        >
          <Search className="size-4" strokeWidth={1.75} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Acciones rápidas</span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => can(tenant.role, i.permission));
          if (items.length === 0) return null;
          return (
            <div key={gi} className={cn("py-1.5", gi > 0 && "border-t")}>
              {group.label && !collapsed && <p className="px-2.5 pb-1 pt-1.5 text-xs text-muted-foreground">{group.label}</p>}
              <div className="grid gap-0.5">{items.map(item)}</div>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="grid gap-0.5">{item(SETTINGS_ITEM)}</div>
        <div className={cn("mt-1 flex items-center gap-1", collapsed && "flex-col")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-accent", collapsed && "justify-center")} aria-label="Menú de usuario">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                  {user.image ? <img src={user.image} alt="" className="size-7 rounded-full" /> : initials(user.name)}
                </span>
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
              <DropdownMenuItem onSelect={() => router.push("/app/perfil")}>
                <User /> Perfil y seguridad
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/espacios")}>
                <Building2 /> Espacios de trabajo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tema</DropdownMenuLabel>
              {(
                [
                  ["light", "Claro", Sun],
                  ["dark", "Oscuro", Moon],
                  ["system", "Sistema", Monitor],
                ] as const
              ).map(([v, l, I]) => (
                <DropdownMenuItem key={v} onSelect={() => setTheme(v)}>
                  <I /> <span className="flex-1">{l}</span> {theme === v && <Check />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await authClient.signOut();
                  router.push("/acceso");
                  router.refresh();
                }}
              >
                <LogOut /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={toggle} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}>
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

export { TenantLogo };
