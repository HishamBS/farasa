#!/usr/bin/env bash
#
# Farasa - Service Orchestration Library
# Native and Docker service management for Next.js + Postgres
#
# Dependencies: process-manager.sh and common-utils.sh must be sourced first

# ============================================================================
# Guard: Prevent multiple sourcing
# ============================================================================
[[ -n "${SERVICE_ORCHESTRATION_LOADED:-}" ]] && return 0
readonly SERVICE_ORCHESTRATION_LOADED=1

_ORCH_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$_ORCH_LIB_DIR/process-manager.sh"
source "$_ORCH_LIB_DIR/common-utils.sh"
source "$_ORCH_LIB_DIR/ui-components.sh"

# ============================================================================
# Health check timeouts (seconds)
# ============================================================================
readonly DEV_STARTUP_TIMEOUT=45
readonly POSTGRES_STARTUP_TIMEOUT=30
readonly DOCKER_APP_STARTUP_TIMEOUT=60
readonly DEV_SCHEMA_PREFLIGHT_LOG="logs/dev-schema-preflight.log"

# ============================================================================
# Dev Server (Next.js - native)
# ============================================================================

is_next_dev_process_running_on_dev_port() {
    local pids
    pids=$(lsof -ti:"$DEV_PORT" 2>/dev/null || true)
    [[ -n "$pids" ]] || return 1

    local pid
    for pid in $pids; do
        local cmd
        cmd=$(ps -o command= -p "$pid" 2>/dev/null || true)
        if [[ "$cmd" == *"next dev"* ]]; then
            return 0
        fi
    done

    return 1
}

start_service_dev() {
    print_section "Next.js Dev Server"

    if check_port_listening "$DEV_PORT"; then
        if is_next_dev_process_running_on_dev_port; then
            print_success "Dev server already running on :${DEV_PORT}"
            return 0
        fi

        print_error "Port :${DEV_PORT} is already in use by a non-dev process"
        print_info "Stop the process on :${DEV_PORT} before starting native dev mode"
        return 1
    fi

    ensure_directory "logs"

    print_step "Running database schema preflight (bun db:migrate)..."
    if ! bun db:migrate > "$DEV_SCHEMA_PREFLIGHT_LOG" 2>&1; then
        print_error "Schema preflight failed. Dev server start aborted."
        print_info "Review preflight log: $DEV_SCHEMA_PREFLIGHT_LOG"
        print_info "Fix database connectivity/migrations, then run: ./start.sh db:migrate"
        return 1
    fi
    print_success "Schema preflight passed"

    print_step "Starting dev server (bun dev)..."
    nohup bun dev > logs/dev.log 2>&1 < /dev/null &
    local pid=$!
    register_pid "$pid" "farasa-dev"

    print_info "Dev server starting (PID: $pid) — output → logs/dev.log"

    wait_for_port "$DEV_PORT" "Next.js dev server" "$DEV_STARTUP_TIMEOUT"
}

stop_service_dev() {
    print_section "Stopping Dev Server"
    if check_port_listening "$DEV_PORT"; then
        kill_port "$DEV_PORT"
        kill_tracked_pids
        print_success "Dev server stopped"
    else
        print_info "Dev server is not running"
    fi
}

follow_dev_logs() {
    ensure_directory "logs"
    print_info "Following dev server logs... (Ctrl+C to stop)"
    echo ""
    tail -f logs/dev.log 2>/dev/null | follow_log_as_farasa
}

# ============================================================================
# Postgres Service (Docker)
# ============================================================================

