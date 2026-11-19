import Link from "next/link";
import { cn } from "@/lib/utils";

/** Official logotype (never redrawn): black on light, white on dark. */
export function Logo({ className, href = "/", height = 24 }: { className?: string; href?: string | null; height?: number }) {
  const width = Math.round(height * (1586 / 281));
  const img = (
    <>
      <img src="/brand/rentevent-logo.png" alt="Rentevent" width={width} height={height} style={{ height, width: "auto" }} className="dark:hidden" />
      <img src="/brand/rentevent-logo-white.png" alt="Rentevent" width={width} height={height} style={{ height, width: "auto" }} className="hidden dark:block" />
    </>
  );
  return href ? (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label="Rentevent, inicio">
      {img}
    </Link>
  ) : (
    <span className={cn("inline-flex items-center", className)}>{img}</span>
  );
}

export function LogoWhite({ height = 24 }: { height?: number }) {
  return <img src="/brand/rentevent-logo-white.png" alt="Rentevent" height={height} style={{ height, width: "auto" }} />;
}

export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <>
      <img src="/brand/rentevent-mark.png" alt="" width={size} height={size} style={{ height: size, width: "auto" }} className={cn("dark:hidden", className)} />
      <img src="/brand/rentevent-mark-white.png" alt="" width={size} height={size} style={{ height: size, width: "auto" }} className={cn("hidden dark:block", className)} />
    </>
  );
}
