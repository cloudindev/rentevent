import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { POST_LOADERS, POSTS } from "@/content/posts";
import { formatDate } from "@/lib/utils";
import { Container, FinalCta } from "@/components/marketing/sections";

export const dynamicParams = false;
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) return {};
  return { title: p.title, description: p.description, alternates: { canonical: `/recursos/blog/${p.slug}` }, openGraph: { type: "article", title: p.title, description: p.description, publishedTime: p.date } };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  const load = POST_LOADERS[slug];
  if (!post || !load) notFound();
  const { default: Body } = await load();
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.description, datePublished: post.date, author: { "@type": "Organization", name: "Rentevent" } };
  return (
    <>
      <article className="py-14 sm:py-20">
        <Container className="max-w-3xl">
          <Link href="/recursos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Recursos
          </Link>
          <p className="mt-8 text-sm text-muted-foreground">
            {post.category} · <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.minutes} min de lectura
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-5 text-xl text-muted-foreground">{post.description}</p>
          <div className="mt-10 text-[17px] leading-relaxed text-foreground/90 [&_blockquote]:my-6 [&_blockquote_p]:my-0 [&_blockquote]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-brand-500 [&_blockquote]:bg-subtle [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:font-mono [&_blockquote]:text-base [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:my-1.5 [&_p]:my-5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6">
            <Body />
          </div>
          <p className="mt-12 border-t pt-6 text-sm text-muted-foreground">{post.author}</p>
        </Container>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </article>
      <FinalCta />
    </>
  );
}
