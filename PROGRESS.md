# Progreso

Al retomar: leer este archivo y continuar por el primer punto sin marcar.
Servidor local: `pnpm dev` (puerto 3210 en este equipo; el 3000 está ocupado). Demo: demo@rentevent.es / Rentevent2026!

## Fase 1 · Base
- [x] Monorepo pnpm, TypeScript estricto, ESLint
- [x] Núcleo `@rentevent/core` (fórmulas, despiece, geometría, disponibilidad, alternativas, tarifas, personal, zona horaria) con tests ≥ 90 %
- [x] `@rentevent/db`: esquema Drizzle (67 tablas), RLS con rol `rentevent_app`, migraciones, seed del primer cliente
- [x] Test de aislamiento entre tenants
- [x] Sistema de diseño (tokens, shadcn), marco con barra lateral, paleta Cmd+K, móvil
- [x] Auth: registro + empresa + subdominio, acceso, empresa con logo, 2FA, bloqueo por intentos, recuperación, invitaciones, selector de espacios
- [x] Contactos (lista, ficha, direcciones geocodificadas, personas, notas, historial)
- [x] Inventario (tabla con vistas guardadas y edición en línea, ficha con línea de tiempo, QR, kits, recuento)

## Fase 2 · Carpas y stock
- [x] Familias, editor de reglas con vista previa, asistente de fabricante, plantillas
- [x] Servicio de reservas con bloqueo por artículo + tests de concurrencia y bordes
- [x] Mapa de calor de cerchas y consulta inversa

## Fase 3 · 3D
- [x] Visor procedural, edición por tramo, plano 2D, PNG/glTF, enlace público

## Fase 4 · Pedidos y proyectos
- [x] Pantalla de pedido (disponibilidad en vivo, línea de tiempo, configurador, alternativas, estados, presupuestos versionados)
- [x] PDF del presupuesto + página pública con aceptación y firma
- [x] Proyectos (fases, pedidos, turnos, tareas, archivos, rentabilidad, duplicar)
- [x] Agenda (día/semana/mes)
- [x] Subalquileres

## Fase 5 · Recursos
- [x] Personal, tablero, conflictos, fichaje, PWA del trabajador, transporte, espacios

## Fase 6 · Almacén y mantenimiento
- [x] Listas de carga, escaneo, retornos con daños, albaranes con firma, certificado
- [x] Mantenimiento (reparaciones, revisiones, limpieza)

## Fase 7 · Finanzas
- [x] Ventas, compras, tesorería, dashboard, PDF y Verifactu preparado
- [x] Seed: huellas Verifactu reales con `verifactuHash`

## Fase 8 · IA y otros
- [x] Asistente (adaptador + simulado), workflows, analytics, emails, comunicación

## Fase 9 · SaaS
- [x] Onboarding, importadores CSV/Excel (Rentman), Stripe, API pública + webhooks, configuración, RGPD

## Fase 10 · Web pública
- [x] Portada con demo animada, producto, soluciones, precios, clientes, blog MDX, contacto, legales, cookies

## Fase 11 · Cierre
- [x] Inicio (panel del día)
- [x] E2E Playwright (6/6), build de producción, lint sin errores, README
- [x] Supabase (UE): migraciones, RLS y seed demo aplicados; aislamiento verificado a través del pooler de transacciones
- [ ] Vercel: Root Directory `apps/web` y variables de entorno (lo configura el cliente en el panel de Vercel)
