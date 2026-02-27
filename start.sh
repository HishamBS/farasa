#!/usr/bin/env bash
#
# start.sh — Farasa Platform Management Script
#
# Interactive CLI for managing Farasa development services
#
# Usage:
#   ./start.sh                  Launch interactive menu
#   ./start.sh dev              Start dev server (native)
#   ./start.sh dev:hybrid       Start hybrid mode (Docker postgres + native dev)
#   ./start.sh dev:docker       Start full Docker stack
#   ./start.sh stop             Stop all services
#   ./start.sh status           Show service status
#   ./start.sh logs             Follow dev server logs
#   ./start.sh db:migrate       Run database migrations
#   ./start.sh db:generate      Generate migration files
#   ./start.sh db:push          Push schema to database
#   ./start.sh db:studio        Open Drizzle Studio
#   ./start.sh typecheck        Run TypeScript type check
#   ./start.sh lint             Run ESLint
#   ./start.sh build            Production build
#   ./start.sh validate         Validate environment variables
#   ./start.sh cleanup          Force cleanup all processes

# ============================================================================
# Strict Mode
# ============================================================================
set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
readonly VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LIB_DIR="$SCRIPT_DIR/scripts/lib"

# ============================================================================
# Source Libraries (order matters — dependencies first)
# ============================================================================

[[ -f "$LIB_DIR/common-utils.sh" ]] || {
    echo "ERROR: Missing scripts/lib/common-utils.sh" >&2
    exit 1
}
source "$LIB_DIR/common-utils.sh"

[[ -f "$LIB_DIR/ui-components.sh" ]] || {
    echo "ERROR: Missing scripts/lib/ui-components.sh" >&2
    exit 1
}
source "$LIB_DIR/ui-components.sh"

[[ -f "$LIB_DIR/process-manager.sh" ]] || {
    echo "ERROR: Missing scripts/lib/process-manager.sh" >&2
    exit 1
}
source "$LIB_DIR/process-manager.sh"

[[ -f "$LIB_DIR/service-orchestration.sh" ]] || {
    echo "ERROR: Missing scripts/lib/service-orchestration.sh" >&2
    exit 1
}
source "$LIB_DIR/service-orchestration.sh"

# ============================================================================
# Setup Cleanup Trap
# ============================================================================
setup_cleanup_traps "graceful_cleanup"

# ============================================================================
# Post-Start Prompt (interactive helper)
# ============================================================================

prompt_post_start() {
    echo ""
    print_success "Services started!"
    echo ""
    echo -e "  ${BRIGHT_YELLOW}l)${RESET} ${BRIGHT_GREEN}Follow logs${RESET} (colored, live)"
    echo -e "  ${BRIGHT_YELLOW}s)${RESET} Show status"
    echo -e "  ${BRIGHT_YELLOW}Enter)${RESET} Return to menu"
    echo ""
    read -rp "$(echo -e "${BRIGHT_MAGENTA}Choice: ${RESET}")" post_choice

    case $post_choice in
        [lL]) follow_dev_logs ;;
        [sS])
            show_service_status
            read -rp "Press Enter to continue..."
            ;;
        *) return ;;
    esac
}

# ============================================================================
# Follow Combined Logs (hybrid/docker mode)
# ============================================================================

follow_all_logs() {
    print_section "Following All Logs (Ctrl+C to stop)"
    echo ""

    ensure_directory "logs"

    # Follow dev log in background with color prefix
    if [[ -f "logs/dev.log" ]]; then
        tail -f logs/dev.log | follow_log_as_farasa &
        local dev_tail_pid=$!
    fi

    # Follow postgres via Docker if running
    if check_docker_running 2>/dev/null && \
       docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${POSTGRES_CONTAINER}$"; then
        docker compose -f "$COMPOSE_DEV_FILE" logs -f --tail=20 postgres 2>/dev/null \
            | follow_log_as_postgres &
        local pg_tail_pid=$!
    fi

    # Follow studio log if it exists
    if [[ -f "logs/studio.log" ]]; then
        tail -f logs/studio.log | follow_log_as_studio &
        local studio_tail_pid=$!
    fi

    # Wait for Ctrl+C
    trap "kill ${dev_tail_pid:-0} ${pg_tail_pid:-0} ${studio_tail_pid:-0} 2>/dev/null; trap - INT; return" INT
    wait
}

