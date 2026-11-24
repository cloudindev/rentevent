import { HELP_GROUPS } from "@/content/help";
import { HelpNav, type HelpNavGroup } from "@/components/help/nav";
import { Container } from "@/components/marketing/sections";

const NAV: HelpNavGroup[] = HELP_GROUPS.map((g) => ({
  title: g.title,
  areas: g.areas.map((a) => ({ slug: a.slug, title: a.title, articles: a.articles.map((x) => ({ slug: x.slug, title: x.title })) })),
}));

export default function HelpAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="grid gap-8 py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12 lg:py-12">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pb-8 lg:pr-2">
        <HelpNav groups={NAV} />
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}
