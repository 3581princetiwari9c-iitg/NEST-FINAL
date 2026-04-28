-- NEST Cluster Supabase schema
-- Run this once in the Supabase SQL editor for project snkhepqpaxtfsrdtlkpx.
-- The current app is a static browser app using the anon key. These policies are
-- intentionally permissive so the existing dashboards work immediately. Tighten
-- them behind Supabase Auth/admin roles before production.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  full_name text not null,
  email text,
  phone text,
  role text not null check (role in ('startup', 'trainee', 'entrepreneur', 'artisan', 'admin')),
  organization text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tagline text,
  category text,
  program_type text,
  status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed')),
  location text,
  start_date date,
  end_date date,
  application_deadline date,
  duration text,
  participant_count text,
  fee text,
  description text,
  image_url text,
  brochure_url text,
  eligibility jsonb not null default '[]'::jsonb,
  selection_process jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  completion_details jsonb not null default '{}'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  founder_name text,
  email text,
  phone text,
  website_url text,
  category text,
  established_year text,
  state text,
  team_size text,
  funding_raised text,
  overview text,
  logo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid references public.profiles(id) on delete set null,
  seller_name text,
  seller_role text check (seller_role in ('startup', 'entrepreneur', 'artisan')),
  title text not null,
  category text,
  price numeric,
  stock integer,
  description text,
  image_url text,
  gallery_urls jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in (
    'user_registration',
    'startup_registration',
    'product_listing',
    'program_proposal',
    'newsletter_submission',
    'event_request'
  )),
  title text not null,
  requester_name text,
  requester_email text,
  requester_role text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  related_table text,
  related_id uuid,
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  month text,
  year integer,
  published_on date,
  excerpt text,
  content text,
  image_url text,
  pdf_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_stats (
  id text primary key,
  label text not null,
  value text not null,
  scope text not null default 'home',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  location text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mous (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  association_type text,
  objective text,
  document_url text,
  signed_on date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text not null,
  team_type text not null check (team_type in ('leadership', 'scientific', 'executive')),
  scientific_category text,
  image_url text,
  profile_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  pdf_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing-project compatibility.
-- create table if not exists does not update an old table shape, so these
-- migration-safe additions let the script run on a project that already had
-- partial NEST tables.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('startup', 'trainee', 'entrepreneur', 'artisan', 'admin'))
  not valid;

alter table public.profiles alter column id set default gen_random_uuid();
alter table public.programs alter column id set default gen_random_uuid();
alter table public.startups alter column id set default gen_random_uuid();
alter table public.marketplace_products alter column id set default gen_random_uuid();
alter table public.requests alter column id set default gen_random_uuid();
alter table public.newsletters alter column id set default gen_random_uuid();
alter table public.gallery_items alter column id set default gen_random_uuid();
alter table public.hubs alter column id set default gen_random_uuid();
alter table public.mous alter column id set default gen_random_uuid();
alter table public.team_members alter column id set default gen_random_uuid();
alter table public.notifications alter column id set default gen_random_uuid();

alter table public.profiles add column if not exists auth_user_id uuid;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists organization text;
alter table public.profiles add column if not exists status text default 'pending';
alter table public.profiles add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.programs add column if not exists title text;
alter table public.programs add column if not exists tagline text;
alter table public.programs add column if not exists category text;
alter table public.programs add column if not exists program_type text;
alter table public.programs add column if not exists status text default 'upcoming';
alter table public.programs add column if not exists location text;
alter table public.programs add column if not exists start_date date;
alter table public.programs add column if not exists end_date date;
alter table public.programs add column if not exists application_deadline date;
alter table public.programs add column if not exists duration text;
alter table public.programs add column if not exists participant_count text;
alter table public.programs add column if not exists fee text;
alter table public.programs add column if not exists description text;
alter table public.programs add column if not exists image_url text;
alter table public.programs add column if not exists brochure_url text;
alter table public.programs add column if not exists eligibility jsonb default '[]'::jsonb;
alter table public.programs add column if not exists selection_process jsonb default '[]'::jsonb;
alter table public.programs add column if not exists highlights jsonb default '[]'::jsonb;
alter table public.programs add column if not exists completion_details jsonb default '{}'::jsonb;
alter table public.programs add column if not exists published boolean default true;
alter table public.programs add column if not exists created_at timestamptz default now();
alter table public.programs add column if not exists updated_at timestamptz default now();

alter table public.startups add column if not exists name text;
alter table public.startups add column if not exists founder_name text;
alter table public.startups add column if not exists email text;
alter table public.startups add column if not exists phone text;
alter table public.startups add column if not exists website_url text;
alter table public.startups add column if not exists category text;
alter table public.startups add column if not exists established_year text;
alter table public.startups add column if not exists state text;
alter table public.startups add column if not exists team_size text;
alter table public.startups add column if not exists funding_raised text;
alter table public.startups add column if not exists overview text;
alter table public.startups add column if not exists logo_url text;
alter table public.startups add column if not exists status text default 'pending';
alter table public.startups add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.startups add column if not exists created_at timestamptz default now();
alter table public.startups add column if not exists updated_at timestamptz default now();

alter table public.marketplace_products add column if not exists title text;
alter table public.marketplace_products add column if not exists seller_profile_id uuid;
alter table public.marketplace_products add column if not exists seller_name text;
alter table public.marketplace_products add column if not exists seller_role text;
alter table public.marketplace_products add column if not exists category text;
alter table public.marketplace_products add column if not exists price numeric;
alter table public.marketplace_products add column if not exists stock integer;
alter table public.marketplace_products add column if not exists description text;
alter table public.marketplace_products add column if not exists image_url text;
alter table public.marketplace_products add column if not exists gallery_urls jsonb default '[]'::jsonb;
alter table public.marketplace_products add column if not exists status text default 'pending';
alter table public.marketplace_products add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.marketplace_products add column if not exists created_at timestamptz default now();
alter table public.marketplace_products add column if not exists updated_at timestamptz default now();

alter table public.requests add column if not exists request_type text;
alter table public.requests add column if not exists title text;
alter table public.requests add column if not exists requester_name text;
alter table public.requests add column if not exists requester_email text;
alter table public.requests add column if not exists requester_role text;
alter table public.requests add column if not exists status text default 'pending';
alter table public.requests add column if not exists related_table text;
alter table public.requests add column if not exists related_id uuid;
alter table public.requests add column if not exists payload jsonb default '{}'::jsonb;
alter table public.requests add column if not exists submitted_at timestamptz default now();
alter table public.requests add column if not exists updated_at timestamptz default now();

alter table public.newsletters add column if not exists title text;
alter table public.newsletters add column if not exists month text;
alter table public.newsletters add column if not exists year integer;
alter table public.newsletters add column if not exists published_on date;
alter table public.newsletters add column if not exists excerpt text;
alter table public.newsletters add column if not exists content text;
alter table public.newsletters add column if not exists image_url text;
alter table public.newsletters add column if not exists pdf_url text;
alter table public.newsletters add column if not exists status text default 'published';
alter table public.newsletters add column if not exists created_at timestamptz default now();
alter table public.newsletters add column if not exists updated_at timestamptz default now();

alter table public.site_stats add column if not exists label text;
alter table public.site_stats add column if not exists value text;
alter table public.site_stats add column if not exists scope text default 'home';
alter table public.site_stats add column if not exists sort_order integer default 0;
alter table public.site_stats add column if not exists updated_at timestamptz default now();

alter table public.gallery_items add column if not exists title text;
alter table public.gallery_items add column if not exists caption text;
alter table public.gallery_items add column if not exists image_url text;
alter table public.gallery_items add column if not exists sort_order integer default 0;
alter table public.gallery_items add column if not exists created_at timestamptz default now();
alter table public.gallery_items add column if not exists updated_at timestamptz default now();

alter table public.hubs add column if not exists name text;
alter table public.hubs add column if not exists category text;
alter table public.hubs add column if not exists location text;
alter table public.hubs add column if not exists description text;
alter table public.hubs add column if not exists status text default 'active';
alter table public.hubs add column if not exists created_at timestamptz default now();
alter table public.hubs add column if not exists updated_at timestamptz default now();

alter table public.mous add column if not exists partner_name text;
alter table public.mous add column if not exists association_type text;
alter table public.mous add column if not exists objective text;
alter table public.mous add column if not exists document_url text;
alter table public.mous add column if not exists signed_on date;
alter table public.mous add column if not exists status text default 'active';
alter table public.mous add column if not exists created_at timestamptz default now();
alter table public.mous add column if not exists updated_at timestamptz default now();

alter table public.team_members add column if not exists full_name text;
alter table public.team_members add column if not exists role_title text;
alter table public.team_members add column if not exists team_type text;
alter table public.team_members add column if not exists scientific_category text;
alter table public.team_members add column if not exists image_url text;
alter table public.team_members add column if not exists profile_url text;
alter table public.team_members add column if not exists sort_order integer default 0;
alter table public.team_members add column if not exists is_visible boolean default true;
alter table public.team_members add column if not exists created_at timestamptz default now();
alter table public.team_members add column if not exists updated_at timestamptz default now();

alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists text text;
alter table public.notifications add column if not exists pdf_url text;
alter table public.notifications add column if not exists is_active boolean default true;
alter table public.notifications add column if not exists sort_order integer default 0;
alter table public.notifications add column if not exists created_at timestamptz default now();
alter table public.notifications add column if not exists updated_at timestamptz default now();
update public.notifications
set title = coalesce(title, text, 'Notification')
where title is null;

create index if not exists idx_programs_status_date on public.programs(status, start_date);
create index if not exists idx_programs_published on public.programs(published) where published = true;
create index if not exists idx_startups_status on public.startups(status);
create index if not exists idx_products_status on public.marketplace_products(status);
create index if not exists idx_requests_status_type on public.requests(status, request_type);
create index if not exists idx_newsletters_status_year on public.newsletters(status, year desc);
create index if not exists idx_gallery_sort on public.gallery_items(sort_order, created_at desc);
create index if not exists idx_hubs_category on public.hubs(category);
create index if not exists idx_team_visible on public.team_members(team_type, scientific_category, is_visible);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at before update on public.programs
for each row execute function public.set_updated_at();

drop trigger if exists startups_set_updated_at on public.startups;
create trigger startups_set_updated_at before update on public.startups
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.marketplace_products;
create trigger products_set_updated_at before update on public.marketplace_products
for each row execute function public.set_updated_at();

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at before update on public.requests
for each row execute function public.set_updated_at();

drop trigger if exists newsletters_set_updated_at on public.newsletters;
create trigger newsletters_set_updated_at before update on public.newsletters
for each row execute function public.set_updated_at();

drop trigger if exists gallery_set_updated_at on public.gallery_items;
create trigger gallery_set_updated_at before update on public.gallery_items
for each row execute function public.set_updated_at();

drop trigger if exists hubs_set_updated_at on public.hubs;
create trigger hubs_set_updated_at before update on public.hubs
for each row execute function public.set_updated_at();

drop trigger if exists mous_set_updated_at on public.mous;
create trigger mous_set_updated_at before update on public.mous
for each row execute function public.set_updated_at();

drop trigger if exists team_set_updated_at on public.team_members;
create trigger team_set_updated_at before update on public.team_members
for each row execute function public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.startups enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.requests enable row level security;
alter table public.newsletters enable row level security;
alter table public.site_stats enable row level security;
alter table public.gallery_items enable row level security;
alter table public.hubs enable row level security;
alter table public.mous enable row level security;
alter table public.team_members enable row level security;
alter table public.notifications enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profiles',
    'programs',
    'startups',
    'marketplace_products',
    'requests',
    'newsletters',
    'site_stats',
    'gallery_items',
    'hubs',
    'mous',
    'team_members',
    'notifications'
  ] loop
    execute format('drop policy if exists "static site read %1$s" on public.%1$I', tbl);
    execute format('drop policy if exists "static site insert %1$s" on public.%1$I', tbl);
    execute format('drop policy if exists "static site update %1$s" on public.%1$I', tbl);
    execute format('drop policy if exists "static site delete %1$s" on public.%1$I', tbl);
    execute format('create policy "static site read %1$s" on public.%1$I for select using (true)', tbl);
    execute format('create policy "static site insert %1$s" on public.%1$I for insert with check (true)', tbl);
    execute format('create policy "static site update %1$s" on public.%1$I for update using (true) with check (true)', tbl);
    execute format('create policy "static site delete %1$s" on public.%1$I for delete using (true)', tbl);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('nest-assets', 'nest-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "static site read nest assets" on storage.objects;
create policy "static site read nest assets"
on storage.objects for select
using (bucket_id = 'nest-assets');

drop policy if exists "static site insert nest assets" on storage.objects;
create policy "static site insert nest assets"
on storage.objects for insert
with check (bucket_id = 'nest-assets');

drop policy if exists "static site update nest assets" on storage.objects;
create policy "static site update nest assets"
on storage.objects for update
using (bucket_id = 'nest-assets')
with check (bucket_id = 'nest-assets');

drop policy if exists "static site delete nest assets" on storage.objects;
create policy "static site delete nest assets"
on storage.objects for delete
using (bucket_id = 'nest-assets');

delete from public.programs
where title in (
  'Smart Agriculture and IoT Integration Cluster Formation',
  'Traditional Handloom Weaving and Natural Dyeing',
  'Bamboo Structural Design and Composite Product Development'
);

delete from public.startups
where name in ('EcoTech Innovations', 'GreenWave Solutions', 'Bamboo Craft Tech');

delete from public.marketplace_products
where title in ('Bamboo stick lamp', 'Ceramic vase set', 'Handwoven cotton rug');

delete from public.hubs
where name in ('IIT Guwahati', 'NIT Silchar', 'NECBDC', 'Ministry of MSME');

delete from public.mous
where partner_name in (
  'Indian Institute of Technology, Guwahati',
  'North East Small Finance Bank',
  'Ministry of MSME, Govt of India'
);

delete from public.newsletters
where title in ('Innovation Highlights', 'Startup Showcase');

delete from public.gallery_items
where title in ('Workshop Moment 1', 'Workshop Moment 2', 'Event Moment');

delete from public.team_members
where full_name in (
  'Prof. Devendra Jalihal',
  'Prof. Vimal Katiyar',
  'Prof. Rakhi Chaturvedi',
  'Dr. Sakshi Nangia'
);

delete from public.notifications
where text in (
  'NEST Cluster Progress Report 2025-26 is now live!',
  'New Incubation Cohort Applications opening soon!'
)
or title in (
  'Progress Report',
  'Incubation Applications'
);

delete from public.profiles
where email in (
  'admin@nest.test',
  'entrepreneur@nest.test',
  'artisan@nest.test',
  'startup@nest.test',
  'trainee@nest.test'
);

insert into public.profiles
  (full_name, email, role, organization, status, metadata)
values
  ('Demo Admin', 'admin@nest.test', 'admin', 'NEST Demo', 'approved', '{"demo_user": true, "testing_credential": true}'::jsonb),
  ('Demo Entrepreneur', 'entrepreneur@nest.test', 'entrepreneur', 'NEST Demo', 'approved', '{"demo_user": true, "testing_credential": true}'::jsonb),
  ('Demo Artisan', 'artisan@nest.test', 'artisan', 'NEST Demo', 'approved', '{"demo_user": true, "testing_credential": true}'::jsonb),
  ('Demo Startup Founder', 'startup@nest.test', 'startup', 'NEST Demo', 'approved', '{"demo_user": true, "testing_credential": true}'::jsonb),
  ('Demo Trainee', 'trainee@nest.test', 'trainee', 'NEST Demo', 'approved', '{"demo_user": true, "testing_credential": true}'::jsonb);

insert into public.site_stats (id, label, value, scope, sort_order)
values
  ('incubated-startups', 'Incubated Startups', '100+', 'home', 1),
  ('institutions', 'Institutions', '32+', 'home', 2),
  ('investments', 'Investments', '4.3 Cr+', 'home', 3),
  ('ne-beneficiaries', 'North-East Beneficiaries', '100+', 'home', 4)
on conflict (id) do nothing;

insert into public.programs
  (title, tagline, category, program_type, status, location, start_date, end_date, application_deadline, duration, participant_count, fee, description, image_url)
values
  ('Smart Agriculture and IoT Integration Cluster Formation', 'Sensors for resilient farms', 'Sustainable Tech', 'workshop', 'upcoming', 'Agri-Innovation Lab', '2026-05-15', '2026-05-25', '2026-05-01', '10 days', '15', 'Free', 'Developing smart solutions for local farmers through IoT sensors and automated irrigation systems.', 'https://images.unsplash.com/photo-1560415755-bd80d06eda60?w=800&auto=format&fit=crop&q=60'),
  ('Traditional Handloom Weaving and Natural Dyeing', 'Heritage craft training', 'Heritage Crafts', 'long', 'ongoing', 'Main Workshop Area', '2026-01-05', '2026-04-30', '2025-12-25', '4 months', '15', 'Free', 'Mastering the art of traditional Assamese weaving and extracting organic colors from local flora.', 'https://images.unsplash.com/photo-1582236815309-fa935fa7913e?w=800&auto=format&fit=crop&q=60'),
  ('Bamboo Structural Design and Composite Product Development', 'Bamboo product innovation', 'Bamboo Technologies', 'short', 'completed', 'NECBDC Campus', '2026-01-19', '2026-01-23', '2026-01-10', '5 days', '20', 'Free', 'A hands-on bamboo technology program covering structure, composite products, and design development.', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=60')
on conflict do nothing;

insert into public.startups
  (name, founder_name, website_url, category, established_year, state, funding_raised, overview, logo_url, status)
values
  ('EcoTech Innovations', 'NEST Founder', '#', 'Grassroots Technologies', '2022', 'Meghalaya', '25 lac', 'Local technology venture connected with the NEST innovation ecosystem.', 'https://placehold.co/300x120/ffffff/ff6b00?text=EcoTech', 'approved'),
  ('GreenWave Solutions', 'NEST Founder', '#', 'Grassroots Technologies', '2019', 'Arunachal Pradesh', '40 lac', 'Sustainable solutions venture from the North-East ecosystem.', 'https://placehold.co/300x120/ffffff/000000?text=GreenWave', 'approved'),
  ('Bamboo Craft Tech', 'NEST Founder', '#', 'Bamboo Innovation', '2024', 'Assam', '15 lac', 'Craft-led bamboo technology venture.', 'https://placehold.co/300x120/ffffff/2d5a3d?text=Bamboo', 'approved')
on conflict do nothing;

insert into public.marketplace_products
  (title, category, price, stock, description, image_url, status, seller_role, seller_name)
values
  ('Bamboo stick lamp', 'Bamboo and Cane', 1199, 12, 'Handcrafted bamboo lamp made by NEST artisans.', '/assets/marketplace/WhatsApp Image 2026-04-02 at 11.37.31.jpeg', 'approved', 'artisan', 'NEST Artisan'),
  ('Ceramic vase set', 'Pottery and Ceramics', 799, 20, 'Ceramic vase set from marketplace artisans.', '/assets/marketplace/WhatsApp Image 2026-04-02 at 11.46.31.jpeg', 'approved', 'artisan', 'NEST Artisan'),
  ('Handwoven cotton rug', 'Handloom and Textile', 4299, 5, 'Traditional handwoven cotton rug.', '/assets/marketplace/WhatsApp Image 2026-04-02 at 11.51.13.jpeg', 'approved', 'artisan', 'NEST Artisan')
on conflict do nothing;

insert into public.hubs (name, category, status)
values
  ('IIT Guwahati', 'State Universities', 'active'),
  ('NIT Silchar', 'NIT Network', 'active'),
  ('NECBDC', 'Industry Partner', 'active'),
  ('Ministry of MSME', 'Government Bodies', 'active')
on conflict do nothing;

insert into public.mous (partner_name, association_type, objective, status)
values
  ('Indian Institute of Technology, Guwahati', 'Institution', 'Research and ecosystem coordination', 'active'),
  ('North East Small Finance Bank', 'Body', 'Startup finance and market access', 'active'),
  ('Ministry of MSME, Govt of India', 'Government', 'Cluster development support', 'active')
on conflict do nothing;

insert into public.newsletters (title, month, year, published_on, excerpt, image_url, status)
values
  ('Innovation Highlights', 'December', 2026, '2026-12-05', 'Exploring breakthroughs in incubation and technology across the NEST ecosystem.', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80', 'published'),
  ('Startup Showcase', 'November', 2026, '2026-11-10', 'Meet emerging tech startups from the Northeast creating sustainability solutions.', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80', 'published')
on conflict do nothing;

insert into public.gallery_items (title, caption, image_url, sort_order)
values
  ('Workshop Moment 1', 'Two-day workshop moment', '/assets/programpic/2dayworkshop/20260110_042621649_iOS%201.jpg.jpeg', 1),
  ('Workshop Moment 2', 'Volunteer moment', '/assets/programpic/2dayworkshop/Volunteers%20Pics/MKS_0320.JPG.webp', 2),
  ('Event Moment', 'NEST event moment', '/assets/programpic/event1/WhatsApp%20Image%202025-11-13%20at%205.35.00%20PM.jpeg', 3)
on conflict do nothing;

insert into public.team_members
  (full_name, role_title, team_type, scientific_category, image_url, sort_order)
values
  ('Prof. Devendra Jalihal', 'Chairman of NEST Cluster', 'leadership', null, '/assets/images/teams/devandra.png', 1),
  ('Prof. Vimal Katiyar', 'Project Director, NEST Cluster', 'leadership', null, '/assets/images/teams/vimal.png', 2),
  ('Prof. Rakhi Chaturvedi', 'Project Director', 'scientific', 'grassroots', '/assets/logo/depositphotos_239470246-stock-illustration-user-sign-icon-person-symbol.jpg', 1),
  ('Dr. Sakshi Nangia', 'Manager Scientific Communications', 'executive', null, '/assets/logo/depositphotos_239470246-stock-illustration-user-sign-icon-person-symbol.jpg', 1)
on conflict do nothing;

insert into public.notifications (title, text, pdf_url, is_active, sort_order)
values
  ('Progress Report', 'NEST Cluster Progress Report 2025-26 is now live!', '/assets/docs/NEST_Report_2026.pdf', true, 1),
  ('Incubation Applications', 'New Incubation Cohort Applications opening soon!', '#', true, 2)
on conflict do nothing;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'programs',
    'startups',
    'marketplace_products',
    'requests',
    'newsletters',
    'site_stats',
    'gallery_items',
    'hubs',
    'mous',
    'team_members',
    'notifications'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
