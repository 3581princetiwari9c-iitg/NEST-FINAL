(function () {
  const SUPABASE_URL = 'https://snkhepqpaxtfsrdtlkpx.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNua2hlcHFwYXh0ZnNyZHRsa3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTQ5NjAsImV4cCI6MjA4OTE3MDk2MH0.OSOeDivBx9zn_jmJjkU_nFRPDuJ__l9durAA2zoCcog';

  if (!window.supabase) {
    console.error('Supabase SDK was not loaded before js/supabase-client.js');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });

  async function uploadFile(file, folder) {
    if (!file) return null;

    const cleanName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-');
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

    const { error } = await client.storage
      .from('nest-assets')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data } = client.storage.from('nest-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  window.NESTSupabase = {
    client,
    uploadFile,
    url: SUPABASE_URL
  };
})();
