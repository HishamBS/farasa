#!/usr/bin/env bash
#
# Farasa - UI Components Library
# Progress bars, spinners, menus, and interactive prompts
#
# Dependencies: common-utils.sh must be sourced first

set -euo pipefail

# ============================================================================
# Guard: Prevent multiple sourcing
# ============================================================================
[[ -n "${UI_COMPONENTS_LOADED:-}" ]] && return 0
readonly UI_COMPONENTS_LOADED=1

_UI_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$_UI_LIB_DIR/common-utils.sh"

# ============================================================================
# Progress Bar Components
# ============================================================================

show_progress_bar() {
    local current=$1
    local total=$2
    local label=${3:-"Progress"}
    local width=${4:-50}

    if [[ $total -le 0 ]]; then
        return 0
    fi

    local percentage
    percentage=$(awk "BEGIN {printf \"%.1f\", ($current/$total)*100}")

    local filled
    filled=$(awk "BEGIN {printf \"%.0f\", ($current/$total)*$width}")

    local bar=""
    local i

    for ((i=0; i<filled; i++)); do
        bar+="█"
    done

    for ((i=filled; i<width; i++)); do
        bar+="░"
    done

    printf "\r${BRIGHT_CYAN}%-20s${RESET} [%s] ${BRIGHT_YELLOW}%6.1f%%${RESET} (%d/%d)" \
        "$label" "$bar" "$percentage" "$current" "$total"

    if [[ $current -eq $total ]]; then
        echo ""
    fi
}

format_duration() {
    local seconds=$1

    if [[ $seconds -lt 60 ]]; then
        echo "${seconds}s"
    elif [[ $seconds -lt 3600 ]]; then
        local minutes=$((seconds / 60))
        local secs=$((seconds % 60))
        echo "${minutes}m ${secs}s"
    else
        local hours=$((seconds / 3600))
        local minutes=$(((seconds % 3600) / 60))
        echo "${hours}h ${minutes}m"
    fi
}

# ============================================================================
# Spinner Components
# ============================================================================

SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

show_spinner() {
    local message=${1:-"Loading"}
    local delay=0.08

    local i=0
    while true; do
        printf "\r${BRIGHT_CYAN}%s${RESET} %s " "${SPINNER_FRAMES[$i]}" "$message"
        i=$(( (i + 1) % ${#SPINNER_FRAMES[@]} ))
        sleep "$delay"
    done
}

stop_spinner() {
    local pid=$1
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    printf "\r\033[K"
}

# Run a command with a spinner
# Usage: run_with_spinner "Building project" bun run build
run_with_spinner() {
    local message="$1"
    shift

    show_spinner "$message" &
    local spinner_pid=$!

    local exit_code=0
    "$@" > /tmp/farasa_cmd_output 2>&1 || exit_code=$?

    stop_spinner "$spinner_pid"

    if [[ $exit_code -eq 0 ]]; then
        print_success "$message"
    else
        print_error "$message failed"
        cat /tmp/farasa_cmd_output >&2
    fi

    rm -f /tmp/farasa_cmd_output
    return $exit_code
}

# ============================================================================
# Banner
# ============================================================================

show_banner() {
    local app_name=$1
    local version=${2:-""}

    echo ""
    printf "${BOLD}${BRIGHT_CYAN}"
    printf '%60s\n' '' | tr ' ' '═'
    if [[ -n $version ]]; then
        echo -e "  ${app_name} ${BRIGHT_YELLOW}${version}${BRIGHT_CYAN}"
    else
        echo "  ${app_name}"
    fi
    printf '%60s\n' '' | tr ' ' '═'
    printf "${RESET}"
    echo ""
}

# ============================================================================
# Confirmation Prompts
# ============================================================================

confirm_prompt() {
    local message=$1
    local default=${2:-n}

    local prompt
    if [[ $default == "y" ]]; then
        prompt="${message} [Y/n]: "
    else
        prompt="${message} [y/N]: "
    fi

    while true; do
        read -rp "$(echo -e "${BRIGHT_YELLOW}${prompt}${RESET}")" response

        if [[ -z $response ]]; then
            response=$default
        fi

        local response_lower
        response_lower=$(echo "$response" | tr '[:upper:]' '[:lower:]')

        case $response_lower in
            y|yes) return 0 ;;
            n|no) return 1 ;;
            *) print_error "Please answer yes or no." ;;
        esac
    done
}

# ============================================================================
# End of ui-components.sh
# ============================================================================
