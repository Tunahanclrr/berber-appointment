-- ============================================================
-- BERBER RANDEVU - TEK SUPABASE KURULUM / FIX DOSYASI
-- Supabase Dashboard > SQL Editor icinde bu dosyanin tamamini calistir.
-- Eski SQL dosyalarinin yerine bunu kullan.
-- ============================================================

create extension if not exists pgcrypto;

-- Calisma saatleri ve WhatsApp ayari bu jsonb alanda tutulur.
alter table shops add column if not exists working_hours jsonb default '{
  "monday":    {"open": true,  "start": "09:00", "end": "20:00"},
  "tuesday":   {"open": true,  "start": "09:00", "end": "20:00"},
  "wednesday": {"open": true,  "start": "09:00", "end": "20:00"},
  "thursday":  {"open": true,  "start": "09:00", "end": "20:00"},
  "friday":    {"open": true,  "start": "09:00", "end": "20:00"},
  "saturday":  {"open": true,  "start": "10:00", "end": "18:00"},
  "sunday":    {"open": false, "start": "09:00", "end": "18:00"}
}'::jsonb;

create table if not exists employee_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees not null,
  session_token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Son eklenen randevulari ustte gostermek ve bildirimden gelen randevuyu takip etmek icin.
alter table appointments add column if not exists created_at timestamptz default now();
alter table appointments add column if not exists appointment_code text;
alter table appointments add column if not exists reminder_24h_sent_at timestamptz;
alter table appointments add column if not exists reminder_2h_sent_at timestamptz;
create index if not exists appointments_shop_created_at_idx on appointments(shop_id, created_at desc);
create unique index if not exists appointments_shop_code_idx on appointments(shop_id, appointment_code) where appointment_code is not null;
create index if not exists appointments_reminder_idx on appointments(appointment_date, status, reminder_24h_sent_at, reminder_2h_sent_at);

-- Musteri rehberi: randevu eklenirken hazir musteriler buradan aranir.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops not null,
  name text not null,
  phone text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists customers_shop_phone_idx on customers(shop_id, phone);
create index if not exists customers_shop_updated_at_idx on customers(shop_id, updated_at desc);

alter table customers enable row level security;

drop policy if exists "customers_public_select" on customers;
create policy "customers_public_select"
on customers for select
using (true);

drop policy if exists "customers_public_insert" on customers;
create policy "customers_public_insert"
on customers for insert
with check (true);

drop policy if exists "customers_public_update" on customers;
create policy "customers_public_update"
on customers for update
using (true)
with check (true);

update appointments
set appointment_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where appointment_code is null;

alter table appointments alter column appointment_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- Personel ozel calisma saatleri, mola ve izin altyapisi.
alter table employees add column if not exists working_hours jsonb;
alter table employees add column if not exists break_times jsonb default '[]'::jsonb;
alter table employees add column if not exists time_off jsonb default '[]'::jsonb;
alter table employees add column if not exists commission_rate numeric default 0 check (commission_rate >= 0 and commission_rate <= 100);

-- Gelir / gider ve tahsilat kayitlari.
create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops not null,
  employee_id uuid references employees,
  appointment_id uuid references appointments,
  transaction_date date not null default current_date,
  type text not null check (type in ('income', 'expense', 'employee_payment')),
  title text not null,
  amount numeric not null check (amount >= 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'iban', 'card', 'mixed', 'other')),
  cash_amount numeric not null default 0 check (cash_amount >= 0),
  iban_amount numeric not null default 0 check (iban_amount >= 0),
  card_amount numeric not null default 0 check (card_amount >= 0),
  balance_due numeric not null default 0 check (balance_due >= 0),
  notes text,
  created_at timestamptz default now()
);

create index if not exists financial_transactions_shop_date_idx on financial_transactions(shop_id, transaction_date desc);
create index if not exists financial_transactions_employee_idx on financial_transactions(employee_id, transaction_date desc);
alter table financial_transactions enable row level security;

drop policy if exists "financial_transactions_public_select" on financial_transactions;
create policy "financial_transactions_public_select" on financial_transactions for select using (true);
drop policy if exists "financial_transactions_public_insert" on financial_transactions;
create policy "financial_transactions_public_insert" on financial_transactions for insert with check (true);
drop policy if exists "financial_transactions_public_update" on financial_transactions;
create policy "financial_transactions_public_update" on financial_transactions for update using (true) with check (true);
drop policy if exists "financial_transactions_public_delete" on financial_transactions;
create policy "financial_transactions_public_delete" on financial_transactions for delete using (true);

