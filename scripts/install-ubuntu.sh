#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-asprisawi}"
APP_USER="${APP_USER:-asprisawi}"
APP_DIR="${APP_DIR:-/opt/asprisawi}"
SERVICE_NAME="${SERVICE_NAME:-asprisawi}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PNPM_VERSION="${PNPM_VERSION:-10.33.3}"
INSTALL_SERVICE="${INSTALL_SERVICE:-true}"
REGISTER_COMMANDS="${REGISTER_COMMANDS:-false}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[%s] %s\n' "$APP_NAME" "$*"
}

fail() {
  printf '[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

sudo_cmd() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

run_as_app_user() {
  if [[ "${EUID}" -eq 0 ]] && command -v runuser >/dev/null 2>&1; then
    runuser -u "$APP_USER" -- "$@"
  else
    sudo -H -u "$APP_USER" "$@"
  fi
}

require_ubuntu_like() {
  [[ -r /etc/os-release ]] || fail 'This installer expects Ubuntu or another apt-based Linux distribution.'
  # shellcheck disable=SC1091
  . /etc/os-release

  case " ${ID:-} ${ID_LIKE:-} " in
    *' ubuntu '*|*' debian '*)
      ;;
    *)
      fail "Unsupported distribution: ${PRETTY_NAME:-unknown}. Use Ubuntu/Debian or install manually."
      ;;
  esac
}

install_base_packages() {
  log 'Installing system packages...'
  sudo_cmd apt-get update
  sudo_cmd apt-get install -y ca-certificates curl git rsync ffmpeg build-essential python3
}

node_is_compatible() {
  command -v node >/dev/null 2>&1 \
    && node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 11) ? 0 : 1);"
}

install_node() {
  if node_is_compatible; then
    log "Node.js $(node --version) is already compatible."
    return
  fi

  log "Installing Node.js ${NODE_MAJOR}.x from NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo_cmd bash -
  sudo_cmd apt-get install -y nodejs
  node_is_compatible || fail "Node.js installation did not provide version >= 20.11.0."
}

install_pnpm() {
  log "Enabling Corepack and pnpm ${PNPM_VERSION}..."
  sudo_cmd corepack enable
  sudo_cmd corepack prepare "pnpm@${PNPM_VERSION}" --activate
}

create_app_user() {
  if id "$APP_USER" >/dev/null 2>&1; then
    log "User ${APP_USER} already exists."
    return
  fi

  log "Creating system user ${APP_USER}..."
  sudo_cmd useradd --system --create-home --home-dir "/var/lib/${APP_USER}" --shell /usr/sbin/nologin "$APP_USER"
}

sync_app_files() {
  log "Installing app files to ${APP_DIR}..."
  sudo_cmd mkdir -p "$APP_DIR"
  sudo_cmd rsync -a --delete \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'node_modules' \
    "${REPO_ROOT}/" "${APP_DIR}/"

  if [[ ! -f "${APP_DIR}/.env" ]]; then
    sudo_cmd cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
    log "Created ${APP_DIR}/.env from .env.example. Edit it before starting the service."
  fi

  if [[ -x /usr/bin/ffmpeg ]] && ! sudo_cmd grep -q '^FFMPEG_PATH=' "${APP_DIR}/.env"; then
    printf '\nFFMPEG_PATH=/usr/bin/ffmpeg\n' | sudo_cmd tee -a "${APP_DIR}/.env" >/dev/null
  fi

  sudo_cmd chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
  sudo_cmd chmod 600 "${APP_DIR}/.env"
}

install_node_dependencies() {
  log 'Installing production dependencies...'
  run_as_app_user bash -lc "cd '${APP_DIR}' && corepack pnpm install --frozen-lockfile --prod"
  run_as_app_user bash -lc "cd '${APP_DIR}' && corepack pnpm run check"
}

write_systemd_service() {
  [[ "$INSTALL_SERVICE" == 'true' ]] || return

  log "Writing systemd service ${SERVICE_NAME}.service..."
  sudo_cmd tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<SERVICE
[Unit]
Description=Asprisawi Discord Music Bot
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=DOTENV_CONFIG_QUIET=true
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env corepack pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

  sudo_cmd systemctl daemon-reload
  sudo_cmd systemctl enable "${SERVICE_NAME}.service"
}

env_has_placeholders() {
  sudo_cmd grep -Eq 'put-your|your-bot-token|your-application-id|your-server-id' "${APP_DIR}/.env"
}

maybe_register_commands() {
  [[ "$REGISTER_COMMANDS" == 'true' ]] || return

  if env_has_placeholders; then
    log 'Skipping command registration because .env still contains placeholders.'
    return
  fi

  log 'Registering Discord slash commands...'
  run_as_app_user bash -lc "cd '${APP_DIR}' && corepack pnpm run register"
}

maybe_start_service() {
  [[ "$INSTALL_SERVICE" == 'true' ]] || return

  if env_has_placeholders; then
    log "Not starting ${SERVICE_NAME}.service because ${APP_DIR}/.env still contains placeholders."
    log "Edit ${APP_DIR}/.env, then run: sudo systemctl start ${SERVICE_NAME}"
    return
  fi

  log "Starting ${SERVICE_NAME}.service..."
  sudo_cmd systemctl restart "${SERVICE_NAME}.service"
}

main() {
  require_ubuntu_like
  install_base_packages
  install_node
  install_pnpm
  create_app_user
  sync_app_files
  install_node_dependencies
  write_systemd_service
  maybe_register_commands
  maybe_start_service

  log 'Install complete.'
  log "App directory: ${APP_DIR}"
  log "Service logs: sudo journalctl -u ${SERVICE_NAME} -f"
}

main "$@"
