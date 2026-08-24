# TCProject — Frontend

Portal de Tipo de Cambio. Angular 21 (standalone, signals) con Tailwind CSS v4.

## Puesta en marcha

```bash
npm install
npm start          # http://localhost:4200
```

El backend debe correr en `http://localhost:8000` (`php artisan serve`) y
declarar el origen del frontend:

```
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
FRONTEND_URL=http://localhost:4200
```

**Use `localhost` en ambos lados.** La cookie de sesión es `SameSite=Lax`, y
`localhost` y `127.0.0.1` se consideran sitios distintos: mezclarlos hace que el
navegador no envíe la cookie.

La URL del API se configura en `src/environments/environment.ts`.

## Sesión

El JWT viaja en una cookie **httpOnly** que este código no puede leer, así que
la fuente de verdad de la sesión es siempre el backend:

- Al arrancar, `provideAppInitializer` llama a `auth/verify`. Si responde, hay
  sesión; si falla, la aplicación arranca como invitado. Por eso un refresco de
  página no pierde la sesión aunque no haya nada en `localStorage`.
- `ApiClient` manda `withCredentials` en cada petición y desenvuelve la
  envoltura `ApiResponse` del backend, entregando siempre un `ApiError`
  normalizado (estado, mensaje y errores de validación por campo).
- `SessionService` replica el reloj de inactividad del backend: escucha
  actividad real, renueva el token con `auth/verify` (a lo sumo cada media
  ventana de sesión), avisa antes de expirar y cierra la sesión al llegar a
  cero. El tiempo lo dicta el backend en `sessionTimeoutMinutes`.
- El interceptor traduce `401` y `423` en cierre de sesión y regreso al login
  con el motivo, salvo en las rutas de sesión, que los manejan por su cuenta.

## Rutas y permisos

| Ruta | Acceso |
|---|---|
| `/login` | Sólo invitados |
| `/cambiar-contrasena` | Sesión con `mustChangePassword` |
| `/inicio` | Cualquier sesión |
| `/mi-cuenta` | Cualquier sesión |
| `/usuarios` | SUPERADMIN y ADMIN |

Mientras el backend marque `mustChangePassword` —primer acceso o contraseña
caducada— rechaza el resto de la API, así que `authGuard` lleva a la pantalla de
cambio en lugar de mostrar vistas que fallarían.

Los requisitos de contraseña se leen de `password-requirements` y se verifican
en vivo; la validación definitiva sigue siendo del backend.

## Estructura

```
src/app/
  core/
    auth/      AuthService (estado), SessionService (inactividad), guards
    http/      ApiClient y el interceptor de credenciales y errores
    models/    Contratos del API
  layout/shell Barra lateral, encabezado, pie y aviso de inactividad
  features/    login, cambiar-contrasena, inicio, usuarios, mi-cuenta
  shared/      Alert, Icon, Modal y utilidades de formulario
```

Los identificadores públicos son `uuid`: el backend nunca expone llaves
primarias y el frontend no debe inventarlas.

## Modal compartido

`app-modal` cubre título, subtítulo, contenido libre y pie. Sin pie propio
muestra Aceptar y Cancelar (`confirmLabel`, `cancelLabel`, `confirmVariant`,
`confirmDisabled`) y emite `confirmed` / `closed`; con un elemento marcado
`modalFooter` proyecta ese pie en su lugar.

```html
<app-modal title="Editar usuario" [subtitle]="user.email" (closed)="cerrar()" (confirmed)="guardar()">
  <p>Contenido…</p>
  <div modalFooter class="flex gap-3">…</div>
</app-modal>
```

La visibilidad la controla el padre con `@if`. Cierra con la ✕, con Escape y con
clic fuera; `dismissible` y `closeOnBackdrop` desactivan cada vía.

**Arrastre fuera del modal**: seleccionar el texto de un input y soltar el botón
sobre el fondo no cierra el diálogo. El clic se atribuye al ancestro común —el
fondo—, así que en lugar del clic se comparan `pointerdown` y `pointerup`: sólo
cierra cuando ambos ocurrieron en el fondo. Lo mismo aplica al gesto inverso,
que empieza fuera y termina dentro. Está cubierto en `modal.spec.ts`.

## Gestión de Usuarios

Listado paginado con búsqueda, filtro por estado y por rol, y acciones por fila:
editar (nombre, correo y rol), dar de baja, reactivar y restablecer la contraseña
temporal. El alta vive en la misma pantalla, plegada tras «Nuevo usuario».

Las reglas las hace cumplir el backend y la interfaz sólo las anticipa: nadie
cambia su propio rol ni se da de baja a sí mismo, y de superadministrador y
administrador sólo puede existir una cuenta activa.

Los campos de contraseña llevan un botón para mostrar u ocultar lo escrito.

## Pendiente

`Inicio` es un marcador de posición: los endpoints del tablero
(`/dashboard/exchange-rate`) ya existen y se conectan en la siguiente entrega.
