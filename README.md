# Rentevent

SaaS multiempresa para compañías de alquiler y montaje de carpas y estructuras para eventos.

- **Configurador paramétrico de carpas** con despiece automático (reglas editables, intérprete de fórmulas propio, sin `eval`).
- **Disponibilidad en vivo** mientras se presupuesta: pico de ocupación por artículo físico, opciones con caducidad, subalquileres, confirmación con bloqueo por artículo.
- **Visor 3D y plano 2D** generados desde la misma configuración que el despiece y el precio.
- ERP: pedidos, proyectos, contactos, inventario, almacén, mantenimiento, personal y fichaje (PWA), transporte, finanzas (Verifactu preparado), IA, workflows y API pública.

## Estructura

```
apps/web            Next.js 16 (App Router, RSC, Server Actions): web pública, app, PWA /m, API /api/v1
packages/core       TypeScript puro: fórmulas, TentConfiguration, despiece, geometría, disponibilidad, tarifas, personal
packages/db         Drizzle ORM: esquema, migraciones, RLS, servicios de reservas, seed
```

## Arranque en local

Requisitos: Node 22+, pnpm 9, PostgreSQL 15+ (Redis opcional).

```bash
pnpm install
cp .env.example apps/web/.env.local     # funciona sin ninguna clave
pnpm db:setup                           # crea las bases rentevent y rentevent_test
pnpm db:migrate                         # migraciones + roles y políticas RLS
pnpm db:seed                            # empresa demo «Carpas del Norte»
pnpm dev                                # http://localhost:3000
```

Acceso demo: **demo@rentevent.es / Rentevent2026!** (otros roles: comercial@, almacen@, jefe@, montador@, lectura@ con la misma contraseña).
Con `SMTP_URL` vacío, los correos (verificación, invitaciones, presupuestos) se ven en `/dev/correo`.

Para desarrollo con subdominios por empresa usa `ROOT_DOMAIN=localhost:3000` y abre `http://carpasdelnorte.localhost:3000`.

### Tests

```bash
pnpm test                               # núcleo (cobertura ≥ 90 %), base de datos (RLS, concurrencia) y web
pnpm --filter @rentevent/web test:e2e   # Playwright contra el servidor en marcha (E2E_BASE_URL)
```

Los criterios de aceptación están cubiertos en:
- `packages/core/src/tent/tent.test.ts` — 15x30 con pesos, frentes, laterales y tramo sin techo: despiece y 3D coherentes.
- `packages/core/src/availability/availability.test.ts` y `packages/db/test/reservations.test.ts` — 49 cerchas, «faltan 2» con causantes, cercha 10/14 compartida, solapes de borde, concurrencia.
- `packages/core/src/crew/crew.test.ts` — turnos solapados y habilidades.
- `packages/db/test/tenant-isolation.test.ts` — aislamiento entre empresas con RLS.
- `apps/web/e2e/orders.spec.ts` — configuración de la 15x30 en menos de 2 minutos y «Faltan 2» en la pantalla de pedido.

## Seguridad multiempresa

Una sola base de datos con `tenant_id` en todas las tablas y Row Level Security. Las peticiones se ejecutan con
`withTenant()`, que abre una transacción, cambia al rol sin privilegios `rentevent_app` (`SET LOCAL ROLE`) y fija
`app.tenant_id`. Funciona con poolers en modo transacción (Supabase, PgBouncer). Las tablas de sistema (sesiones,
cola de trabajos, buzón simulado) no son accesibles desde ese rol.

## Despliegue (Vercel + Supabase, región UE)

1. **Base de datos (Supabase)**: aplica migraciones y políticas desde tu equipo con el *session pooler* (puerto 5432):
   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" pnpm db:migrate
   DATABASE_URL="..." pnpm db:seed          # opcional: empresa demo
   ```
2. **Vercel**: importa el repositorio con *Root Directory* `apps/web` (framework Next.js; pnpm se detecta solo).
   Variables mínimas:
   - `DATABASE_URL` — *transaction pooler* (puerto 6543): `postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`
   - `APP_URL` (p. ej. `https://app.rentevent.es`), `ROOT_DOMAIN` (p. ej. `rentevent.es`)
   - `AUTH_SECRET`, `CRON_SECRET` (`openssl rand -base64 32`)
   - `DEMO_MODE=false` en producción real
3. **Dominios**: añade `rentevent.es` y el comodín `*.rentevent.es` para el subdominio de cada empresa.
4. **Cron**: `apps/web/vercel.json` ejecuta `/api/cron` una vez al día (límite del plan Hobby). En Pro puede ponerse `*/15 * * * *`, o llamarse desde cualquier cron externo con `Authorization: Bearer $CRON_SECRET`.
5. Servicios opcionales (cada uno pasa de simulado a real al poner su clave): SMTP, S3 (UE), Stripe,
   WhatsApp Cloud API, geocodificador Nominatim, Anthropic (asistente IA), VAPID (push), Redis (BullMQ).
   La lista completa está en `.env.example`; el estado de cada servicio se ve en *Configuración › Integraciones*.

### Contenedor

`next build` produce una app Node estándar: `pnpm build && pnpm --filter @rentevent/web start`. El worker de la cola
se arranca con `pnpm worker` (usa Redis/BullMQ si existe `REDIS_URL`, si no la cola de PostgreSQL).

## Documentación interna

- `DECISIONS.md` — decisiones técnicas y datos de ejemplo pendientes de validar por el cliente.
- `PROGRESS.md` — estado por fases.