-- PWA web push: personelin cihaz bildirim abonelikleri burada tutulur.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops not null,
  employee_id uuid references employees,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists push_subscriptions_shop_id_idx on push_subscriptions(shop_id);
create index if not exists push_subscriptions_employee_id_idx on push_subscriptions(employee_id);

alter table push_subscriptions enable row level security;

-- Canli dashboard: appointments degisince Supabase Realtime event gonderebilsin.
alter table appointments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table appointments;
  end if;
end;
$$;

-- Public booking ve staff PIN paneli auth user kullanmadigi icin okuma izinleri gerekir.
drop policy if exists "shops_public_select" on shops;
create policy "shops_public_select"
on shops for select
using (true);

drop policy if exists "employees_public_select" on employees;
create policy "employees_public_select"
on employees for select
using (true);

drop policy if exists "services_public_select" on services;
create policy "services_public_select"
on services for select
using (true);

drop policy if exists "employee_services_public_select" on employee_services;
create policy "employee_services_public_select"
on employee_services for select
using (true);

-- Personel bazli hizmet fiyat/sure override alani.
-- Bos birakilirsa services tablosundaki varsayilan sure/fiyat kullanilir.
alter table employee_services add column if not exists duration integer;
alter table employee_services add column if not exists price numeric;

drop policy if exists "appointments_public_select_slots" on appointments;
create policy "appointments_public_select_slots"
on appointments for select
using (true);

-- Staff PIN dashboard auth session kullanmadigi icin appointments okuma izni sarttir.
drop policy if exists "appointments_staff_dashboard_select" on appointments;
create policy "appointments_staff_dashboard_select"
on appointments for select
using (true);

drop policy if exists "appointments_public_insert" on appointments;
create policy "appointments_public_insert"
on appointments for insert
with check (true);

drop policy if exists "appointments_public_update" on appointments;
create policy "appointments_public_update"
on appointments for update
using (true)
with check (true);

drop policy if exists "appointments_public_delete" on appointments;
create policy "appointments_public_delete"
on appointments for delete
using (true);

-- Staff PIN paneli auth user kullanmadigi icin push aboneligi kaydedebilmelidir.
drop policy if exists "push_subscriptions_public_select" on push_subscriptions;
create policy "push_subscriptions_public_select"
on push_subscriptions for select
using (true);

drop policy if exists "push_subscriptions_public_insert" on push_subscriptions;
create policy "push_subscriptions_public_insert"
on push_subscriptions for insert
with check (true);

drop policy if exists "push_subscriptions_public_update" on push_subscriptions;
create policy "push_subscriptions_public_update"
on push_subscriptions for update
using (true)
with check (true);

drop policy if exists "push_subscriptions_public_delete" on push_subscriptions;
create policy "push_subscriptions_public_delete"
on push_subscriptions for delete
using (true);

-- Personel login
drop function if exists employee_login(uuid, text);

create or replace function employee_login(emp_id uuid, raw_pin text)
returns table(
  success boolean,
  session_token text,
  employee_name text,
  shop_id uuid,
  shop_name text,
  role text,
  expires_at timestamptz
) as $$
declare
  v_employee employees%rowtype;
  v_shop shops%rowtype;
  v_token text;
  v_expires timestamptz;
begin
  select * into v_employee
  from employees
  where id = emp_id
    and pin_hash = crypt(raw_pin, pin_hash)
    and is_active = true;

  if not found then
    return query select
      false::boolean,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::timestamptz;
    return;
  end if;

  select * into v_shop
  from shops
  where id = v_employee.shop_id;

  if not found then
    return query select
      false::boolean,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::timestamptz;
    return;
  end if;

  delete from employee_sessions es
  where es.employee_id = emp_id
    and es.expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + interval '8 hours';

  insert into employee_sessions(employee_id, session_token, expires_at)
  values (emp_id, v_token, v_expires);

  return query select
    true::boolean,
    v_token::text,
    v_employee.name::text,
    v_shop.id::uuid,
    v_shop.name::text,
    v_employee.role::text,
    v_expires::timestamptz;
end;
$$ language plpgsql security definer;

-- Dukkan sahibi personel PIN ayarlar.
drop function if exists set_employee_pin(uuid, text);

create or replace function set_employee_pin(emp_id uuid, raw_pin text)
returns void as $$
declare
  v_shop_id uuid;
  v_user_id uuid;
