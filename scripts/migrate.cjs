const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!serviceKey);

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../supabase/migrations/20260113_faculty_assignments.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('SQL file loaded, size:', sql.length, 'bytes');
console.log('\nTo run this migration, please:');
console.log('1. Go to: https://supabase.com/dashboard/project/jmdwxymbgxwdsmcwbahp/sql');
console.log('2. Paste the SQL from: supabase/migrations/20260113_faculty_assignments.sql');
console.log('3. Click "Run" to execute\n');

// Try to execute via API
const https = require('https');
const url = new URL(supabaseUrl);

// First, let's test if we can query the database
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, serviceKey);

async function testConnection() {
  const { data, error } = await supabase.from('events').select('count').limit(1);
  if (error) {
    console.log('Connection test failed:', error.message);
  } else {
    console.log('Connection successful! Database is accessible.');
  }
}

async function checkTableExists() {
  const { data, error } = await supabase.from('faculty_assignments').select('count').limit(1);
  if (error && error.message.includes('does not exist')) {
    console.log('\nTable faculty_assignments does not exist yet.');
    console.log('Please run the migration SQL in the Supabase dashboard.\n');
    return false;
  } else if (error) {
    console.log('Error checking table:', error.message);
    return false;
  } else {
    console.log('\nTable faculty_assignments already exists!');
    return true;
  }
}

testConnection()
  .then(() => checkTableExists())
  .catch(e => console.log('Error:', e.message));
