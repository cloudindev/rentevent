import Link from "next/link";
import { Fragment } from "react";

/** Minimal, safe markdown: **bold**, _italic_, [links](/relative), "- " bullets and paragraphs. */
function inline(text: string, keyBase: string) {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|_(.+?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-${i++}`}>{m[1]}</strong>);
    else if (m[2] && m[3]) {
      const href = m[3];
      out.push(
        href.startsWith("/") ? (
          <Link key={`${keyBase}-${i++}`} href={href} className="text-link underline-offset-2 hover:underline">
            {m[2]}
          </Link>
        ) : (
          <span key={`${keyBase}-${i++}`}>{m[2]}</span>
        ),
      );
    } else if (m[4]) out.push(<em key={`${keyBase}-${i++}`} className="text-muted-foreground">{m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={bi} className="list-disc space-y-0.5 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-•]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
