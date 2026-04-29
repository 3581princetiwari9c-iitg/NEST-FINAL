const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('startups').insert({
    name: 'Test Startup',
    founder_name: 'Test',
    email: 'test@test.com',
    phone: '',
    website_url: '',
    category: 'Test',
    state: '',
    team_size: '',
    funding_raised: '',
    overview: '',
    status: 'pending'
  });
  console.log(error ? error.message : 'Success');
}

run();
