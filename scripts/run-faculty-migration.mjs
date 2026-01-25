import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

console.log('Connecting to Supabase:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sqlPath = path.join(__dirname, '../supabase/migrations/20260113_faculty_assignments.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('Running faculty_assignments migration...\n');

// Use the rpc to execute raw SQL
const { data, error } = await supabase.rpc('exec_raw_sql', { query: sql });

if (error) {
  console.log('Direct RPC not available, trying alternative method...');

  // Alternative: Make a direct REST call to execute SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_raw_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    console.log('\nThe migration needs to be run manually in the Supabase SQL Editor.');
    console.log('\nSteps:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Open your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste the contents of:');
    console.log('   supabase/migrations/20260113_faculty_assignments.sql');
    console.log('5. Click "Run" to execute the migration');
    console.log('\nAlternatively, run: npx supabase db push');
  } else {
    console.log('Migration executed successfully!');
  }
} else {
  console.log('Migration executed successfully!');
  console.log('Result:', data);
}
