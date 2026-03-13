#!/bin/bash
# Migration Runner - Opens Supabase Dashboard SQL Editor
# Date: 2026-03-13

SCRIPT_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="${PROJECT_DIR}/supabase/migrations"

# Project reference extracted from URL
PROJECT_REF="jmdwxymbgxwdsmcwbahp"

echo "
╔═══════════════════════════════════════════════════════════════════╗
║           AMASI Abstract Workflow - Database Migrations           ║
╚═══════════════════════════════════════════════════════════════════╝
"

# Migrations to run
MIGRATIONS=(
  "20260313_complete_abstract_workflow.sql"
  "20260313_abstract_drafts.sql"
)

echo "📋 Migrations to run:"
echo ""
for migration in "${MIGRATIONS[@]}"; do
  if [ -f "${MIGRATIONS_DIR}/${migration}" ]; then
    size=$(wc -l < "${MIGRATIONS_DIR}/${migration}" | tr -d ' ')
    echo "   ✓ ${migration} (${size} lines)"
  else
    echo "   ✗ ${migration} - NOT FOUND"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opening Supabase SQL Editor..."
echo ""

# Open Supabase Dashboard SQL Editor
open "https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"

echo "📝 Instructions:"
echo ""
echo "   1. The Supabase SQL Editor should open in your browser"
echo ""
echo "   2. Copy and paste the contents of EACH migration file:"
echo ""
for migration in "${MIGRATIONS[@]}"; do
  echo "      cat \"${MIGRATIONS_DIR}/${migration}\" | pbcopy"
  echo "      (Run this command, then paste in SQL Editor and click 'Run')"
  echo ""
done
echo ""
echo "   3. Alternatively, run both files in order using these commands:"
echo ""
echo "      # Migration 1: Complete Abstract Workflow"
echo "      cat \"${MIGRATIONS_DIR}/20260313_complete_abstract_workflow.sql\" | pbcopy"
echo ""
echo "      # Migration 2: Abstract Drafts"
echo "      cat \"${MIGRATIONS_DIR}/20260313_abstract_drafts.sql\" | pbcopy"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Copy first migration to clipboard
echo "📋 Copying first migration to clipboard..."
cat "${MIGRATIONS_DIR}/20260313_complete_abstract_workflow.sql" | pbcopy
echo "   ✅ Migration 1 copied! Paste it in the SQL Editor and click 'Run'"
echo ""
echo "   After running, press Enter to copy the second migration..."
read

cat "${MIGRATIONS_DIR}/20260313_abstract_drafts.sql" | pbcopy
echo "   ✅ Migration 2 copied! Paste it in the SQL Editor and click 'Run'"
echo ""
echo "✨ Done! Both migrations should now be applied."