start_service_postgres_docker() {
    print_section "PostgreSQL (Docker)"

    if ! check_docker_running; then
        return 1
    fi

    if ! [[ -f "$COMPOSE_DEV_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_DEV_FILE"
        return 1
    fi

    if docker compose -f "$COMPOSE_DEV_FILE" ps --status running --services 2>/dev/null | grep -qx "postgres"; then
        print_success "PostgreSQL container already running"
        return 0
    fi

    print_step "Starting PostgreSQL container..."
    docker compose -f "$COMPOSE_DEV_FILE" up -d --remove-orphans postgres 2>&1 | follow_log_as_postgres

    print_step "Waiting for PostgreSQL to accept connections..."
    local i
    for ((i=1; i<=POSTGRES_STARTUP_TIMEOUT; i++)); do
        if docker compose -f "$COMPOSE_DEV_FILE" exec -T postgres pg_isready -U farasa_user -d farasa_db > /dev/null 2>&1; then
            print_success "PostgreSQL is ready on :${POSTGRES_PORT}"
            return 0
        fi

        if [[ $((i % 5)) -eq 0 ]]; then
            print_info "Still waiting... ($i/${POSTGRES_STARTUP_TIMEOUT}s)"
        fi
        sleep 1
    done

    print_error "PostgreSQL did not become ready in ${POSTGRES_STARTUP_TIMEOUT}s"
    return 1
}

stop_service_postgres_docker() {
    print_section "Stopping PostgreSQL"
    if [[ -f "$COMPOSE_DEV_FILE" ]] && docker compose -f "$COMPOSE_DEV_FILE" ps --status running --services 2>/dev/null | grep -qx "postgres"; then
        docker compose -f "$COMPOSE_DEV_FILE" stop postgres 2>/dev/null || true
        print_success "PostgreSQL stopped"
    else
        print_info "PostgreSQL container is not running"
    fi
}

follow_postgres_logs() {
    if ! [[ -f "$COMPOSE_DEV_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_DEV_FILE"
        return 1
    fi
    print_info "Following PostgreSQL logs... (Ctrl+C to stop)"
    echo ""
    docker compose -f "$COMPOSE_DEV_FILE" logs -f --tail=50 postgres 2>&1 | follow_log_as_postgres
}

# ============================================================================
# Drizzle Studio (native)
# ============================================================================

start_service_studio() {
    print_section "Drizzle Studio"

    if check_port_listening "$DRIZZLE_STUDIO_PORT"; then
        print_success "Drizzle Studio already running on :${DRIZZLE_STUDIO_PORT}"
        return 0
    fi

    ensure_directory "logs"

    print_step "Starting Drizzle Studio..."
    nohup bun db:studio > logs/studio.log 2>&1 < /dev/null &
    local studio_pid=$!
    register_pid "$studio_pid" "drizzle-studio"

    sleep 3

    if check_port_listening "$DRIZZLE_STUDIO_PORT"; then
        print_success "Drizzle Studio is ready → http://local.drizzle.studio"
    else
        print_info "Drizzle Studio starting in background → http://local.drizzle.studio"
    fi
}

stop_service_studio() {
    print_section "Stopping Drizzle Studio"
    if check_port_listening "$DRIZZLE_STUDIO_PORT"; then
        kill_port "$DRIZZLE_STUDIO_PORT"
        print_success "Drizzle Studio stopped"
    else
        print_info "Drizzle Studio is not running"
    fi
}

# ============================================================================
# Full Docker Stack
# ============================================================================

start_docker_stack() {
    print_header "Starting Farasa Full Docker Stack"

    if ! check_docker_running; then
        return 1
    fi

    if ! [[ -f "$COMPOSE_PROD_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_PROD_FILE"
        return 1
    fi

    if is_next_dev_process_running_on_dev_port; then
        print_info "Stopping native dev server to free :${DEV_PORT} for Docker mode..."
        stop_service_dev || return 1
    fi

    if check_port_listening "$DEV_PORT"; then
        print_error "Port :${DEV_PORT} is already in use"
        print_info "Stop the process on :${DEV_PORT} before starting Docker mode"
        return 1
    fi

    export COMPOSE_DOCKER_CLI_BUILD=1
    export DOCKER_BUILDKIT=1

    # Reset both dev/prod compose resources before starting a fresh production stack.
    docker compose -f "$COMPOSE_DEV_FILE" down --remove-orphans --timeout 10 >/dev/null 2>&1 || true
    docker compose -f "$COMPOSE_PROD_FILE" down --remove-orphans --timeout 10 >/dev/null 2>&1 || true

    print_step "Building and starting all containers..."
    if ! docker compose -f "$COMPOSE_PROD_FILE" up -d --build --remove-orphans; then
        print_error "Failed to start Docker stack"
        return 1
    fi

    print_step "Waiting for app to be ready..."
    wait_for_port "$DEV_PORT" "Farasa app" "$DOCKER_APP_STARTUP_TIMEOUT"
    print_success "Full Docker stack running → http://localhost:${DEV_PORT}"
}

stop_docker_stack() {
    print_header "Stopping Farasa Docker Stack"
    if [[ -f "$COMPOSE_PROD_FILE" ]]; then
        docker compose -f "$COMPOSE_PROD_FILE" down --remove-orphans --timeout 15
        print_success "Docker stack stopped"
    else
        print_warning "No Docker Compose file found"
    fi
}

follow_docker_logs() {
    if ! [[ -f "$COMPOSE_PROD_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_PROD_FILE"
        return 1
    fi
    print_info "Following Docker logs... (Ctrl+C to stop)"
    echo ""
    docker compose -f "$COMPOSE_PROD_FILE" logs -f --tail=50
}

# ============================================================================
# Hybrid Stack (Docker Postgres + Native Dev)
# ============================================================================

start_hybrid_stack() {
    print_header "Starting Farasa Hybrid Stack"
    print_info "Mode: Docker Postgres + Native Next.js dev server"
    echo ""

    start_service_postgres_docker || return 1
    echo ""

    if [[ ! -d "./drizzle" ]]; then
        print_info "First run — generating migrations from schema..."
        run_db_generate || return 1
        echo ""
    fi

    run_db_migrate || return 1
    echo ""

    start_service_dev || return 1

    echo ""
    print_success "Hybrid stack running!"
    echo ""
    echo -e "  ${BRIGHT_CYAN}App:${RESET}      http://localhost:${DEV_PORT}"
    echo -e "  ${BRIGHT_BLUE}Postgres:${RESET} localhost:${POSTGRES_PORT}"
    echo -e "  ${BRIGHT_GREEN}Adminer:${RESET}  http://localhost:${ADMINER_PORT}  (run with --adminer flag)"
    echo ""
}

stop_hybrid_stack() {
    print_header "Stopping Hybrid Stack"
    stop_service_dev
    stop_service_postgres_docker
}

# ============================================================================
# Database Commands (foreground, with spinner)
# ============================================================================

run_db_migrate() {
    print_section "Database Migrations"
    print_step "Running: bun db:migrate"
    echo ""
    bun db:migrate 2>&1 | follow_log_as_farasa
    print_success "Migrations complete"
}

run_db_generate() {
    print_section "Generate Migrations"
    print_step "Running: bun db:generate"
    echo ""
    bun db:generate 2>&1 | follow_log_as_farasa
    print_success "Migration files generated"
}

run_db_push() {
    print_section "Push Schema"
    print_step "Running: bun db:push"
    echo ""
    bun db:push 2>&1 | follow_log_as_farasa
    print_success "Schema pushed"
}

# ============================================================================
# Code Quality Commands (foreground)
# ============================================================================

run_type_check() {
    print_section "TypeScript Type Check"
    print_step "Running: bun type-check"
    echo ""
    local exit_code=0
    bun type-check 2>&1 | follow_log_as_tsc || exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        print_success "Type check passed"
    else
        print_error "Type check failed"
    fi
    return $exit_code
}

run_lint() {
    print_section "ESLint"
    print_step "Running: bun lint"
    echo ""
    local exit_code=0
    bun lint 2>&1 | follow_log_as_lint || exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        print_success "Lint passed"
    else
        print_error "Lint failed"
    fi
    return $exit_code
}

run_build() {
    print_section "Production Build"
    print_step "Running: bun run build"
    echo ""

    local restart_dev_after_build=false
    if is_next_dev_process_running_on_dev_port; then
        print_warning "Detected an active dev server on :${DEV_PORT}; stopping it before build"
        stop_service_dev || return 1
        restart_dev_after_build=true
    fi

    local exit_code=0
    bun run build 2>&1 | follow_log_as_build || exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        print_success "Build complete"
    else
        print_error "Build failed"
    fi

    if [[ "$restart_dev_after_build" == "true" ]]; then
        echo ""
        print_step "Restarting dev server after build..."
        if ! start_service_dev; then
            print_warning "Dev server restart failed; start it manually with ./start.sh dev"
        fi
    fi

    return $exit_code
}

# ============================================================================
# Environment Validation
# ============================================================================

validate_env() {
    print_section "Environment Validation"

    local env_file="${SCRIPT_DIR:-.}/.env"
    local missing=0

    if [[ ! -f "$env_file" ]]; then
        print_error ".env file not found at $env_file"
        print_info "Copy .env.example to .env and fill in your credentials:"
        print_info "  cp .env.example .env"
        return 1
    fi

    print_success ".env file found"

    # Required variables
    local required_vars=(
        "AUTH_SECRET"
        "AUTH_GOOGLE_ID"
        "AUTH_GOOGLE_SECRET"
        "OPENROUTER_API_KEY"
        "DATABASE_URL"
    )

    local var
    for var in "${required_vars[@]}"; do
        local value
        value=$(grep -E "^${var}=" "$env_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

        if [[ -z "$value" ]]; then
            print_error "Missing or empty: $var"
            ((missing++)) || true
        else
            print_success "  ${var} is set"
        fi
    done

    # Optional variables
    local optional_vars=(
        "TAVILY_API_KEY"
        "GCS_BUCKET_NAME"
        "GCS_PROJECT_ID"
        "NEXT_PUBLIC_APP_URL"
    )

    echo ""
    print_info "Optional variables:"
    for var in "${optional_vars[@]}"; do
        local value
        value=$(grep -E "^${var}=" "$env_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')

        if [[ -z "$value" ]]; then
            print_warning "  ${var} not set (optional)"
        else
            print_success "  ${var} is set"
        fi
    done

    echo ""

    if [[ $missing -gt 0 ]]; then
        print_error "$missing required variable(s) are missing"
        return 1
    else
        print_success "All required environment variables are set"
        return 0
    fi
}

# ============================================================================
# Service Status
# ============================================================================

show_service_status() {
    print_header "Service Status"

    echo ""
    echo -e "${BOLD}Native Services:${RESET}"

    local dev_status
    local studio_status
    if check_port_listening "$DEV_PORT"; then
        dev_status="${BRIGHT_GREEN}● Running${RESET} → http://localhost:${DEV_PORT}"
    else
        dev_status="${DIM}○ Stopped${RESET}"
    fi

    if check_port_listening "$DRIZZLE_STUDIO_PORT"; then
        studio_status="${BRIGHT_GREEN}● Running${RESET} → http://local.drizzle.studio"
    else
        studio_status="${DIM}○ Stopped${RESET}"
    fi

    echo -e "  Next.js dev  (${DEV_PORT}):    $(echo -e "$dev_status")"
    echo -e "  Drizzle Studio (${DRIZZLE_STUDIO_PORT}): $(echo -e "$studio_status")"
    echo ""

    echo -e "${BOLD}Docker Containers:${RESET}"
    if check_docker_running 2>/dev/null; then
        local postgres_status
        local adminer_status
        if [[ -f "$COMPOSE_DEV_FILE" ]] && docker compose -f "$COMPOSE_DEV_FILE" ps --status running --services 2>/dev/null | grep -qx "postgres"; then
            postgres_status="${BRIGHT_GREEN}● Running${RESET} → localhost:${POSTGRES_PORT}"
        else
            postgres_status="${DIM}○ Stopped${RESET}"
        fi

        if [[ -f "$COMPOSE_DEV_FILE" ]] && docker compose -f "$COMPOSE_DEV_FILE" ps --status running --services 2>/dev/null | grep -qx "adminer"; then
            adminer_status="${BRIGHT_GREEN}● Running${RESET} → http://localhost:${ADMINER_PORT}"
        else
            adminer_status="${DIM}○ Stopped${RESET}"
        fi

        echo -e "  PostgreSQL:                $(echo -e "$postgres_status")"
        echo -e "  Adminer:                   $(echo -e "$adminer_status")"
    else
        echo -e "  ${DIM}Docker not running${RESET}"
    fi
    echo ""
}

# ============================================================================
# Stop All Services (Docker-aware)
# ============================================================================

stop_all() {
    print_header "Stopping All Services"

    local docker_was_running=false

    if check_docker_running 2>/dev/null; then
        local compose_file
        for compose_file in "$COMPOSE_DEV_FILE" "$COMPOSE_PROD_FILE"; do
            if [[ -f "$compose_file" ]]; then
                print_step "Stopping Docker containers ($compose_file)..."
                docker compose -f "$compose_file" down --remove-orphans --timeout 10 2>/dev/null || true
                docker_was_running=true
            fi
        done
    fi

    if [[ "$docker_was_running" == "false" ]]; then
        stop_service_dev
        stop_service_studio
    else
        print_info "Skipped native cleanup (Docker mode was active)"
        stop_service_dev
        stop_service_studio
    fi

    print_success "All services stopped"
}

# ============================================================================
# End of service-orchestration.sh
# ============================================================================
