#!/bin/bash
# Post-merge setup: runs automatically after a task branch is merged.
# Keep idempotent, non-interactive, and fast.
set -e

npm install --no-audit --no-fund
# SQL migrations in ./migrations run automatically at server startup,
# so no explicit migration step is needed here.
