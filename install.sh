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
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker is not installed. Installing Docker...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${YELLOW}Docker Compose is not installed. Please install Docker Compose first.${NC}"
        exit 1
    fi
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

    read -p "Enter your server's public IP or Domain for WireGuard (WG_HOST): " WG_HOST
    if [ -z "$WG_HOST" ]; then
        echo -e "${RED}WG_HOST cannot be empty. Aborting.${NC}"
        return
    fi

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

    echo -e "${GREEN}Docker compose file created at $DOCKER_COMPOSE_YML${NC}"
    cd "$INSTALL_DIR" || exit
    
    local dc_cmd=$(get_docker_compose_cmd)
    $dc_cmd up -d
    
    echo -e "${GREEN}NPM-WG installed and started successfully!${NC}"
    echo -e "${YELLOW}Web UI: http://<your-ip>:81${NC}"
    echo -e "Wait a minute for the first boot, then follow the setup wizard on the Web UI to create your admin account."
}

function uninstall_npm_wg() {
    check_root
    echo -e "${RED}WARNING: This will completely remove NPM-WG and all its data!${NC}"
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" == [yY] || "$confirm" == [yY][eE][sS] ]]; then
        if [ -d "$INSTALL_DIR" ]; then
            cd "$INSTALL_DIR" || exit
            local dc_cmd=$(get_docker_compose_cmd)
            $dc_cmd down -v
            cd /
            rm -rf "$INSTALL_DIR"
            echo -e "${GREEN}NPM-WG uninstalled completely.${NC}"
        else
            echo -e "${YELLOW}NPM-WG is not installed in $INSTALL_DIR.${NC}"
        fi
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
    
    echo -e "${YELLOW}Updating NPM-WG...${NC}"
    cd "$INSTALL_DIR" || exit
    
    local dc_cmd=$(get_docker_compose_cmd)
    $dc_cmd pull
    $dc_cmd up -d
    
    echo -e "${GREEN}NPM-WG updated successfully!${NC}"
    docker image prune -f
}

function show_usage() {
    echo -e "Usage: $0 {install|uninstall|reset|update|menu}"
    echo -e "Commands:"
    echo -e "  install   : Install D3V-NPMWG"
    echo -e "  uninstall : Uninstall D3V-NPMWG and remove data"
    echo -e "  reset     : Reset web admin password"
    echo -e "  update    : Update D3V-NPMWG to the latest version"
    echo -e "  menu      : Show the interactive menu (default if no args provided)"
}

function menu() {
    while true; do
        echo -e "\n${GREEN}=== D3V-NPMWG Installation Manager ===${NC}"
        echo "1. Install D3V-NPMWG (Cài đặt)"
        echo "2. Uninstall D3V-NPMWG (Gỡ cài đặt)"
        echo "3. Reset Web Admin Password (Đặt lại mật khẩu)"
        echo "4. Update D3V-NPMWG (Cập nhật phiên bản mới)"
        echo "5. Exit (Thoát)"
        read -p "Select an option (1-5): " choice
        
        case $choice in
            1) install_npm_wg ;;
            2) uninstall_npm_wg ;;
            3) reset_password ;;
            4) update_npm_wg ;;
            5) echo -e "${GREEN}Goodbye!${NC}"; exit 0 ;;
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
