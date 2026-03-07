# AI Context for NPM-WG Project

## 1. Project Overview
**NPM-WG** is a custom fork of [Nginx Proxy Manager](https://github.com/NginxProxyManager/nginx-proxy-manager) integrated with **WireGuard VPN** management capabilities, inspired by `wg-easy`.

The project structure remains mostly identical to Nginx Proxy Manager, but specific backend and frontend modules have been added to manage WireGuard securely inside the Docker container without needing external dependencies.

---

## 2. Technology Stack
- **Backend**: Node.js, Express.js, Knex (Query Builder), SQLite/MySQL/PostgreSQL. Uses ES Modules (`"type": "module"`).
- **Frontend**: React 18, TypeScript, Vite, React Router, React Bootstrap (`ez-modal-react`), Formik, React Query (`@tanstack/react-query`).
- **Container**: Alpine Linux with `s6-overlay` for service process management.

---

## 3. WireGuard Integration Architecture

### Core Idea
WireGuard functionality is disabled by default and enabled via the `WG_ENABLED` environment variable. The system uses a Node.js cron wrapper to manipulate the WireGuard `wg` and `wg-quick` CLI tools directly. It leverages Docker volume mapping (`/etc/wireguard`) to maintain state.

### Backend Map (Node.js)
If you need to edit WireGuard logic, check these files:
- **`backend/lib/wg-helpers.js`**: Shell wrappers for `wg` CLI (create keys, parse CIDR, parse `wg show` dumps, gen configurations).
- **`backend/internal/wireguard.js`**: Core business logic. Manages interface start/stop, adding/removing clients, IP allocation, and token expiration checking via cron.
- **`backend/routes/wireguard.js`**: REST APIs exposing CRUD operations to the frontend. Note: Handlers use ES module export functions syntax.
- **`backend/routes/main.js`**: Mounts the `/api/wireguard` routes.
- **`backend/index.js`**: Contains the startup hook `internalWireguard.startup(knex)` and graceful SIGTERM shutdown hooks.
- **`backend/migrations/20260307000000_wireguard.js`**: Knex schema initialization for tables `wg_interface` and `wg_client`. *Note: Must use ES Module `export function up()` instead of `exports.up`!*

### Frontend Map (React)
If you need to edit the UI/UX, check these files:
- **`frontend/src/api/backend/wireguard.ts`**: API fetch helper definitions.
- **`frontend/src/hooks/useWireGuard.ts`**: `@tanstack/react-query` data fetchers and mutators.
- **`frontend/src/pages/WireGuard/index.tsx`**: Main UI Page rendering the interface stats and clients table.
- **`frontend/src/modals/WireGuardClientModal.tsx`**: Form to create a new client. *Note: Modal built explicitly over `react-bootstrap/Modal` to prevent backdrop freezing issues.*
- **`frontend/src/modals/WireGuardQRModal.tsx`**: Generates and parses QR codes.
- **`frontend/src/Router.tsx` & `SiteMenu.tsx`**: Routing and UI Navigation injection points for WireGuard UI.

---

## 4. Build & Deployment Gotchas

### Line Endings (CRLF vs LF)
- **CRITICAL**: All files in `docker/rootfs` and `docker/scripts` are used by `s6-overlay` inside Alpine Linux. **They MUST be formatted using UNIX Line Endings (LF)**. If you download this repository on Windows, ensure the git config does not automatically convert text files to `CRLF`, otherwise container booting will crash with `s6-rc-compile: fatal: invalid type: must be oneshot, longrun, or bundle`.

### Compilation Steps
- The React Frontend **MUST** be pre-built before Docker can build. 
- You must run `yarn install`, `yarn locale-compile`, and `yarn build` inside the `frontend/` directory before `docker build`.
- Use the script `./scripts/build-project.sh` to execute the full pipeline if you have a bash environment.

### Docker Config Requirements
- **Required capabilities**: `--cap-add=NET_ADMIN` and `--cap-add=SYS_MODULE` are required for WireGuard to manipulate interfaces.
- **Sysctls**: `--sysctl net.ipv4.ip_forward=1` must be applied to the container.
- **Volumes**: Volume `/etc/letsencrypt` is severely required by original NPM core.

---

## 5. Agent Instructions
If you are an AI reading this file:
1. Treat existing NPM-specific code as sacred. Do not modify global `.ts` hooks or Knex config unless instructed.
2. If fixing a bug in the Frontend, use `useWgClients()` / `useInterfaceStatus()` standard hooks. Use React-Bootstrap `Modal` instead of raw div class names.
3. If changing the DB, create a new `backend/migrations/*.js` file in ES Module format.
4. When testing out scripts, remember that the docker container requires port mapping to 51820/udp.
