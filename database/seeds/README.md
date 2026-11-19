# Semillas de Demostración (Desarrollo Local)

Mecanismo reproducible e idempotente para inicializar las cuentas de demostración por rol en Sonic Ledger.

## Cuentas preparadas

| Rol Perfil | Correo | Roles Asignados | Perfil Artístico |
| :--- | :--- | :--- | :--- |
| **Cliente** | `demo.cliente@example.com` | `CLIENTE` | N/A |
| **Artista** | `demo.artista@example.com` | `CLIENTE`, `ARTISTA` | *Aura Neón* |
| **Organizador** | `demo.organizador@example.com` | `CLIENTE`, `ORGANIZADOR` | N/A |
| **Verificador** | `demo.verificador@example.com` | `CLIENTE`, `VERIFICADOR` | N/A |
| **Administrador** | `demo.admin@example.com` | `CLIENTE`, `ADMIN` | N/A |

## Requisitos y Configuración de Contraseñas

Las contraseñas **nunca se guardan en texto plano en el repositorio ni se muestran en logs**. Se leen desde variables de entorno y se hashean con `bcrypt` (coste 12):

1. Variable global para todas las cuentas demo:
   - `DEMO_PASSWORD` (mínimo 8 caracteres, máximo 72 bytes).
2. Variables individuales opcionales:
   - `DEMO_CLIENTE_PASSWORD`
   - `DEMO_ARTISTA_PASSWORD`
   - `DEMO_ORGANIZADOR_PASSWORD`
   - `DEMO_VERIFICADOR_PASSWORD`
   - `DEMO_ADMIN_PASSWORD`

Configurar en `backend/.env` o pasar como variable en terminal:

```powershell
$env:DEMO_PASSWORD="TuContraseñaSegura123!"
```

## Comando de ejecución

Desde la raíz del proyecto:

```powershell
npm run seed
```

O desde el directorio backend:

```powershell
npm --prefix backend run seed
```

El script es idempotente: puede ejecutarse repetidas veces sin duplicar cuentas ni alterar usuarios reales existentes.
