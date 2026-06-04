#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE_DIR="${REPO_ROOT}/wp-content/plugins/custom-multi-step-form"
TARGET_DIR="${LOCAL_SITE_PLUGIN_DIR:-/Users/aigarspeda/Local Sites/janoga/app/public/wp-content/plugins/custom-multi-step-form}"
COMMAND="${1:-link}"

usage() {
    cat <<EOF
Usage:
  ./scripts/link-custom-multi-step-form-local.sh [link|status]

Our plugin:  custom-multi-step-form  →  "Custom Multi Step Form" in Plugins
Mondula:     multi-step-form         →  "Multi Step Form" by Mondula (different)

Optional:
  LOCAL_SITE_PLUGIN_DIR=/path/to/wp-content/plugins/custom-multi-step-form
EOF
}

show_paths() {
    echo "Source: ${SOURCE_DIR}"
    echo "Target: ${TARGET_DIR}"
}

status() {
    show_paths

    if [ -L "${TARGET_DIR}" ]; then
        local current_target
        current_target="$(readlink "${TARGET_DIR}")"
        echo "Status: symlink"
        echo "Points to: ${current_target}"

        if [ "${current_target}" = "${SOURCE_DIR}" ]; then
            echo "Result: linked to this repo"
        else
            echo "Result: linked somewhere else"
        fi
        return 0
    fi

    if [ -e "${TARGET_DIR}" ]; then
        echo "Status: regular directory or file"
        echo "Result: not linked"
        return 0
    fi

    echo "Status: missing"
    echo "Result: target does not exist yet"
}

link_target() {
    local backup_dir

    show_paths

    if [ ! -d "${SOURCE_DIR}" ]; then
        echo "Error: source plugin directory does not exist."
        exit 1
    fi

    mkdir -p "$(dirname "${TARGET_DIR}")"

    if [ -L "${TARGET_DIR}" ]; then
        local current_target
        current_target="$(readlink "${TARGET_DIR}")"

        if [ "${current_target}" = "${SOURCE_DIR}" ]; then
            echo "Symlink already points to this repo. Nothing to do."
            exit 0
        fi
    fi

    if [ -e "${TARGET_DIR}" ] || [ -L "${TARGET_DIR}" ]; then
        backup_dir="${TARGET_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
        mv "${TARGET_DIR}" "${backup_dir}"
        echo "Backed up existing target to:"
        echo "  ${backup_dir}"
    fi

    ln -s "${SOURCE_DIR}" "${TARGET_DIR}"
    echo "Created symlink."
    status
}

case "${COMMAND}" in
    link)
        link_target
        ;;
    status)
        status
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac
