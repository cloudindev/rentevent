/** A tenant brand colour (#RRGGBB) with a readable text colour on top of it, or null if it isn't valid. */
export function brandAccent(hex: string | null | undefined): { bg: string; fg: string } | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  // WCAG contrast against white vs. near-black (#111): pick whichever is higher
  const onWhite = 1.05 / (luminance + 0.05);
  const onDark = (luminance + 0.05) / 0.0556;
  return { bg: hex, fg: onWhite >= onDark ? "#ffffff" : "#111111" };
}