# ============================================================================
# Interactive Menu Functions
# ============================================================================

start_menu() {
    while true; do
        clear
        print_header "Start Services — Farasa"

        echo -e "  ${BRIGHT_YELLOW}1)${RESET} ${BOLD}Native Mode${RESET}          ${DIM}bun dev → http://localhost:${DEV_PORT}${RESET}"
        echo ""
        echo -e "  ${BRIGHT_YELLOW}2)${RESET} ${BOLD}Hybrid Mode${RESET}          ${DIM}Docker Postgres + native bun dev${RESET}"
        echo ""
        echo -e "  ${BRIGHT_YELLOW}3)${RESET} ${BOLD}Full Docker Mode${RESET}     ${DIM}Everything containerized (requires build)${RESET}"
        echo ""
        echo -e "  ${BRIGHT_YELLOW}0)${RESET} Back"
        echo ""

        read -rp "$(echo -e "${BRIGHT_MAGENTA}Choice [0-3]: ${RESET}")" choice

        case $choice in
            1)
                start_service_dev || true
                prompt_post_start
                ;;
            2)
                start_hybrid_stack || true
                prompt_post_start
                ;;
            3)
                start_docker_stack || true
                prompt_post_start
                ;;
            0) return ;;
            *) print_error "Invalid option"; sleep 1 ;;
        esac
    done
}

stop_menu() {
    print_header "Stop Services"

    if confirm_prompt "Stop all running services?" "y"; then
        stop_all
    else
        print_info "Operation cancelled"
    fi

    read -rp "Press Enter to continue..."
}

database_menu() {
    while true; do
        clear
        print_header "Database — Farasa"

        echo -e "  ${BRIGHT_YELLOW}1)${RESET} Run Migrations       ${DIM}bun db:migrate${RESET}"
        echo -e "  ${BRIGHT_YELLOW}2)${RESET} Generate Migrations  ${DIM}bun db:generate${RESET}"
        echo -e "  ${BRIGHT_YELLOW}3)${RESET} Push Schema          ${DIM}bun db:push${RESET}"
        echo -e "  ${BRIGHT_YELLOW}4)${RESET} Open Drizzle Studio  ${DIM}http://local.drizzle.studio${RESET}"
        echo -e "  ${BRIGHT_YELLOW}0)${RESET} Back"
        echo ""

        read -rp "$(echo -e "${BRIGHT_MAGENTA}Choice [0-4]: ${RESET}")" choice

        case $choice in
            1) run_db_migrate; read -rp "Press Enter to continue..." ;;
            2) run_db_generate; read -rp "Press Enter to continue..." ;;
            3) run_db_push; read -rp "Press Enter to continue..." ;;
            4)
                start_service_studio || true
                echo ""
                print_info "Drizzle Studio → http://local.drizzle.studio"
                read -rp "Press Enter to continue..."
                ;;
            0) return ;;
            *) print_error "Invalid option"; sleep 1 ;;
        esac
    done
}

quality_menu() {
    while true; do
        clear
        print_header "Code Quality — Farasa"

        echo -e "  ${BRIGHT_YELLOW}1)${RESET} Type Check           ${DIM}bun type-check${RESET}"
        echo -e "  ${BRIGHT_YELLOW}2)${RESET} Lint                 ${DIM}bun lint${RESET}"
        echo -e "  ${BRIGHT_YELLOW}3)${RESET} Production Build     ${DIM}bun run build${RESET}"
        echo -e "  ${BRIGHT_YELLOW}4)${RESET} All Checks           ${DIM}type-check + lint${RESET}"
        echo -e "  ${BRIGHT_YELLOW}0)${RESET} Back"
        echo ""

        read -rp "$(echo -e "${BRIGHT_MAGENTA}Choice [0-4]: ${RESET}")" choice

        case $choice in
            1) run_type_check || true; read -rp "Press Enter to continue..." ;;
            2) run_lint || true; read -rp "Press Enter to continue..." ;;
            3) run_build || true; read -rp "Press Enter to continue..." ;;
            4)
                run_type_check || true
                echo ""
                run_lint || true
                read -rp "Press Enter to continue..."
                ;;
            0) return ;;
            *) print_error "Invalid option"; sleep 1 ;;
        esac
    done
}

