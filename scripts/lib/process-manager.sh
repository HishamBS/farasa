#!/usr/bin/env bash
#
# Farasa - Process Management Library
# PID tracking, cleanup, and lock management
#
# Purpose:
# - Persistent PID and Process Group tracking that survives shell crashes
# - Emergency cleanup utility for orphaned processes
# - 4-layer defense: PGID -> PID -> Port -> Pattern

# ============================================================================
# Guard: Prevent multiple sourcing
# ============================================================================
[[ -n "${PROCESS_MANAGER_LOADED:-}" ]] && return 0
readonly PROCESS_MANAGER_LOADED=1

# ============================================================================
# Constants (SSOT - Single Source of Truth for all ports)
# ============================================================================

# Persistent tracking directory
readonly FARASA_STATE_DIR="${HOME}/.farasa"
readonly FARASA_LOCK_FILE="${FARASA_STATE_DIR}/farasa.lock"
readonly FARASA_PIDS_FILE="${FARASA_STATE_DIR}/farasa.pids"
readonly FARASA_PGIDS_FILE="${FARASA_STATE_DIR}/farasa.pgids"

# Service port constants (SSOT)
readonly DEV_PORT=3000
readonly DRIZZLE_STUDIO_PORT=4983
readonly POSTGRES_PORT=5432
readonly ADMINER_PORT=8080

# Port groups
readonly FARASA_APP_PORTS=("$DEV_PORT" "$DRIZZLE_STUDIO_PORT")
readonly FARASA_INFRA_PORTS=("$POSTGRES_PORT" "$ADMINER_PORT")
readonly FARASA_ALL_PORTS=("$DEV_PORT" "$DRIZZLE_STUDIO_PORT" "$POSTGRES_PORT" "$ADMINER_PORT")

# Docker identifiers
readonly POSTGRES_CONTAINER="farasa-postgres"
readonly ADMINER_CONTAINER="farasa-adminer"
readonly APP_CONTAINER="farasa-app"

# Docker compose file paths (SSOT)
readonly COMPOSE_DEV_FILE="docker/docker-compose.dev.yml"
readonly COMPOSE_PROD_FILE="docker/docker-compose.yml"

# ============================================================================
# Initialization
# ============================================================================

init_process_tracking() {
    mkdir -p "${FARASA_STATE_DIR}"
    chmod 700 "${FARASA_STATE_DIR}"
}

clear_process_tracking() {
    rm -f "${FARASA_PIDS_FILE}" "${FARASA_PGIDS_FILE}" "${FARASA_LOCK_FILE}" 2>/dev/null || true
}

# ============================================================================
# Lock File Management
# ============================================================================

acquire_lock() {
    init_process_tracking

    if [[ -f "${FARASA_LOCK_FILE}" ]]; then
        local lock_pid
        lock_pid=$(cat "${FARASA_LOCK_FILE}" 2>/dev/null)

        if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
            print_warning "Farasa is already running (PID: $lock_pid)"
            return 1
        else
            rm -f "${FARASA_LOCK_FILE}"
        fi
    fi

    echo $$ > "${FARASA_LOCK_FILE}"
    return 0
}

release_lock() {
    rm -f "${FARASA_LOCK_FILE}" 2>/dev/null || true
}

# ============================================================================
# Process Registration
# ============================================================================

register_pid() {
    local pid=$1
    local name="${2:-service}"

    init_process_tracking

    local pgid
    pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ') || pgid=""

    echo "$pid:${pgid}:$name:$(date +%s)" >> "${FARASA_PIDS_FILE}"

    if [[ -n "$pgid" ]]; then
        echo "$pgid:$name" >> "${FARASA_PGIDS_FILE}"
    fi
}

start_tracked_background() {
    local name="$1"
    shift

    init_process_tracking

    "$@" &
    local pid=$!

    register_pid "$pid" "$name"

    echo "$pid"
}

# ============================================================================
# Cleanup Functions (4-Layer Defense)
# ============================================================================

kill_tracked_pgids() {
    local killed=0

    if [[ ! -f "${FARASA_PGIDS_FILE}" ]]; then
        return 0
    fi

    while IFS=: read -r pgid name; do
        [[ -z "$pgid" ]] && continue

        if kill -0 -"$pgid" 2>/dev/null; then
            echo "  Killing process group $pgid ($name)..."
            kill -TERM -"$pgid" 2>/dev/null || true
            ((killed++)) || true
        fi
    done < "${FARASA_PGIDS_FILE}"

    if [[ $killed -gt 0 ]]; then
        sleep 2

        while IFS=: read -r pgid name; do
            [[ -z "$pgid" ]] && continue
            if kill -0 -"$pgid" 2>/dev/null; then
                echo "  Force killing PGID $pgid..."
                kill -9 -"$pgid" 2>/dev/null || true
            fi
        done < "${FARASA_PGIDS_FILE}"
    fi

    return 0
}

kill_tracked_pids() {
    if [[ ! -f "${FARASA_PIDS_FILE}" ]]; then
        return 0
    fi

    while IFS=: read -r pid pgid name timestamp; do
        [[ -z "$pid" ]] && continue

        if kill -0 "$pid" 2>/dev/null; then
            echo "  Killing PID $pid ($name)..."
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done < "${FARASA_PIDS_FILE}"

    sleep 1

    while IFS=: read -r pid pgid name timestamp; do
        [[ -z "$pid" ]] && continue
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    done < "${FARASA_PIDS_FILE}"

    return 0
}

