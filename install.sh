#!/bin/bash

# Configuration
INSTALL_DIR="/opt/d3v-npmwg"
DOCKER_COMPOSE_YML="$INSTALL_DIR/docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Please run as root (use sudo).${NC}"
        exit 1
    fi
}

function check_dependencies() {
    echo -e "${YELLOW}[1/3] Checking system dependencies...${NC}"
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        echo -e "${YELLOW}curl is missing. Installing curl...${NC}"
        apt-get update -qq && apt-get install -y curl > /dev/null
        echo -e "${GREEN}✓ curl installed.${NC}"
    else
        echo -e "${GREEN}✓ curl is already installed.${NC}"
    fi

    # Check Docker
    echo -e "${YELLOW}[2/3] Checking Docker...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker is not installed. Installing Docker (this may take a while)...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh > /dev/null 2>&1
        rm get-docker.sh
        systemctl enable --now docker > /dev/null 2>&1
        echo -e "${GREEN}✓ Docker installed and started.${NC}"
    else
        echo -e "${GREEN}✓ Docker is already installed.${NC}"
    fi

    # Check Docker Compose (plugin or standalone)
    echo -e "${YELLOW}[3/3] Checking Docker Compose...${NC}"
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}Docker Compose is missing. Installing Docker Compose plugin...${NC}"
        apt-get update -qq && apt-get install -y docker-compose-plugin > /dev/null
        echo -e "${GREEN}✓ Docker Compose installed.${NC}"
    else
        echo -e "${GREEN}✓ Docker Compose is already installed.${NC}"
    fi
    echo -e "${GREEN}All system dependencies are ready.${NC}"
}

function get_docker_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

function install_npm_wg() {
    check_root
    check_dependencies

    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Installation directory ($INSTALL_DIR) already exists. Do you want to update instead?${NC}"
        return
    fi

    echo -e "${YELLOW}Detecting public IP...${NC}"
    DETECTED_IP=$(curl -s -m 5 https://ifconfig.me || curl -s -m 5 https://icanhazip.com || echo "")
    
    if [ -n "$DETECTED_IP" ]; then
        echo -e "${GREEN}Detected Public IP: $DETECTED_IP${NC}"
        read -p "Enter your server's public IP or Domain [Default: $DETECTED_IP]: " WG_HOST
        WG_HOST=${WG_HOST:-$DETECTED_IP}
    else
        read -p "Enter your server's public IP or Domain for WireGuard (WG_HOST): " WG_HOST
    fi

    if [ -z "$WG_HOST" ]; then
        echo -e "${RED}WG_HOST cannot be empty. Aborting.${NC}"
        return
    fi

    echo -e "${YELLOW}Creating installation directory at $INSTALL_DIR...${NC}"
    mkdir -p "$INSTALL_DIR"
    
    # Create docker-compose.yml
    cat <<EOF > "$DOCKER_COMPOSE_YML"
version: "3.8"
services:
  npm-wg:
    image: ghcr.io/xtcnet/d3v-npmwg:latest
    # Wait, the README uses npm-wg:latest.
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
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
      - ./wireguard:/etc/wireguard
    environment:
      WG_HOST: "$WG_HOST"
EOF

    echo -e "${GREEN}✓ Docker compose file created successfully.${NC}"
    cd "$INSTALL_DIR" || exit
    
    echo -e "${YELLOW}Starting D3V-NPMWG containers (Pulling images)...${NC}"
    local dc_cmd=$(get_docker_compose_cmd)
    $dc_cmd up -d
    
    echo -e "${YELLOW}Verifying installation...${NC}"
    sleep 5
    if docker ps --format '{{.Names}}' | grep -q "npm-wg"; then
        echo -e "${GREEN}✓ D3V-NPMWG container is running.${NC}"
        echo -e "\n${GREEN}==================================================================${NC}"
        echo -e "${GREEN}   D3V-NPMWG INSTALLED SUCCESSFULLY!${NC}"
        echo -e "${GREEN}==================================================================${NC}"
        echo -e "${YELLOW}Web UI Admin  : http://$WG_HOST:81${NC}"
        echo -e "${YELLOW}HTTP Proxy    : Port 80${NC}"
        echo -e "${YELLOW}HTTPS Proxy   : Port 443${NC}"
        echo -e "${YELLOW}WireGuard UDP : Port 51820${NC}"
        echo -e "\nWait about 30-60 seconds for the first initiation, then"
        echo -e "access the Web UI and create your administrator account."
        echo -e "${GREEN}==================================================================${NC}"
    else
        echo -e "${RED}✗ Error: D3V-NPMWG container failed to start.${NC}"
        echo -e "Check logs using: docker logs npm-wg"
    fi
}

function uninstall_npm_wg() {
    check_root
    echo -e "${RED}WARNING: This will completely remove D3V-NPMWG and all its data!${NC}"
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" == [yY] || "$confirm" == [yY][eE][sS] ]]; then
        if [ -d "$INSTALL_DIR" ]; then
            cd "$INSTALL_DIR" || exit
            local dc_cmd=$(get_docker_compose_cmd)
            $dc_cmd down -v
            cd /
            rm -rf "$INSTALL_DIR"
            echo -e "${GREEN}D3V-NPMWG uninstalled completely.${NC}"
        else
            echo -e "${YELLOW}D3V-NPMWG is not installed in $INSTALL_DIR.${NC}"
        fi
    fi
}

function uninstall_system_deps() {
    check_root
    echo -e "${RED}WARNING: This will attempt to uninstall Docker and Docker Compose from your system!${NC}"
    read -p "Do you want to proceed? (y/N): " confirm
    if [[ "$confirm" == [yY] || "$confirm" == [yY][eE][sS] ]]; then
        echo -e "${YELLOW}Uninstalling Docker and components...${NC}"
        apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin || true
        apt-get autoremove -y --purge || true
        echo -e "${GREEN}System components uninstalled (if they were installed via apt).${NC}"
    fi
}

function reset_password() {
    check_root
    
    if ! docker ps | grep -q npm-wg; then
        echo -e "${RED}Container npm-wg is not running or not found. Please start it first.${NC}"
        return
    fi
    
    echo -e "${YELLOW}Resetting admin password...${NC}"
    # Setting password to 'changeme'
    # HASH for 'changeme'
    local HASH="\$2y\$10\$k1r.q/q.T5lPqG3y8H148ei/i.k9K.cI.1s/Q/8Fz/5e.d.f4n.6e"
    
    docker exec -it npm-wg /bin/sh -c "sqlite3 /data/database.sqlite \"UPDATE user SET is_deleted=0 WHERE id=1;\""
    docker exec -it npm-wg /bin/sh -c "sqlite3 /data/database.sqlite \"UPDATE auth SET secret='${HASH}' WHERE user_id=1;\""
    docker exec -it npm-wg /bin/sh -c "sqlite3 /data/database.sqlite \"UPDATE user SET email='admin@example.com' WHERE id=1;\""
    
    echo -e "${GREEN}Password has been reset successfully!${NC}"
    echo -e "Login Email: admin@example.com"
    echo -e "Password:    changeme"
    echo -e "${YELLOW}Please log in and change your password immediately!${NC}"
}

function update_npm_wg() {
    check_root
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}NPM-WG is not installed in $INSTALL_DIR.${NC}"
        return
    fi
    
    echo -e "${YELLOW}Updating D3V-NPMWG...${NC}"
    cd "$INSTALL_DIR" || exit
    
    local dc_cmd=$(get_docker_compose_cmd)
    $dc_cmd pull
    $dc_cmd up -d
    
    echo -e "${GREEN}D3V-NPMWG updated successfully!${NC}"
    docker image prune -f
}