begin
  select shop_id into v_shop_id from employees where id = emp_id;

  if v_shop_id is null then
    raise exception 'Personel bulunamadi';
  end if;

  select owner_id into v_user_id from shops where id = v_shop_id;

  if v_user_id != auth.uid() then
    raise exception 'Yetkiniz yok';
  end if;

  update employees
  set pin_hash = crypt(raw_pin, gen_salt('bf', 4))
  where id = emp_id;
end;
$$ language plpgsql security definer;

drop function if exists employee_logout(text);

create or replace function employee_logout(p_token text)
returns void as $$
begin
  delete from employee_sessions where session_token = p_token;
end;
$$ language plpgsql security definer;

-- Staff dashboard: personel tokenina gore personelin dukkanindaki tum randevulari getirir.
drop function if exists employee_get_shop_appointments(text, date, date);

create or replace function employee_get_shop_appointments(
  p_token text,
  p_from date default current_date,
  p_to date default current_date + 30
)
returns table(
  id uuid,
  employee_id uuid,
  employee_name text,
  service_id uuid,
  customer_name text,
  customer_phone text,
  appointment_date date,
  start_time time,
  end_time time,
  status text,
  notes text,
  service_name text,
  service_price numeric
) as $$
declare
  v_shop_id uuid;
  v_employee_id uuid;
begin
  select e.shop_id, e.id
  into v_shop_id, v_employee_id
  from employee_sessions es
  join employees e on e.id = es.employee_id
  where es.session_token = p_token
    and es.expires_at > now()
    and e.is_active = true;

  if v_shop_id is null then
    raise exception 'Gecersiz veya suresi dolmus personel oturumu';
  end if;

  return query
  select
    a.id,
    a.employee_id,
    e.name::text,
    a.service_id,
    a.customer_name,
    a.customer_phone,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.status,
    a.notes,
    s.name::text,
    s.price
  from appointments a
  left join employees e on e.id = a.employee_id
  left join services s on s.id = a.service_id
  where a.shop_id = v_shop_id
    and a.employee_id = v_employee_id
    and a.appointment_date between p_from and p_to
  order by a.appointment_date, a.start_time;
end;
$$ language plpgsql security definer;

-- Geriye uyumluluk: sadece giris yapan personelin randevulari.
drop function if exists employee_get_appointments(text, date, date);

create or replace function employee_get_appointments(
  p_token text,
  p_from date default current_date,
  p_to date default current_date + 30
)
returns table(
  id uuid,
  customer_name text,
  customer_phone text,
  appointment_date date,
  start_time time,
  end_time time,
  status text,
  notes text,
  service_name text,
  service_price numeric
) as $$
declare
  v_employee_id uuid;
begin
  select es.employee_id
  into v_employee_id
  from employee_sessions es
  where es.session_token = p_token
    and es.expires_at > now();

  if v_employee_id is null then
    raise exception 'Gecersiz veya suresi dolmus personel oturumu';
  end if;

  return query
  select
    a.id,
    a.customer_name,
    a.customer_phone,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.status,
    a.notes,
    s.name::text,
    s.price
  from appointments a
  left join services s on s.id = a.service_id
  where a.employee_id = v_employee_id
    and a.appointment_date between p_from and p_to
  order by a.appointment_date, a.start_time;
end;
$$ language plpgsql security definer;

drop function if exists employee_update_appointment_status(text, uuid, text);

create or replace function employee_update_appointment_status(
  p_token text,
  p_appointment_id uuid,
  p_status text
)
returns void as $$
declare
  v_employee_id uuid;
  v_shop_id uuid;
begin
  if p_status not in ('confirmed', 'done', 'cancelled') then
    raise exception 'Gecersiz durum';
  end if;

  select es.employee_id, e.shop_id
  into v_employee_id, v_shop_id
  from employee_sessions es
  join employees e on e.id = es.employee_id
  where es.session_token = p_token
    and es.expires_at > now()
    and e.is_active = true;

  if v_employee_id is null or v_shop_id is null then
    raise exception 'Gecersiz veya suresi dolmus personel oturumu';
  end if;

  update appointments
  set status = p_status
  where id = p_appointment_id
    and shop_id = v_shop_id
    and (employee_id = v_employee_id or employee_id is null);

  if not found then
      raise exception 'Randevu bulunamadi';
    end if;
end;
$$ language plpgsql security definer;

-- Eski test PIN degerlerini guvenli hash'e cevirir.
update employees
set pin_hash = crypt('0000', gen_salt('bf', 4))
where pin_hash = 'sample' or pin_hash is null;
