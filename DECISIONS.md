# Decisiones técnicas

Cada línea: decisión — motivo. Los valores marcados **[SUPUESTO]** son datos de ejemplo editables desde la interfaz, pendientes de validar por la empresa.

## Stack
- TypeScript 6.0 en lugar de 7.0 — TS 7 (nativo) aún no expone la API de compilador que usan Next.js, typescript-eslint y Drizzle Kit.
- TanStack Table 8.21 en lugar de 9 — API estable y conocida; la 9 cambia la API de columnas.
- ESLint 9 (config plana) — eslint-config-next 16 todavía declara ESLint 9.
- Parser de fórmulas propio (Pratt, árbol + intérprete) — prohibido `eval`; acepta palabras clave en español (`y`, `o`, `no`, `si()`, `techo()`).
- Ruta de búsqueda de propiedades con `hasOwnProperty` en el parser — evita que `__proto__` o `toString` se interpreten como operadores o variables.
- Intervalos de reserva semiabiertos `[inicio, fin + margen)` — un retorno a las 10:00 libera el stock a las 10:00 (o a las 10:00 + margen configurable).
- La disponibilidad se calcula sobre el instante peor del rango (barrido de eventos) — es el "pico de ocupación", no la suma.
- Opciones caducadas dejan de reservar en el cálculo aunque el trabajo de caducidad aún no haya cambiado su estado — la consulta es correcta incluso si la cola va con retraso.
- Las piezas 3D tienen un `role` y el artículo también — el visor solo dibuja piezas cubiertas por unidades del despiece con ese rol (`coverPartsWithBom`); así nunca se dibuja algo que no esté en el despiece.
- La jaima se modela como familia de cubierta `jaima` de un solo módulo — reutiliza configurador, reglas, disponibilidad y composición.
- Redondeo del despiece: unidades hacia arriba; m²/m con 2 decimales y por regla — evita medias piezas.
- El catálogo del primer cliente vive en `packages/core/src/fixtures/asturias.ts` — lo comparten tests y seed, así los criterios de aceptación se prueban con los datos reales.

## Datos de ejemplo [SUPUESTO]
- Cantidades por pórtico (correas, pesos, estacas, tensores) de cada familia — dependen del fabricante; editables en Carpas › Asistente de fabricante.
- Alturas de alero y cumbrera, pesos y volúmenes de los artículos.
- Stock de laterales, lonas de techo, picos, frontales, pilares, placas, correas, sillas, mesas y moqueta (el cliente solo facilitó cerchas, jaimas, suelos, tarima y escenario).
- "Escenario 110" se interpreta como 110 módulos de 2x1 m.
- "Suelo 850" = 850 m² de suelo modular; "suelo fenólico 600" = 600 m².
- Aforo orientativo: cóctel 0,8 m²/persona, banquete 1,4 m²/persona, teatro 0,9 m²/persona.
- Ratios de mano de obra (minutos-persona por pórtico, lona, lateral, frente, m² de suelo y peso) y factor de desmontaje 0,6.
- Tarifas: €/m² por familia, suplementos por lona transparente, ventana, puerta y pesos; transporte 1,60 €/km ida y vuelta con mínimo de 90 €; mano de obra 30 €/h (coste 19 €/h).
- Escalado por duración (1 d ×1; 2 d ×1,5; 3 d ×1,8; 7 d ×2,6; +0,2 por día extra) y carpas con 3 días incluidos y +8 % por día adicional.
- Descanso mínimo entre jornadas 12 h y límite semanal 40 h (Estatuto de los Trabajadores) — configurable por trabajador.
- Todas las carpas del catálogo se dibujan a dos aguas (petición del cliente) — la cubierta poligonal sigue soportada por el motor y el visor como opción de familia, y el test de aceptación 15x30 la cubre con una variante poligonal.
- Familia 20 m alta con 20 módulos máximos (20x100) — necesario para el criterio de rendimiento; el stock real de C20A (20) limita a 20x95 y el configurador lo marca en rojo.
- Solo los subalquileres confirmados o recibidos suman stock entrante — uno solicitado aún no está garantizado.
- pg 8 encola las consultas lanzadas en paralelo dentro de una misma transacción (aviso de deprecación) — se mantiene pg 8.x fijado; al migrar a pg 9 hay que serializar los Promise.all dentro de withTenant.
