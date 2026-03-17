#!/bin/bash
set -e

# ============================================================
#  D3V-NPMWG Installer for Ubuntu/Debian
#  xGat3 + WireGuard VPN
#  https://github.com/xtcnet/D3V-NPMWG
# ============================================================

INSTALL_DIR="/opt/d3v-npmwg"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
CONTAINER_NAME="d3v-npmwg"
IMAGE_NAME="ghcr.io/xtcnet/d3v-npmwg:latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# -----------------------------------------------------------
#  Helpers
# -----------------------------------------------------------
log_step()  { echo -e "${CYAN}[*]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
log_err()   { echo -e "${RED}[✗]${NC} $1"; }
separator() { echo -e "${GREEN}=================================================================${NC}"; }

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        log_err "This script must be run as root. Use: sudo $0"
        exit 1
    fi
}

get_compose_cmd() {
    if docker compose version > /dev/null 2>&1; then
        echo "docker compose"
    else
        log_err "Docker Compose plugin not found. Please install it first."
        exit 1
    fi
}

detect_public_ip() {
    local ip=""
    ip=$(curl -s -m 5 https://ifconfig.me 2>/dev/null) \
        || ip=$(curl -s -m 5 https://icanhazip.com 2>/dev/null) \
        || ip=$(curl -s -m 5 https://api.ipify.org 2>/dev/null) \
        || ip=""
    echo "$ip"
}

# -----------------------------------------------------------
#  1. Install system dependencies
# -----------------------------------------------------------
install_deps() {
    separator
    echo -e "${BOLD} Installing System Dependencies${NC}"
    separator

    # --- curl ---
    log_step "Checking curl..."
    if command -v curl > /dev/null 2>&1; then
        log_ok "curl is already installed."
    else
        log_step "Installing curl..."
        apt-get update -qq
        apt-get install -y curl
        log_ok "curl installed."
    fi

    # --- Docker ---
    log_step "Checking Docker..."
    if command -v docker > /dev/null 2>&1; then
        log_ok "Docker is already installed ($(docker --version))."
    else
        log_step "Installing Docker... (this may take 1-2 minutes)"
        curl -fsSL https://get.docker.com | sh
        log_ok "Docker installed."
    fi

    # --- Ensure Docker daemon is running ---
    log_step "Starting Docker service..."
    systemctl enable docker > /dev/null 2>&1 || true
    systemctl restart docker > /dev/null 2>&1 || true

    # --- Wait for Docker daemon ---
    log_step "Waiting for Docker daemon to be ready..."
    local retries=0
    while ! docker info > /dev/null 2>&1; do
        retries=$((retries + 1))
        if [ "$retries" -ge 30 ]; then
            log_err "Docker daemon did not start after 30 seconds."
            log_err "Try: systemctl restart docker"
            exit 1
        fi
        sleep 1
    done
    log_ok "Docker daemon is running."

    # --- Remove old standalone docker-compose (Python) if present ---
    if command -v docker-compose > /dev/null 2>&1; then
        local dc_path
        dc_path=$(command -v docker-compose)
        # Check if it's the old Python version
        if docker-compose version 2>&1 | grep -qi "docker-compose version 1"; then
            log_warn "Detected legacy docker-compose (Python). Removing it..."
            apt-get purge -y docker-compose 2>/dev/null || rm -f "$dc_path" 2>/dev/null || true
            log_ok "Legacy docker-compose removed."
        fi
    fi

    # --- Docker Compose plugin ---
    log_step "Checking Docker Compose plugin..."
    if docker compose version > /dev/null 2>&1; then
        log_ok "Docker Compose plugin is ready ($(docker compose version))."
    else
        log_step "Installing Docker Compose plugin..."
        apt-get update -qq
        apt-get install -y docker-compose-plugin
        log_ok "Docker Compose plugin installed."
    fi

    echo ""
    log_ok "All system dependencies are ready."
}

# -----------------------------------------------------------
#  x. Generate docker-compose.yml
# -----------------------------------------------------------
generate_docker_compose() {
    local host="$1"
    if [ -z "$host" ]; then
        log_err "generate_docker_compose: host is empty."
        return 1
    fi

    log_step "Generating docker-compose.yml..."
    
    local custom_ports_block=""
    if [ -f ".custom_ports" ]; then
        while IFS= read -r port_mapping; do
            # Ignore empty lines or comments
            [[ -z "$port_mapping" || "$port_mapping" =~ ^# ]] && continue
            custom_ports_block+="      - \"${port_mapping}\"\n"
        done < ".custom_ports"
    fi

    cat > "$COMPOSE_FILE" <<YAML
services:
  d3v-npmwg:
    image: ${IMAGE_NAME}
    container_name: ${CONTAINER_NAME}
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
      - "51820-51830:51820-51830/udp"  # WireGuard Multi-Server Range
$(echo -e "$custom_ports_block" | sed '/^$/d')    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
      - ./wireguard:/etc/wireguard
    environment:
      WG_HOST: "${host}"
YAML
    log_ok "docker-compose.yml created/updated."
}

# -----------------------------------------------------------
#  2. Install D3V-NPMWG
# -----------------------------------------------------------
do_install() {
    require_root

    if [ -d "$INSTALL_DIR" ]; then
        log_warn "D3V-NPMWG is already installed at ${INSTALL_DIR}."
        log_warn "Use the Update option to pull the latest image, or Uninstall first."
        return
    fi

    separator
    echo -e "${BOLD} D3V-NPMWG Installation${NC}"
    separator
    echo ""

    # --- Dependencies ---
    install_deps
    echo ""

    # --- Detect IP ---
    log_step "Detecting server public IP..."
    local detected_ip
    detected_ip=$(detect_public_ip)

    local wg_host=""
    if [ -n "$detected_ip" ]; then
        log_ok "Detected IP: ${BOLD}${detected_ip}${NC}"
        read -rp "$(echo -e "${CYAN}[?]${NC} WG_HOST [${detected_ip}]: ")" wg_host
        wg_host="${wg_host:-$detected_ip}"
    else
        log_warn "Could not auto-detect public IP."
        read -rp "$(echo -e "${CYAN}[?]${NC} Enter server public IP or domain: ")" wg_host
    fi

    if [ -z "$wg_host" ]; then
        log_err "WG_HOST cannot be empty. Aborting."
        return
    fi

    # --- Create directory ---
    log_step "Creating ${INSTALL_DIR}..."
    mkdir -p "$INSTALL_DIR"
    log_ok "Directory created."

    # --- Write docker-compose.yml ---
    generate_docker_compose "$wg_host"

    # --- Pull & Start ---
    log_step "Pulling Docker image (this may take a few minutes)..."
    local dc
    dc=$(get_compose_cmd)
    cd "$INSTALL_DIR"
    $dc pull
    log_ok "Image pulled."

    log_step "Starting containers..."
    $dc up -d
    log_ok "Containers started."

    # --- Verify ---
    log_step "Waiting for container to become healthy (10s)..."
    sleep 10

    if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
        echo ""
        separator
        echo -e "${GREEN}${BOLD}   D3V-NPMWG INSTALLED SUCCESSFULLY!${NC}"
        separator
        echo -e "  ${CYAN}Web Admin UI${NC}  : ${BOLD}http://${wg_host}:81${NC}"
        echo -e "  ${CYAN}HTTP Proxy${NC}    : port 80"
        echo -e "  ${CYAN}HTTPS Proxy${NC}   : port 443"
        echo -e "  ${CYAN}WireGuard VPN${NC} : port 51820/udp"
        echo ""
        echo -e "  Open the Web UI in ~30s and create your admin account."
        separator
    else
        log_err "Container did not start. Check logs:"
        echo -e "  docker logs ${CONTAINER_NAME}"
    fi
}

# -----------------------------------------------------------
#  3. Uninstall D3V-NPMWG
# -----------------------------------------------------------
do_uninstall() {
    require_root

    if [ ! -d "$INSTALL_DIR" ]; then
        log_warn "D3V-NPMWG is not installed at ${INSTALL_DIR}."
        return
    fi

    log_warn "This will stop and remove D3V-NPMWG and ALL its data."
    read -rp "$(echo -e "${RED}Are you sure? (y/N): ${NC}")" confirm
    if [[ ! "$confirm" =~ ^[yY]$ ]]; then
        echo "Cancelled."
        return
    fi

    log_step "Stopping containers..."
    local dc
    dc=$(get_compose_cmd)
    cd "$INSTALL_DIR" && $dc down -v 2>/dev/null || true
    cd /

    log_step "Removing ${INSTALL_DIR}..."
    rm -rf "$INSTALL_DIR"
    log_ok "D3V-NPMWG uninstalled."
}

# -----------------------------------------------------------
#  4. Purge — uninstall app + system deps (Docker)
# -----------------------------------------------------------
do_purge() {
    require_root
    do_uninstall

    echo ""
    log_warn "Do you also want to remove Docker and Docker Compose from this system?"
    read -rp "$(echo -e "${RED}Remove Docker? (y/N): ${NC}")" confirm
    if [[ ! "$confirm" =~ ^[yY]$ ]]; then
        echo "Skipped Docker removal."
        return
    fi

    log_step "Removing Docker packages..."
    apt-get purge -y docker-ce docker-ce-cli containerd.io \
        docker-compose-plugin docker-buildx-plugin 2>/dev/null || true
    apt-get autoremove -y --purge 2>/dev/null || true
    log_ok "Docker and related packages removed."
}

# -----------------------------------------------------------
#  5. Reset admin password
# -----------------------------------------------------------
do_reset_password() {
    require_root

    if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
        log_err "Container ${CONTAINER_NAME} is not running. Start it first."
        return
    fi

    read -rsp "$(echo -e "${CYAN}[?]${NC} New password: ")" new_pass
    echo ""
    if [ -z "$new_pass" ]; then
        log_err "Password cannot be empty. Cancelled."
        return
    fi

    log_step "Resetting admin password..."

    local result
    result=$(docker exec "$CONTAINER_NAME" node -e "
        import('bcrypt').then(async bcrypt => {
            const knex = (await import('/app/db.js')).default();
            const user = await knex('user').where('is_deleted', 0).orderBy('id', 'asc').first();
            if (!user) { console.error('NO_USER'); process.exit(2); }
            const hash = await bcrypt.hash('${new_pass}', 13);
            await knex('auth').where('user_id', user.id).update({ secret: hash });
            await knex('user').where('id', user.id).update({ is_disabled: 0 });
            console.log(user.email);
            process.exit(0);
        }).catch(e => { console.error(e.message); process.exit(1); });
    " 2>&1)

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_ok "Password updated successfully."
        echo -e "  Email    : ${BOLD}${result}${NC}"
    else
        log_err "Failed to reset password: ${result}"
    fi
}

# -----------------------------------------------------------
#  6. Update D3V-NPMWG
# -----------------------------------------------------------
do_update() {
    require_root

    log_step "Checking for install.sh updates..."
    local remote_script_url="https://raw.githubusercontent.com/xtcnet/D3V-NPMWG/master/install.sh"
    if ! curl -sSL "$remote_script_url" | cmp -s "$0" -; then
        log_warn "A newer version of install.sh is available. Updating script..."
        curl -sSL "$remote_script_url" -o "$0"
        chmod +x "$0"
        log_ok "install.sh updated. Restarting update process..."
        exec "$0" update
        exit 0
    else
        log_ok "install.sh is up to date."
    fi

    if [ ! -d "$INSTALL_DIR" ]; then
        log_err "D3V-NPMWG is not installed. Install it first."
        return
    fi

    local dc
    dc=$(get_compose_cmd)
    cd "$INSTALL_DIR" || return

    # Save existing WG_HOST before regenerating template
    local current_wg_host=""
    if [ -f "docker-compose.yml" ]; then
        # Safely extract WG_HOST value ignoring quotes and spaces
        current_wg_host=$(grep -E 'WG_HOST:' docker-compose.yml | awk -F'"' '{print $2}')
    fi
    if [ -z "$current_wg_host" ]; then
        current_wg_host=$(detect_public_ip)
        log_warn "Could not extract WG_HOST. Using ${current_wg_host}."
    fi

    generate_docker_compose "$current_wg_host"

    log_step "Pulling latest image..."
    $dc pull
    log_ok "Image pulled."

    log_step "Recreating containers..."
    $dc up -d
    log_ok "D3V-NPMWG updated."

    log_step "Cleaning old images..."
    docker image prune -f > /dev/null 2>&1
    log_ok "Done."
}

# -----------------------------------------------------------
#  7. Toggle Port 81 (Admin UI)
# -----------------------------------------------------------
#  x. Custom Stream Ports Manager
# -----------------------------------------------------------
do_manage_ports() {
    require_root
    echo ""
    log_step "TCP/UDP Stream Ports Manager"
    echo "If you created a Stream in Nginx Proxy Manager (e.g., listening on port 10000),"
    echo "you must expose that port down to the Docker container."
    echo ""
    
    local custom_ports_file=".custom_ports"
    touch "$custom_ports_file"
    
    echo "Current custom exposed ports:"
    if [ -s "$custom_ports_file" ]; then
        cat -n "$custom_ports_file"
    else
        echo "  (None)"
    fi
    echo ""
    
    read -rp "$(echo -e "${CYAN}[?]${NC} Enter new port mapping (e.g. 10000:10000) or 'clear' to remove all: ")" new_port
    
    if [[ "$new_port" == "clear" ]]; then
        > "$custom_ports_file"
        log_ok "All custom ports cleared."
    elif [[ -n "$new_port" ]]; then
        echo "$new_port" >> "$custom_ports_file"
        log_ok "Port $new_port added."
    else
        log_warn "No changes made."
        return
    fi
    
    log_step "Regenerating docker-compose.yml and restarting container..."
    
    local dc
    dc=$(get_compose_cmd)
    
    local current_wg_host=""
    if [ -f "docker-compose.yml" ]; then
        current_wg_host=$(grep -E 'WG_HOST:' docker-compose.yml | awk -F'"' '{print $2}')
    fi
    if [ -z "$current_wg_host" ]; then
        current_wg_host=$(detect_public_ip)
    fi

    generate_docker_compose "$current_wg_host"
    
    $dc up -d
    log_ok "Container updated with new port configurations."
}

# -----------------------------------------------------------
#  7. Toggle Port 81 (Admin UI)
# -----------------------------------------------------------
do_toggle_port_81() {
    require_root
    echo ""
    log_warn "This feature uses iptables (DOCKER-USER chain) to block external access to port 81."
    log_warn "When blocked, you can only access the Admin UI via the WireGuard VPN (http://10.8.0.1:81) or localhost."
    echo ""
    read -rp "$(echo -e "${CYAN}[?]${NC} Do you want to (B)lock or (U)nblock external access to port 81? [B/U]: ")" choice
    if [[ "$choice" =~ ^[bB]$ ]]; then
        log_step "Blocking external access to port 81..."
        # Remove existing rule if any to avoid duplicates
        iptables -D DOCKER-USER -p tcp --dport 81 -j DROP 2>/dev/null || true
        # Add rule to block port 81
        iptables -I DOCKER-USER -p tcp --dport 81 -j DROP
        log_ok "External access to port 81 is now BLOCKED."
    elif [[ "$choice" =~ ^[uU]$ ]]; then
        log_step "Unblocking external access to port 81..."
        iptables -D DOCKER-USER -p tcp --dport 81 -j DROP 2>/dev/null || true
        log_ok "External access to port 81 is now UNBLOCKED (Public)."
    else
        log_err "Invalid choice. Cancelled."
    fi
}

# -----------------------------------------------------------
#  Interactive menu
# -----------------------------------------------------------
show_menu() {
    while true; do
        echo ""
        separator
        echo -e "${BOLD}  D3V-NPMWG Installation Manager${NC}"
        separator
        echo "  1) Install D3V-NPMWG"
        echo "  2) Uninstall D3V-NPMWG"
        echo "  3) Uninstall D3V-NPMWG + Docker (Purge)"
        echo "  4) Reset Admin Password"
        echo "  5) Update D3V-NPMWG"
        echo "  6) Manage Custom Stream Ports"
        echo "  7) Toggle Admin Port 81 (Block/Unblock)"
        echo "  8) Exit"
        separator
        read -rp "  Select [1-8]: " choice
        echo ""
        case "$choice" in
            1) do_install ;;
            2) do_uninstall ;;
            3) do_purge ;;
            4) do_reset_password ;;
            5) do_update ;;
            6) do_manage_ports ;;
            7) do_toggle_port_81 ;;
            8) echo "Bye!"; exit 0 ;;
            *) log_err "Invalid option." ;;
        esac
    done
}

show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install      Install D3V-NPMWG and dependencies"
    echo "  uninstall    Remove D3V-NPMWG (keeps Docker)"
    echo "  purge        Remove D3V-NPMWG AND Docker"
    echo "  reset        Reset web admin password"
    echo "  update       Pull latest image and restart"
    echo "  manage-ports Add or remove custom exposed Stream TCP/UDP ports"
    echo "  toggle-port  Block or unblock external access to Admin UI (Port 81) using iptables"
    echo "  help         Show this help"
    echo ""
    echo "Run without arguments to open the interactive menu."
}

# -----------------------------------------------------------
#  Entry point
# -----------------------------------------------------------
if [ "$#" -eq 0 ]; then
    show_menu
else
    case "$1" in
        install)     do_install ;;
        uninstall)   do_uninstall ;;
        purge)       do_purge ;;
        reset)       do_reset_password ;;
        update)      do_update ;;
        manage-ports) do_manage_ports ;;
        toggle-port) do_toggle_port_81 ;;
        help|-h|--help) show_help ;;
        *)
            log_err "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
fi
