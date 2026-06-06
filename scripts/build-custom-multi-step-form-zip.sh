#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PLUGIN_SLUG="custom-multi-step-form"
PLUGIN_PARENT_DIR="${REPO_ROOT}/wp-content/plugins"
PLUGIN_DIR="${PLUGIN_PARENT_DIR}/${PLUGIN_SLUG}"
DEFAULT_OUTPUT_PATH="${REPO_ROOT}/${PLUGIN_SLUG}.zip"
OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"

usage() {
    cat <<EOF
Usage:
  ./scripts/build-custom-multi-step-form-zip.sh [output-zip-path]

Examples:
  ./scripts/build-custom-multi-step-form-zip.sh
  ./scripts/build-custom-multi-step-form-zip.sh /tmp/custom-multi-step-form.zip

Creates a WordPress-ready zip with folder name "${PLUGIN_SLUG}/" at the archive root.
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "help" ]; then
    usage
    exit 0
fi

if [ ! -d "${PLUGIN_DIR}" ]; then
    echo "Error: plugin directory not found: ${PLUGIN_DIR}"
    exit 1
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"
rm -f "${OUTPUT_PATH}"

(
    cd "${PLUGIN_PARENT_DIR}"
    zip -r "${OUTPUT_PATH}" "${PLUGIN_SLUG}" \
        -x "${PLUGIN_SLUG}/.DS_Store" \
        -x "${PLUGIN_SLUG}/**/.DS_Store" \
        -x "${PLUGIN_SLUG}/__MACOSX/*"
)

echo "Created plugin zip:"
echo "  ${OUTPUT_PATH}"
