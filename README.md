# Xpertos — app de usuarios (cliente final + experto)

App móvil y web de **Xpertos** construida con Expo SDK 57, Expo Router y TypeScript. La usan:

- **Clientes**: solicitan servicios (categoría, descripción, fotos, dirección, disponibilidad), siguen el estado, pagan por etapas subiendo comprobantes, firman el contrato y califican.
- **Expertos**: ven sus servicios asignados, los inician y completan, declaran disponibilidad semanal, suben documentos de su postulación, firman el contrato y califican.

El backend es Supabase (`../xpertos-backend`). Las reglas de negocio y la máquina de estados viven en la base de datos (RLS + triggers); esta app solo muestra las acciones permitidas para cada rol.

## Requisitos

- Node 24 (`source ~/.nvm/nvm.sh && nvm use 24`)
- Backend local corriendo: `cd ../xpertos-backend && supabase start`

## Configuración

```bash
cp .env.example .env
# Completa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (los imprime `supabase status`)
npm install
```

## Correr

```bash
npx expo start --web --port 8081   # web en http://localhost:8081
npx expo start                     # luego: w (web) · i (iOS) · a (Android)
```

`expo-image-picker`, `expo-document-picker` y `expo-file-system` están incluidos en Expo Go, así que la app corre en Expo Go sin development build.

## Verificación

```bash
npx tsc --noEmit                    # typecheck
npx expo lint                       # lint
npx expo export --platform web      # build web de producción (sale en dist/)
```

## Usuarios de prueba

Ver `../xpertos-backend/supabase/seed.sql` (cliente, experto y admin). Cualquier registro nuevo queda con rol `client`; el rol `expert` lo otorga el admin al aprobar la postulación desde el panel de administración.

## Estructura

```
src/
  app/                    # rutas (Expo Router)
    _layout.tsx           # AuthProvider + Stack raíz
    index.tsx             # redirige según sesión y rol
    (auth)/               # login, register
    (client)/             # tabs: index (Mis servicios), new, apply (Ser experto), account (Perfil)
    (expert)/             # tabs: assigned (Asignados), availability, profile (Perfil)
    service/[id].tsx      # detalle compartido (cliente/experto)
    admin.tsx             # aviso para administradores
  components/             # UI propia (StyleSheet) y secciones del detalle
  lib/                    # supabase.ts, upload.ts, format.ts, labels.ts, database.types.ts
  providers/auth.tsx      # sesión + perfil (role)
```

## Storage

Todos los buckets son privados y las rutas siempre empiezan por el `uid` del dueño (exigido por RLS):

- `service-photos/<uid>/<service_id>/<timestamp>.<ext>`
- `payment-proofs/<uid>/<service_id>/<timestamp>.<ext>`
- `expert-documents/<uid>/<application_id>/<timestamp>-<nombre>`

La lectura se hace con URLs firmadas (`createSignedUrl`).