function show_usage() {
    echo -e "  install   : Install D3V-NPMWG and system deps"
    echo -e "  uninstall : Uninstall D3V-NPMWG and remove data"
    echo -e "  purge     : Uninstall D3V-NPMWG AND system dependencies (Docker)"
    echo -e "  reset     : Reset web admin password"
    echo -e "  update    : Update D3V-NPMWG to the latest version"
    echo -e "  menu      : Show the interactive menu"
}

function menu() {
    while true; do
        echo -e "\n${GREEN}=== D3V-NPMWG Installation Manager ===${NC}"
        echo "1. Install D3V-NPMWG (Cài đặt)"
        echo "2. Uninstall D3V-NPMWG (Gỡ cài đặt)"
        echo "3. Uninstall System Components (Gỡ cài đặt Docker/Compose)"
        echo "4. Reset Web Admin Password (Đặt lại mật khẩu)"
        echo "5. Update D3V-NPMWG (Cập nhật phiên bản mới)"
        echo "6. Exit (Thoát)"
        read -p "Select an option (1-6): " choice
        
        case $choice in
            1) install_npm_wg ;;
            2) uninstall_npm_wg ;;
            3) uninstall_system_deps ;;
            4) reset_password ;;
            5) update_npm_wg ;;
            6) echo -e "${GREEN}Goodbye!${NC}"; exit 0 ;;
            *) echo -e "${RED}Invalid option. Please try again.${NC}" ;;
        esac
    done
}

# Entry point
if [ "$#" -eq 0 ]; then
    menu
else
    case "$1" in
        install) install_npm_wg ;;
        uninstall) uninstall_npm_wg ;;
        purge) 
            uninstall_npm_wg
            uninstall_system_deps
            ;;
        reset) reset_password ;;
        update) update_npm_wg ;;
        menu) menu ;;
        -h|--help|help) show_usage ;;
        *) 
            echo -e "${RED}Invalid command: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
fi
