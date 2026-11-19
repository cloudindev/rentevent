/// <reference types="mdx" />
import type { ComponentType } from "react";

export type Post = { slug: string; title: string; description: string; date: string; minutes: number; category: string; author: string };

export const POSTS: Post[] = [
  { slug: "cuantas-cerchas-necesita-una-carpa", title: "¿Cuántas cerchas necesita una carpa?", description: "La regla de los pórticos, el material que cuelga de cada uno y por qué las cerchas compartidas provocan dobles reservas.", date: "2026-11-04", minutes: 4, category: "Operaciones", author: "Equipo Rentevent" },
  { slug: "presupuestar-una-boda-en-carpa", title: "Cómo presupuestar una boda en carpa", description: "Superficie por invitado, laterales transparentes y por qué enseñar la carpa en 3D acelera la firma.", date: "2026-10-21", minutes: 5, category: "Ventas", author: "Equipo Rentevent" },
  { slug: "registro-horario-montadores", title: "Registro horario para equipos de montaje", description: "Qué hay que registrar, cómo fichar en obra y cómo evitar saltarse el descanso mínimo en temporada alta.", date: "2026-10-07", minutes: 4, category: "Personal", author: "Equipo Rentevent" },
];

export const POST_LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  "cuantas-cerchas-necesita-una-carpa": () => import("./blog/cuantas-cerchas-necesita-una-carpa.mdx"),
  "presupuestar-una-boda-en-carpa": () => import("./blog/presupuestar-una-boda-en-carpa.mdx"),
  "registro-horario-montadores": () => import("./blog/registro-horario-montadores.mdx"),
};
