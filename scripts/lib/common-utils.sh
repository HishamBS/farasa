#!/usr/bin/env bash
#
# Farasa - Common Utilities Library
# Colors, logging, OS detection, and shared utilities
#
# Usage: source this file at the START of your main script

# ============================================================================
# Guard: Prevent multiple sourcing
# ============================================================================
[[ -n "${COMMON_UTILS_LOADED:-}" ]] && return 0
readonly COMMON_UTILS_LOADED=1

# ============================================================================
# Color Definitions (SSOT)
# ============================================================================

# Reset and modifiers
export RESET='\033[0m'
export BOLD='\033[1m'
export DIM='\033[2m'

# Standard colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[0;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export CYAN='\033[0;36m'

# Bright colors
export BRIGHT_RED='\033[0;91m'
export BRIGHT_GREEN='\033[0;92m'
export BRIGHT_YELLOW='\033[0;93m'
export BRIGHT_BLUE='\033[0;94m'
export BRIGHT_MAGENTA='\033[0;95m'
export BRIGHT_CYAN='\033[0;96m'
export BRIGHT_WHITE='\033[0;97m'

# Background colors
export BG_GREEN='\033[42m'
export BG_YELLOW='\033[43m'
export BG_RED='\033[41m'
export BLACK='\033[0;30m'

# ============================================================================
# Logging Functions
# ============================================================================

# Print a header banner (Unicode box-drawing)
print_header() {
    local text="$1"
    local width=60
    local text_len=${#text}
    local padding=$(( (width - text_len - 2) / 2 ))
    local right_pad=$(( width - padding - text_len - 1 ))

    echo ""
    echo -e "${BOLD}${BRIGHT_CYAN}╔$(printf '═%.0s' $(seq 1 $width))╗${RESET}"
    echo -e "${BOLD}${BRIGHT_CYAN}║$(printf ' %.0s' $(seq 1 $padding)) $text $(printf ' %.0s' $(seq 1 $right_pad))║${RESET}"
    echo -e "${BOLD}${BRIGHT_CYAN}╚$(printf '═%.0s' $(seq 1 $width))╝${RESET}"
    echo ""
}

# Print a section header (Unicode arrow)
print_section() {
    echo ""
    echo -e "${BOLD}${BRIGHT_BLUE}▶ $1${RESET}"
    echo -e "${DIM}──────────────────────────────────────────────────────${RESET}"
}

# Print success message (green checkmark)
print_success() {
    echo -e "${BRIGHT_GREEN}✓${RESET} $1"
}

# Print error message (red X)
print_error() {
    echo -e "${BRIGHT_RED}✗${RESET} $1" >&2
}

# Print warning message (yellow triangle)
print_warning() {
    echo -e "${BRIGHT_YELLOW}⚠${RESET} $1"
}

# Print info message (cyan i)
print_info() {
    echo -e "${BRIGHT_CYAN}ℹ${RESET} $1"
}

# Print step message (magenta arrow)
print_step() {
    echo -e "${BRIGHT_MAGENTA}➤${RESET} $1"
}

# ============================================================================
# Per-Service Colored Log Streaming (SSOT for log colors)
# ============================================================================

# Pipe stdin through this to prepend a colored service label per line
# Usage: tail -f logs/dev.log | color_prefix "$BRIGHT_CYAN" "[FARASA]"
color_prefix() {
    local color="$1"
    local prefix="$2"
    while IFS= read -r line; do
        echo -e "${color}${BOLD}${prefix}${RESET} $line"
    done
}

# Service-specific log followers
follow_log_as_farasa() {
    color_prefix "$BRIGHT_CYAN" "[FARASA  ]"
}

follow_log_as_postgres() {
    color_prefix "$BRIGHT_BLUE" "[POSTGRES]"
}

follow_log_as_studio() {
    color_prefix "$BRIGHT_MAGENTA" "[STUDIO  ]"
}

follow_log_as_tsc() {
    color_prefix "$BRIGHT_YELLOW" "[TSC     ]"
}

follow_log_as_lint() {
    color_prefix "$YELLOW" "[LINT    ]"
}

follow_log_as_build() {
    color_prefix "$BRIGHT_GREEN" "[BUILD   ]"
}

# ============================================================================
# OS Detection
# ============================================================================

detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            case "$ID" in
                ubuntu) echo "ubuntu" ;;
                debian) echo "debian" ;;
                rhel|centos|fedora) echo "rhel" ;;
                arch|manjaro) echo "arch" ;;
                *) echo "linux" ;;
            esac
        else
            echo "linux"
        fi
    else
        echo "unknown"
    fi
}

# ============================================================================
# Command Utilities
# ============================================================================

command_exists() {
    command -v "$1" &> /dev/null
}

# ============================================================================
# Port Utilities
# ============================================================================

check_port_free() {
    local port=$1
    if lsof -ti:"$port" > /dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

kill_port() {
    local port=$1
    if lsof -ti:"$port" > /dev/null 2>&1; then
        print_step "Killing process on port $port..."
        lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
        sleep 1
        print_success "Port $port freed"
    fi
}

check_port_listening() {
    local port=$1
    lsof -ti:"$port" > /dev/null 2>&1 || nc -z localhost "$port" 2>/dev/null
}

# ============================================================================
# Wait Utilities
# ============================================================================

wait_for_port() {
    local port=$1
    local name=$2
    local max_attempts=${3:-30}

    print_step "Waiting for $name on port $port..."

    local i
    for ((i=1; i<=max_attempts; i++)); do
        if check_port_listening "$port"; then
            print_success "$name is ready (port $port)"
            return 0
        fi

        if [ $((i % 5)) -eq 0 ]; then
            print_info "Still waiting... ($i/${max_attempts}s)"
        fi

        sleep 1
    done

    print_error "$name not ready after ${max_attempts}s"
    return 1
}

wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}

    print_step "Waiting for $name..."

    local i
    for ((i=1; i<=max_attempts; i++)); do
        if curl --max-time 2 -s "$url" > /dev/null 2>&1; then
            print_success "$name is healthy"
            return 0
        fi

        if [ $((i % 5)) -eq 0 ]; then
            print_info "Still waiting... ($i/${max_attempts}s)"
        fi

        sleep 1
    done

    print_error "$name did not become healthy after ${max_attempts}s"
    return 1
}

# ============================================================================
# Directory Utilities
# ============================================================================

ensure_directory() {
    local dir_path=$1
    if [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path"
        print_success "Created directory: $dir_path"
    fi
}

# ============================================================================
# Docker Utilities
# ============================================================================

check_docker_compose() {
    if command_exists docker && docker compose version &> /dev/null; then
        return 0
    fi
    return 1
}

check_docker_running() {
    if docker info &> /dev/null; then
        return 0
    fi
    print_error "Docker daemon is not running"
    print_info "Please start Docker Desktop or the Docker service"
    return 1
}

# ============================================================================
# End of common-utils.sh
# ============================================================================