logs_menu() {
    while true; do
        clear
        print_header "Logs — Farasa"

        echo -e "  ${BRIGHT_YELLOW}1)${RESET} ${BRIGHT_GREEN}Follow Dev Server${RESET}     ${DIM}live, cyan prefix${RESET}"
        echo -e "  ${BRIGHT_YELLOW}2)${RESET} ${BRIGHT_BLUE}Follow Postgres${RESET}       ${DIM}live, blue prefix (Docker)${RESET}"
        echo -e "  ${BRIGHT_YELLOW}3)${RESET} ${BRIGHT_MAGENTA}Follow Studio${RESET}         ${DIM}live, magenta prefix${RESET}"
        echo -e "  ${BRIGHT_YELLOW}4)${RESET} Follow All Logs       ${DIM}all services combined${RESET}"
        echo -e "  ${BRIGHT_YELLOW}5)${RESET} Last 100 lines        ${DIM}dev server${RESET}"
        echo -e "  ${BRIGHT_YELLOW}0)${RESET} Back"
        echo ""

        read -rp "$(echo -e "${BRIGHT_MAGENTA}Choice [0-5]: ${RESET}")" choice

        case $choice in
            1) follow_dev_logs ;;
            2) follow_postgres_logs || true; read -rp "Press Enter to continue..." ;;
            3)
                ensure_directory "logs"
                print_info "Following Drizzle Studio logs... (Ctrl+C to stop)"
                tail -f logs/studio.log 2>/dev/null | follow_log_as_studio || print_warning "No studio log yet"
                ;;
            4) follow_all_logs ;;
            5)
                ensure_directory "logs"
                if [[ -f "logs/dev.log" ]]; then
                    tail -100 logs/dev.log | follow_log_as_farasa
                else
                    print_warning "No dev log found yet"
                fi
                read -rp "Press Enter to continue..."
                ;;
            0) return ;;
            *) print_error "Invalid option"; sleep 1 ;;
        esac
    done
}

advanced_menu() {
    while true; do
        clear
        print_header "Advanced — Farasa"

        echo -e "  ${BRIGHT_YELLOW}1)${RESET} Force Cleanup All Processes"
        echo -e "  ${BRIGHT_YELLOW}2)${RESET} Show Tracked Processes"
        echo -e "  ${BRIGHT_YELLOW}3)${RESET} Validate Environment"
        echo -e "  ${BRIGHT_YELLOW}4)${RESET} Start Adminer (DB GUI)"
        echo -e "  ${BRIGHT_YELLOW}0)${RESET} Back"
        echo ""

        read -rp "$(echo -e "${BRIGHT_MAGENTA}Choice [0-4]: ${RESET}")" choice

        case $choice in
            1)
                emergency_cleanup_all
                read -rp "Press Enter to continue..."
                ;;
            2)
                show_tracked_processes
                read -rp "Press Enter to continue..."
                ;;
            3)
                cd "$SCRIPT_DIR" || exit 1
                validate_env || true
                read -rp "Press Enter to continue..."
                ;;
            4)
                if check_docker_running; then
                    print_step "Starting Adminer..."
                    docker compose -f "$COMPOSE_DEV_FILE" up -d adminer 2>/dev/null || true
                    print_success "Adminer → http://localhost:${ADMINER_PORT}"
                    print_info "  Server: postgres | User: farasa_user | DB: farasa_db"
                fi
                read -rp "Press Enter to continue..."
                ;;
            0) return ;;
            *) print_error "Invalid option"; sleep 1 ;;
        esac
    done
}

# ============================================================================
# Main Menu
# ============================================================================

