#!/bin/bash
# Enhanced Migration Runner using Supabase REST API
# Date: 2026-03-13

set -e

# Load environment variables
ENV_FILE="$(dirname "$0")/../.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.local not found"
  exit 1
fi

# Extract values from .env.local
SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d '=' -f2-)
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '\n\r ')

# Extract project reference from URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | cut -d '.' -f1)

echo "🚀 Running database migrations..."
echo "   Project: $PROJECT_REF"
echo ""

MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"

# Function to run a migration
run_migration() {
  local file="$1"
  local name=$(basename "$file")

  if [ ! -f "$file" ]; then
    echo "⚠️  Skipping $name - file not found"
    return 0
  fi

  echo "📄 Running $name..."

  # Read SQL content
  SQL_CONTENT=$(cat "$file")

  # Create JSON payload
  JSON_PAYLOAD=$(jq -n --arg sql "$SQL_CONTENT" '{"query": $sql}')

  # Execute via Supabase REST API (PostgREST doesn't support raw SQL, so we use rpc)
  # Try the SQL endpoint if available
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"sql_query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" 2>/dev/null || echo "error")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "✅ $name - completed"
  else
    # Fallback: output instructions for manual execution
    echo "⚠️  $name - requires manual execution via Supabase Dashboard"
    echo "   HTTP Status: $HTTP_CODE"
    return 1
  fi
}

# Track results
SUCCESS=0
MANUAL=0

# Run migrations
for migration in "20260313_complete_abstract_workflow.sql" "20260313_abstract_drafts.sql"; do
  if run_migration "${MIGRATIONS_DIR}/${migration}"; then
    ((SUCCESS++))
  else
    ((MANUAL++))
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Migration process complete!"
echo "   ✅ Successful: $SUCCESS"
echo "   ⚠️  Manual required: $MANUAL"
echo ""

if [ $MANUAL -gt 0 ]; then
  echo "📋 To run migrations manually:"
  echo "   1. Go to https://supabase.com/dashboard/project/$PROJECT_REF/sql"
  echo "   2. Copy & paste each migration SQL file"
  echo "   3. Click 'Run'"
  echo ""
  echo "📁 Migration files location:"
  echo "   $MIGRATIONS_DIR"
fi