kill_by_app_ports() {
    local port
    for port in "${FARASA_APP_PORTS[@]}"; do
        local pids
        pids=$(lsof -ti:"$port" 2>/dev/null) || true

        if [[ -n "$pids" ]]; then
            echo "  Killing processes on port $port..."
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done

    return 0
}

kill_by_patterns() {
    local patterns=(
        "start.sh"
        "drizzle-kit"
    )

    local pattern
    for pattern in "${patterns[@]}"; do
        local pids
        pids=$(pgrep -f "$pattern" 2>/dev/null || true)

        if [[ -z "$pids" ]]; then
            continue
        fi

        local pid
        for pid in $pids; do
            local cmd
            cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
            if [[ "$cmd" =~ [Dd]ocker ]] || [[ "$cmd" =~ com\.docker ]]; then
                continue
            fi

            echo "  Killing PID $pid ($pattern)"
            kill -9 "$pid" 2>/dev/null || true
        done
    done

    return 0
}

# ============================================================================
# Main Cleanup Entry Points
# ============================================================================

emergency_cleanup_all() {
    echo ""
    echo "============================================================"
    echo "  Farasa EMERGENCY CLEANUP - 4-Layer Defense"
    echo "============================================================"
    echo ""

    echo "[Layer 1/4] Killing tracked process groups..."
    kill_tracked_pgids

    echo "[Layer 2/4] Killing tracked PIDs..."
    kill_tracked_pids

    echo "[Layer 3/4] Killing by app ports (${FARASA_APP_PORTS[*]})..."
    echo "  (Infrastructure ports ${FARASA_INFRA_PORTS[*]} are preserved)"
    kill_by_app_ports

    echo "[Layer 4/4] Killing by process patterns..."
    kill_by_patterns

    echo ""
    echo "Clearing tracking files..."
    clear_process_tracking

    echo ""
    echo "============================================================"
    echo "  CLEANUP COMPLETE"
    echo "============================================================"
    echo ""
}

graceful_cleanup() {
    trap - HUP INT TERM QUIT PIPE

    echo ""
    echo "Stopping services gracefully..."

    local docker_was_running=false

    local compose_file
    for compose_file in "${COMPOSE_DEV_FILE}" "${COMPOSE_PROD_FILE}"; do
        if [[ -f "$compose_file" ]] && docker compose -f "$compose_file" ps -q 2>/dev/null | grep -q .; then
            docker_was_running=true
            echo "Stopping Docker containers ($compose_file)..."
            docker compose -f "$compose_file" down --timeout 10 2>/dev/null || true
        fi
    done

    if [[ "$docker_was_running" == "false" ]]; then
        kill_tracked_pids

        local remaining=0
        local port
        for port in "${FARASA_APP_PORTS[@]}"; do
            if lsof -ti:"$port" > /dev/null 2>&1; then
                ((remaining++)) || true
            fi
        done

        if [[ $remaining -gt 0 ]]; then
            kill_by_app_ports
            kill_by_patterns
        fi
    else
        echo "Skipped native cleanup (Docker mode was active)"
    fi

    clear_process_tracking
    echo "Cleanup complete."

    exit 0
}

# ============================================================================
# Status and Diagnostics
# ============================================================================

show_tracked_processes() {
    echo "============================================================"
    echo "  Farasa Tracked Processes"
    echo "============================================================"

    if [[ -f "${FARASA_LOCK_FILE}" ]]; then
        echo "Lock holder: PID $(cat "${FARASA_LOCK_FILE}")"
    else
        echo "Lock holder: None"
    fi
    echo ""

    if [[ -f "${FARASA_PIDS_FILE}" ]]; then
        echo "Tracked PIDs:"
        while IFS=: read -r pid pgid name timestamp; do
            local status="DEAD"
            if kill -0 "$pid" 2>/dev/null; then
                status="ALIVE"
            fi
            echo "  [$status] PID=$pid PGID=${pgid} Name=$name"
        done < "${FARASA_PIDS_FILE}"
    else
        echo "No tracked PIDs"
    fi
    echo ""

    echo "Processes on ports:"
    local port
    for port in "${FARASA_ALL_PORTS[@]}"; do
        local procs
        procs=$(lsof -ti:"$port" 2>/dev/null | tr '\n' ' ') || true
        if [[ -n "$procs" ]]; then
            echo "  Port $port: PIDs $procs"
        fi
    done
    echo ""
}

# ============================================================================
# Trap Handler Setup
# ============================================================================

setup_cleanup_traps() {
    local cleanup_fn="${1:-graceful_cleanup}"
    trap "$cleanup_fn" HUP INT TERM QUIT PIPE
}

# ============================================================================
# Exports
# ============================================================================

export FARASA_STATE_DIR FARASA_PIDS_FILE FARASA_PGIDS_FILE FARASA_LOCK_FILE

# ============================================================================
# macOS setsid compatibility
# ============================================================================

if ! command -v setsid &> /dev/null; then
    setsid() {
        "$@" &
    }
fi

# ============================================================================
# End of process-manager.sh
# ============================================================================