show_main_menu() {
    while true; do
        clear
        show_banner "Farasa" "v${VERSION}"

        echo -e "${BOLD}Development${RESET}"
        echo -e "${DIM}───────────${RESET}"
        echo -e "  ${BRIGHT_YELLOW}1)${RESET} ${BRIGHT_GREEN}Start Services${RESET}     ${DIM}native / hybrid / docker${RESET}"
        echo -e "  ${BRIGHT_YELLOW}2)${RESET} Stop All Services"
        echo -e "  ${BRIGHT_YELLOW}3)${RESET} Follow Logs          ${DIM}live colored output${RESET}"
        echo ""

        echo -e "${BOLD}Database${RESET}"
        echo -e "${DIM}────────${RESET}"
        echo -e "  ${BRIGHT_YELLOW}4)${RESET} Database Operations  ${DIM}migrate / generate / push / studio${RESET}"
        echo ""

        echo -e "${BOLD}Code Quality${RESET}"
        echo -e "${DIM}────────────${RESET}"
        echo -e "  ${BRIGHT_YELLOW}5)${RESET} Quality Checks       ${DIM}typecheck / lint / build${RESET}"
        echo ""

        echo -e "${BOLD}System${RESET}"
        echo -e "${DIM}──────${RESET}"
        echo -e "  ${BRIGHT_YELLOW}s)${RESET} Status"
        echo -e "  ${BRIGHT_YELLOW}v)${RESET} Validate Environment"
        echo -e "  ${BRIGHT_YELLOW}x)${RESET} Advanced"
        echo -e "  ${BRIGHT_YELLOW}0)${RESET} Exit"
        echo ""

        read -rp "$(echo -e "${BRIGHT_MAGENTA}Select option: ${RESET}")" choice

        case $choice in
            1) start_menu ;;
            2) stop_menu ;;
            3) logs_menu ;;
            4) database_menu ;;
            5) quality_menu ;;
            [sS])
                show_service_status
                read -rp "Press Enter to continue..."
                ;;
            [vV])
                cd "$SCRIPT_DIR" || exit 1
                validate_env || true
                read -rp "Press Enter to continue..."
                ;;
            [xX]) advanced_menu ;;
            0)
                echo ""
                print_info "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                sleep 1
                ;;
        esac
    done
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    cd "$SCRIPT_DIR" || exit 1

    init_process_tracking

    case "${1:-}" in
        dev)
            print_header "Starting Farasa (Native)"
            start_service_dev
            echo ""
            print_success "Dev server running → http://localhost:${DEV_PORT}"
            ;;
        dev:hybrid)
            start_hybrid_stack
            ;;
        dev:docker)
            start_docker_stack
            ;;
        stop)
            stop_all
            ;;
        status)
            show_service_status
            ;;
        logs)
            follow_dev_logs
            ;;
        db:migrate)
            run_db_migrate
            ;;
        db:generate)
            run_db_generate
            ;;
        db:push)
            run_db_push
            ;;
        db:studio)
            start_service_studio
            ;;
        typecheck|type-check)
            run_type_check
            ;;
        lint)
            run_lint
            ;;
        build)
            run_build
            ;;
        validate)
            validate_env
            ;;
        cleanup)
            emergency_cleanup_all
            ;;
        -h|--help|help)
            echo ""
            echo -e "${BOLD}Farasa${RESET} v${VERSION} — Development management script"
            echo ""
            echo -e "${BOLD}Usage:${RESET} ./start.sh [command]"
            echo ""
            echo -e "${BOLD}Development:${RESET}"
            echo "  dev              Start dev server (native, port ${DEV_PORT})"
            echo "  dev:hybrid       Start hybrid mode (Docker postgres + native dev)"
            echo "  dev:docker       Start full Docker stack"
            echo "  stop             Stop all services"
            echo "  status           Show service status"
            echo "  logs             Follow dev server logs (colored)"
            echo ""
            echo -e "${BOLD}Database:${RESET}"
            echo "  db:migrate       Run database migrations"
            echo "  db:generate      Generate migration files"
            echo "  db:push          Push schema to database"
            echo "  db:studio        Open Drizzle Studio (port ${DRIZZLE_STUDIO_PORT})"
            echo ""
            echo -e "${BOLD}Code Quality:${RESET}"
            echo "  typecheck        TypeScript type check"
            echo "  lint             ESLint"
            echo "  build            Production build"
            echo ""
            echo -e "${BOLD}System:${RESET}"
            echo "  validate         Validate .env configuration"
            echo "  cleanup          Force cleanup all processes"
            echo ""
            echo "Without arguments, launches interactive menu."
            echo ""
            ;;
        "")
            show_main_menu
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Run './start.sh --help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
