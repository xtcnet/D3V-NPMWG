# D3V-NPMWG — Nginx Proxy Manager + WireGuard VPN

A powerful, all-in-one Docker container that combines **Nginx Proxy Manager** (reverse proxy with SSL) and **WireGuard VPN** management in a single, beautiful web interface.

## ✨ Features

### Nginx Proxy Manager
- 🌐 Reverse proxy management with a beautiful UI
- 🔒 Free SSL certificates via Let's Encrypt
- 🔀 Proxy hosts, redirection hosts, streams, and 404 hosts
- 🛡️ Access control lists
- 📊 Audit logging

### WireGuard VPN Manager
- 🔑 Create, enable, disable, and delete VPN clients
- 📱 QR code generation for mobile clients
- 📥 Download `.conf` configuration files
- 📡 Real-time client status (connected, idle, data transfer)
- ⏰ Client expiration support
- 🔄 Auto-sync WireGuard configs

## 🚀 Quick Start (Auto Install)

The easiest way to install, update, and manage your D3V-NPMWG instance on Linux is by using our interactive manager script.

```bash
# Download and run the install script
curl -sSL https://raw.githubusercontent.com/xtcnet/D3V-NPMWG/master/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

**Features included in the script:**
- `Install D3V-NPMWG`: Automatically setup docker-compose and directories in `/opt/d3v-npmwg`.
- `Uninstall D3V-NPMWG`: Remove containers and wipe data.
- `Reset Password`: Resets the admin login to `admin@example.com` / `changeme`.
- `Update`: Pulls the latest image and updates the docker-compose stack.

You can also run specific commands directly: `sudo ./install.sh {install|uninstall|reset|update}`

---

## 🐋 Manual Docker Run```bash
docker run -d \
  --name npm-wg \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  --sysctl net.ipv4.ip_forward=1 \
  --sysctl net.ipv4.conf.all.src_valid_mark=1 \
  -p 80:80 \
  -p 81:81 \
  -p 443:443 \
  -p 51820:51820/udp \
  -v npm-wg-data:/data \
  -v npm-wg-letsencrypt:/etc/letsencrypt \
  -v npm-wg-wireguard:/etc/wireguard \
  -e WG_HOST=your.server.ip \
  npm-wg:latest
```

## 📋 Docker Compose

```yaml
version: "3.8"
services:
  npm-wg:
    image: npm-wg:latest
    container_name: npm-wg
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1
    ports:
      - "80:80"       # HTTP
      - "81:81"       # Admin UI
      - "443:443"     # HTTPS
      - "51820:51820/udp"  # WireGuard
    volumes:
      - data:/data
      - letsencrypt:/etc/letsencrypt
      - wireguard:/etc/wireguard
    environment:
      WG_HOST: "your.server.ip"    # REQUIRED: Your server's public IP or domain
      # WG_PORT: 51820             # WireGuard listen port
      # WG_DEFAULT_ADDRESS: 10.8.0.0/24  # VPN subnet
      # WG_DNS: 1.1.1.1,8.8.8.8   # DNS for VPN clients
      # WG_MTU: 1420               # MTU for VPN
      # WG_ALLOWED_IPS: 0.0.0.0/0,::/0  # Allowed IPs for clients
      # WG_PERSISTENT_KEEPALIVE: 25
      # WG_ENABLED: true           # Set to false to disable WireGuard

volumes:
  data:
  letsencrypt:
  wireguard:
```

## 🔧 Environment Variables

### WireGuard Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WG_ENABLED` | `true` | Enable/disable WireGuard VPN |
| `WG_HOST` | *(required)* | Public IP or domain of your server |
| `WG_PORT` | `51820` | WireGuard UDP listen port |
| `WG_DEFAULT_ADDRESS` | `10.8.0.0/24` | VPN subnet CIDR |
| `WG_DNS` | `1.1.1.1, 8.8.8.8` | DNS servers for VPN clients |
| `WG_MTU` | `1420` | MTU value |
| `WG_ALLOWED_IPS` | `0.0.0.0/0, ::/0` | Default allowed IPs for clients |
| `WG_PERSISTENT_KEEPALIVE` | `25` | Keepalive interval in seconds |

## 🌍 Ports

| Port | Protocol | Description |
|------|----------|-------------|
| `80` | TCP | HTTP |
| `81` | TCP | Admin Web UI |
| `443` | TCP | HTTPS |
| `51820` | UDP | WireGuard VPN |

## 📖 Usage

1. **Access the Admin UI** at `http://your-server:81`
2. **Set up NPM** with your admin email and password
3. **Navigate to WireGuard** from the sidebar menu
4. **Create VPN clients** by clicking "New Client"
5. **Scan QR code** or **download .conf** file to configure WireGuard on your devices

## 🏗️ Building and CI/CD

### ☁️ Automated Build (Docker Cloud Build)
This project is configured with **GitHub Actions** (`.github/workflows/docker-publish.yml`) to automatically build and push multi-arch Docker images (`amd64`, `arm64`) to **GitHub Container Registry (GHCR)** whenever a push is made to the `master` branch or a version tag is created.

Images are available at: `ghcr.io/xtcnet/d3v-npmwg:latest`

### 🏗️ Building from Source Local
To build D3V-NPMWG from source manually, you must build the React frontend before building the Docker image:

```bash
# Clone the repository
git clone https://github.com/xtcnet/D3V-NPMWG.git
cd D3V-NPMWG

# 1. Build the Frontend
cd frontend
yarn install
yarn build
cd ..

# 2. Build the Docker Image
# IMPORTANT: Do not forget the trailing dot '.' at the end of the command!
docker build -t npm-wg -f docker/Dockerfile .
```

Alternatively, you can run the helper script:
```bash
./scripts/build-project.sh
```

## ⚠️ Requirements

- **Docker** with Linux containers
- **Host kernel** must support WireGuard (Linux 5.6+ or WireGuard kernel module)
- Container requires `NET_ADMIN` and `SYS_MODULE` capabilities
- IP forwarding must be enabled (`net.ipv4.ip_forward=1`)

## 📜 Credits

- [Nginx Proxy Manager](https://github.com/NginxProxyManager/nginx-proxy-manager) — Original proxy manager
- [wg-easy](https://github.com/wg-easy/wg-easy) — WireGuard management inspiration

## 📄 License

MIT License
