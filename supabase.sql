-- =====================================================================
-- Schema كامل لقاعدة بيانات "سراقب ستور" (saraqib-user + saraqib-admin)
-- مُستخرج مباشرة من مشروع Supabase الحيّ (atjoruolwhlsnhlwejkb) عبر MCP
-- بتاريخ: 2026-11-02
-- الاستخدام: نفّذ هذا الملف كاملاً على مشروع Supabase جديد (SQL Editor)
--           لإنشاء نفس بنية قاعدة البيانات لمشروع مستنسخ.
-- ملاحظة: لا يحتوي بيانات (rows) — بنية فقط (DDL): جداول/قيود/فهارس/
--         دوال/Triggers/Materialized Views/سياسات RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Extensions المطلوبة
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- 2) Sequences (معرّفات تلقائية للجداول)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.activity_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.admin_accounts_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.admin_activity_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.admin_push_subscriptions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.admin_sessions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.api_activity_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.api_orders_log_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.api_token_categories_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.api_token_products_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.api_tokens_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.api_webhook_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.auto_charge_codes_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.auto_replies_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.banners_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.categories_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.currencies_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.currency_rate_history_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.daily_message_counts_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.device_fingerprints_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.email_verifications_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.inventory_delivery_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.inventory_groups_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.inventory_units_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.messages_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.offers_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.order_items_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.orders_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.payment_gateways_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.payment_methods_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.products_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.providers_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.push_subscriptions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.settings_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.shamcash_invoices_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.sub_admins_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.sub_sub_categories_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.subcategories_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.telegram_bot_settings_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.telegram_linking_codes_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.transactions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.user_sessions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.user_stats_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.users_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.voucher_uses_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.vouchers_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;

-- ---------------------------------------------------------------------
-- 3) الجداول (46 جدول)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  ip text,
  device text,
  location text,
  is_unusual boolean DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id bigint DEFAULT nextval('admin_accounts_id_seq'::regclass) NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  disabled boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id bigint DEFAULT nextval('admin_activity_logs_id_seq'::regclass) NOT NULL,
  admin_id text,
  action_type text NOT NULL,
  target_model text,
  target_id text,
  old_values jsonb,
  new_values jsonb,
  details text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_activity_logs_archive (
  id bigint NOT NULL,
  admin_id text,
  action_type text NOT NULL,
  target_model text,
  target_id text,
  old_values jsonb,
  new_values jsonb,
  details text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_notification_settings (
  admin_id text NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  categories jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id bigint DEFAULT nextval('admin_push_subscriptions_id_seq'::regclass) NOT NULL,
  admin_id text NOT NULL,
  subscription text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id bigint DEFAULT nextval('admin_sessions_id_seq'::regclass) NOT NULL,
  jti text NOT NULL,
  admin_label text,
  ip_address text,
  country text,
  city text,
  device text,
  browser text,
  user_agent text,
  is_current boolean DEFAULT true,
  revoked boolean DEFAULT false,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  last_active_at timestamp with time zone DEFAULT now(),
  target_id text
);

CREATE TABLE IF NOT EXISTS public.api_activity_logs (
  id bigint DEFAULT nextval('api_activity_logs_id_seq'::regclass) NOT NULL,
  token_id bigint,
  user_id bigint,
  method text,
  path text,
  status_code integer,
  ip_address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_orders_log (
  id integer DEFAULT nextval('api_orders_log_id_seq'::regclass) NOT NULL,
  token_id integer NOT NULL,
  order_uuid text NOT NULL,
  order_id integer,
  ip_address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_token_categories (
  id integer DEFAULT nextval('api_token_categories_id_seq'::regclass) NOT NULL,
  token_id integer NOT NULL,
  category_type text NOT NULL,
  category_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_token_products (
  id integer DEFAULT nextval('api_token_products_id_seq'::regclass) NOT NULL,
  token_id integer NOT NULL,
  product_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id integer DEFAULT nextval('api_tokens_id_seq'::regclass) NOT NULL,
  user_id integer NOT NULL,
  token text NOT NULL,
  name text,
  allowed_ips text[] DEFAULT '{}'::text[],
  enabled boolean DEFAULT true NOT NULL,
  scope text DEFAULT 'selected'::text NOT NULL,
  can_order boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  custom_discount_percent numeric
);

CREATE TABLE IF NOT EXISTS public.api_webhook_logs (
  id bigint DEFAULT nextval('api_webhook_logs_id_seq'::regclass) NOT NULL,
  url text NOT NULL,
  event text NOT NULL,
  payload text,
  status_code integer,
  success boolean DEFAULT false,
  error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.auto_charge_codes (
  id bigint DEFAULT nextval('auto_charge_codes_id_seq'::regclass) NOT NULL,
  code text NOT NULL,
  user_id bigint NOT NULL,
  payment_method_id bigint,
  gateway_code text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  transaction_id bigint,
  matched_amount numeric,
  matched_currency text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.auto_replies (
  id bigint DEFAULT nextval('auto_replies_id_seq'::regclass) NOT NULL,
  trigger_text character varying(255) NOT NULL,
  reply_text text NOT NULL,
  is_faq boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.banners (
  id bigint DEFAULT nextval('banners_id_seq'::regclass) NOT NULL,
  image_url text NOT NULL,
  link_url text,
  order_index integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.categories (
  id bigint DEFAULT nextval('categories_id_seq'::regclass) NOT NULL,
  name character varying(100) NOT NULL,
  image_url text,
  active boolean DEFAULT true NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  special_id character varying(100),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.currencies (
  id integer DEFAULT nextval('currencies_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  exchange_rate numeric NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.currency_rate_history (
  id integer DEFAULT nextval('currency_rate_history_id_seq'::regclass) NOT NULL,
  currency_id integer,
  currency_name text NOT NULL,
  currency_symbol text NOT NULL,
  old_rate numeric,
  new_rate numeric NOT NULL,
  change_type text DEFAULT 'updated'::text NOT NULL,
  changed_by text DEFAULT 'admin'::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.daily_message_counts (
  id bigint DEFAULT nextval('daily_message_counts_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  date date NOT NULL,
  count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id bigint DEFAULT nextval('device_fingerprints_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  fingerprint text NOT NULL,
  user_agent text,
  screen_info text,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id bigint DEFAULT nextval('email_verifications_id_seq'::regclass) NOT NULL,
  email character varying(255) NOT NULL,
  code character varying(10) NOT NULL,
  type character varying(20) DEFAULT 'verify'::character varying NOT NULL,
  used boolean DEFAULT false NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  user_id bigint,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_delivery_logs (
  id bigint DEFAULT nextval('inventory_delivery_logs_id_seq'::regclass) NOT NULL,
  order_id bigint,
  user_id bigint,
  product_id bigint,
  group_id bigint,
  unit_id bigint,
  content_snapshot text,
  delivered_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_groups (
  id bigint DEFAULT nextval('inventory_groups_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  category text DEFAULT ''::text,
  item_type text DEFAULT 'code'::text NOT NULL,
  description text DEFAULT ''::text,
  low_stock_threshold integer DEFAULT 5 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_units (
  id bigint DEFAULT nextval('inventory_units_id_seq'::regclass) NOT NULL,
  group_id bigint NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'available'::text NOT NULL,
  order_id bigint,
  delivered_user_id bigint,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.job_locks (
  job text NOT NULL,
  holder text,
  locked_until timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.maintenance_config (
  id integer DEFAULT 1 NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  allowed_ip text DEFAULT ''::text NOT NULL,
  developer_code text DEFAULT ''::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id bigint DEFAULT nextval('messages_id_seq'::regclass) NOT NULL,
  user_id bigint,
  guest_id character varying(100),
  sender_role character varying(20) DEFAULT 'user'::character varying NOT NULL,
  content text,
  image_url text,
  type character varying(30) DEFAULT 'text'::character varying NOT NULL,
  rating integer,
  is_read boolean DEFAULT false NOT NULL,
  chat_blocked boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id bigint DEFAULT nextval('notifications_id_seq'::regclass) NOT NULL,
  user_id bigint,
  title character varying(255) NOT NULL,
  message text NOT NULL,
  type character varying(30) DEFAULT 'info'::character varying NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.offers (
  id bigint DEFAULT nextval('offers_id_seq'::regclass) NOT NULL,
  title character varying(255) NOT NULL,
  description text,
  image_url text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  order_index integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id bigint DEFAULT nextval('order_items_id_seq'::regclass) NOT NULL,
  order_id bigint NOT NULL,
  product_id bigint,
  price_at_purchase numeric DEFAULT 0 NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  extra_data text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
  id bigint DEFAULT nextval('orders_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  total_amount numeric DEFAULT 0 NOT NULL,
  status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
  meta text,
  admin_response text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  refunded_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id bigint DEFAULT nextval('payment_gateways_id_seq'::regclass) NOT NULL,
  gateway_code text NOT NULL,
  gateway_name text NOT NULL,
  api_url text NOT NULL,
  api_key_enc text,
  is_active boolean DEFAULT false NOT NULL,
  last_test_at timestamp with time zone,
  last_test_ok boolean,
  last_test_msg text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  api_secret_enc text,
  max_age_minutes integer DEFAULT 0 NOT NULL,
  verification_mode text DEFAULT 'transactions'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id bigint DEFAULT nextval('payment_methods_id_seq'::regclass) NOT NULL,
  name character varying(100) NOT NULL,
  image_url text,
  wallet_address text,
  instructions text,
  description text,
  min_amount numeric DEFAULT 1 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  method_type character varying(30) DEFAULT 'manual'::character varying NOT NULL,
  api_account text,
  payment_currency character varying(10),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  order_index integer DEFAULT 0,
  custom_fields jsonb,
  currency_id integer,
  bonus_type text,
  bonus_percent numeric,
  qr_enabled boolean DEFAULT false NOT NULL,
  qr_always_open boolean DEFAULT false NOT NULL,
  bonus_visible boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
  id bigint DEFAULT nextval('products_id_seq'::regclass) NOT NULL,
  subcategory_id bigint,
  sub_sub_category_id bigint,
  provider_id bigint,
  name character varying(255) NOT NULL,
  description text,
  image_url text,
  price numeric DEFAULT 0 NOT NULL,
  price_per_unit numeric DEFAULT 0 NOT NULL,
  store_type character varying(50),
  external_id character varying(255),
  requires_input boolean DEFAULT false NOT NULL,
  min_quantity numeric DEFAULT 1,
  max_quantity numeric DEFAULT 1,
  available boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  order_index integer DEFAULT 0,
  custom_fields text,
  input_label text,
  inventory_group_id bigint,
  image_urls text,
  default_profit numeric,
  package_type character varying(30),
  package_values jsonb,
  packages_data jsonb,
  markup_type character varying(10),
  markup_value numeric,
  category_id bigint,
  name_verification_enabled boolean DEFAULT false NOT NULL,
  name_verification_game character varying(50),
  name_verification_region character varying(100)
);

CREATE TABLE IF NOT EXISTS public.providers (
  id bigint DEFAULT nextval('providers_id_seq'::regclass) NOT NULL,
  name character varying(100) NOT NULL,
  base_url text NOT NULL,
  api_token_enc text NOT NULL,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  api_account character varying(255),
  order_method character varying(10) DEFAULT 'POST'::character varying,
  provider_type text DEFAULT 'standard'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id bigint DEFAULT nextval('push_subscriptions_id_seq'::regclass) NOT NULL,
  user_id bigint,
  subscription text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settings (
  id bigint DEFAULT nextval('settings_id_seq'::regclass) NOT NULL,
  key character varying(100) NOT NULL,
  value text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shamcash_invoices (
  id bigint DEFAULT nextval('shamcash_invoices_id_seq'::regclass) NOT NULL,
  transaction_id bigint,
  invoice_number text NOT NULL,
  user_id bigint NOT NULL,
  payment_method_id bigint,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  expires_at timestamp with time zone,
  gateway_code text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.store_appearance (
  id integer DEFAULT 1 NOT NULL,
  logo_url text DEFAULT ''::text,
  theme_mode text DEFAULT 'system'::text NOT NULL,
  primary_color text DEFAULT '#0936AD'::text NOT NULL,
  cat_columns_desktop integer DEFAULT 4 NOT NULL,
  cat_columns_mobile integer DEFAULT 3 NOT NULL,
  cat_image_ratio text DEFAULT '1:1'::text NOT NULL,
  prod_columns_desktop integer DEFAULT 4 NOT NULL,
  prod_columns_mobile integer DEFAULT 1 NOT NULL,
  prod_image_ratio text DEFAULT '1:1'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  sub_columns_desktop integer DEFAULT 4 NOT NULL,
  sub_columns_mobile integer DEFAULT 3 NOT NULL,
  sub_image_ratio text DEFAULT '1:1'::text NOT NULL,
  subsub_columns_desktop integer DEFAULT 4 NOT NULL,
  subsub_columns_mobile integer DEFAULT 3 NOT NULL,
  subsub_image_ratio text DEFAULT '1:1'::text NOT NULL,
  pay_columns_desktop integer DEFAULT 4 NOT NULL,
  pay_columns_mobile integer DEFAULT 4 NOT NULL,
  pay_image_ratio text DEFAULT '1:1'::text NOT NULL,
  checkout_mode text DEFAULT 'page'::text,
  font_scale numeric DEFAULT 100,
  font_size_cat numeric,
  font_size_sub numeric,
  font_size_subsub numeric,
  font_size_prod numeric,
  font_size_pay numeric,
  default_home_mode text DEFAULT 'categories'::text NOT NULL,
  loading_spinner_type text DEFAULT 'pixel'::text NOT NULL,
  item_card_style text DEFAULT 'card'::text NOT NULL,
  search_enabled boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sub_admins (
  id bigint DEFAULT nextval('sub_admins_id_seq'::regclass) NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text,
  permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
  disabled boolean DEFAULT false NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  last_login_at timestamp with time zone,
  last_action_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.sub_sub_categories (
  id bigint DEFAULT nextval('sub_sub_categories_id_seq'::regclass) NOT NULL,
  subcategory_id bigint NOT NULL,
  name character varying(100) NOT NULL,
  image_url text,
  active boolean DEFAULT true NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  special_id character varying(100),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id bigint DEFAULT nextval('subcategories_id_seq'::regclass) NOT NULL,
  category_id bigint NOT NULL,
  name character varying(100) NOT NULL,
  image_url text,
  active boolean DEFAULT true NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  special_id character varying(100),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.telegram_bot_settings (
  id integer DEFAULT nextval('telegram_bot_settings_id_seq'::regclass) NOT NULL,
  bot_type text NOT NULL,
  token_enc text,
  is_disabled boolean DEFAULT false NOT NULL,
  is_user_bot_disabled boolean DEFAULT false NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_test_at timestamp with time zone,
  last_test_ok boolean,
  last_test_msg text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.telegram_linking_codes (
  id bigint DEFAULT nextval('telegram_linking_codes_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  code character varying(20) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id bigint DEFAULT nextval('transactions_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  payment_method_id bigint,
  amount numeric DEFAULT 0 NOT NULL,
  status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
  note text,
  receipt_image_url text,
  tx_number character varying(100),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  wallet_address character varying(255),
  custom_fields_data jsonb,
  original_amount numeric,
  original_currency character varying(10),
  bonus_type text,
  bonus_percent numeric
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id bigint DEFAULT nextval('user_sessions_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  device text,
  ip text,
  last_active timestamp with time zone DEFAULT now() NOT NULL,
  location text
);

CREATE TABLE IF NOT EXISTS public.user_stats (
  id bigint DEFAULT nextval('user_stats_id_seq'::regclass) NOT NULL,
  user_id bigint NOT NULL,
  total_orders_count integer DEFAULT 0 NOT NULL,
  total_recharge_sum numeric DEFAULT 0 NOT NULL,
  referral_count integer DEFAULT 0 NOT NULL,
  vouchers_redeemed_count integer DEFAULT 0 NOT NULL,
  login_days_count integer DEFAULT 0 NOT NULL,
  last_login_date date,
  claimed_reward_index integer DEFAULT 0 NOT NULL,
  profile_badge character varying(50),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  active_discount numeric DEFAULT 0 NOT NULL,
  one_product_discount_percent numeric DEFAULT 0 NOT NULL,
  lifetime_discount numeric DEFAULT 0 NOT NULL,
  has_flaming_theme boolean DEFAULT false NOT NULL,
  has_special_support boolean DEFAULT false NOT NULL,
  has_priority_orders boolean DEFAULT false NOT NULL,
  custom_theme_color character varying(30),
  user_title character varying(50),
  frame character varying(50),
  profile_emoji character varying(10)
);

CREATE TABLE IF NOT EXISTS public.users (
  id bigint DEFAULT nextval('users_id_seq'::regclass) NOT NULL,
  name character varying(60),
  email character varying(255) NOT NULL,
  password_hash text,
  phone character varying(30),
  balance numeric DEFAULT 0 NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  is_vip boolean DEFAULT false NOT NULL,
  is_banned boolean DEFAULT false NOT NULL,
  is_blocked boolean DEFAULT false NOT NULL,
  blocked_until timestamp with time zone,
  avatar_url text,
  telegram_chat_id text,
  referred_by_id bigint,
  referral_count integer DEFAULT 0 NOT NULL,
  google_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  auth_provider character varying(20) DEFAULT 'email'::character varying NOT NULL,
  chat_blocked boolean DEFAULT false NOT NULL,
  token_version integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.voucher_uses (
  id bigint DEFAULT nextval('voucher_uses_id_seq'::regclass) NOT NULL,
  voucher_id bigint NOT NULL,
  user_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vouchers (
  id bigint DEFAULT nextval('vouchers_id_seq'::regclass) NOT NULL,
  code character varying(50) NOT NULL,
  amount numeric DEFAULT 0 NOT NULL,
  max_uses integer DEFAULT 1 NOT NULL,
  used_count integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------
-- 3-ب) جدولان يستخدمهما الكود (saraqib-user server.ts:1596/1613 و
--      saraqib-admin server.ts:7177-7178) لكنهما غير موجودين فعلياً في
--      قاعدة بيانات الإنتاج الحالية (تم التحقق مباشرة عبر MCP) — الكاتب
--      يتجاهل فشل الإدراج بصمت (catch فارغ يرجع 204 دائماً)، فكل بيانات
--      Analytics/أخطاء العميل تُفقد منذ البداية دون أي أثر ظاهر. أضيفا هنا
--      ليعمل المشروع المستنسخ بشكل صحيح من اليوم الأول.
-- ---------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.analytics_events_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;
CREATE SEQUENCE IF NOT EXISTS public.client_error_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigint DEFAULT nextval('analytics_events_id_seq'::regclass) NOT NULL,
  event_type text NOT NULL,
  path text,
  app character varying(10) NOT NULL,
  user_id bigint,
  session_id text,
  device_type character varying(20),
  referrer text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id bigint DEFAULT nextval('client_error_logs_id_seq'::regclass) NOT NULL,
  app character varying(10) NOT NULL,
  message text NOT NULL,
  stack text,
  url text,
  user_id bigint,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.analytics_events ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.client_error_logs ADD CONSTRAINT client_error_logs_pkey PRIMARY KEY (id);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events USING btree (created_at DESC);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);
CREATE INDEX idx_client_error_logs_created_at ON public.client_error_logs USING btree (created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_analytics_events ON public.analytics_events AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_client_error_logs ON public.client_error_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));

-- ---------------------------------------------------------------------
-- 4) Primary Keys
-- ---------------------------------------------------------------------
ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_accounts ADD CONSTRAINT admin_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_activity_logs ADD CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_activity_logs_archive ADD CONSTRAINT admin_activity_logs_archive_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_notification_settings ADD CONSTRAINT admin_notification_settings_pkey PRIMARY KEY (admin_id);
ALTER TABLE ONLY public.admin_push_subscriptions ADD CONSTRAINT admin_push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_sessions ADD CONSTRAINT admin_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_activity_logs ADD CONSTRAINT api_activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_orders_log ADD CONSTRAINT api_orders_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_token_categories ADD CONSTRAINT api_token_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_token_products ADD CONSTRAINT api_token_products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_tokens ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_webhook_logs ADD CONSTRAINT api_webhook_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.auto_charge_codes ADD CONSTRAINT auto_charge_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.auto_replies ADD CONSTRAINT auto_replies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.banners ADD CONSTRAINT banners_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.currencies ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.currency_rate_history ADD CONSTRAINT currency_rate_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.daily_message_counts ADD CONSTRAINT daily_message_counts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.device_fingerprints ADD CONSTRAINT device_fingerprints_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email_verifications ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory_delivery_logs ADD CONSTRAINT inventory_delivery_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory_groups ADD CONSTRAINT inventory_groups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory_units ADD CONSTRAINT inventory_units_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.job_locks ADD CONSTRAINT job_locks_pkey PRIMARY KEY (job);
ALTER TABLE ONLY public.maintenance_config ADD CONSTRAINT maintenance_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.offers ADD CONSTRAINT offers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_gateways ADD CONSTRAINT payment_gateways_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_methods ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.providers ADD CONSTRAINT providers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.shamcash_invoices ADD CONSTRAINT shamcash_invoices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sub_admins ADD CONSTRAINT sub_admins_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sub_sub_categories ADD CONSTRAINT sub_sub_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subcategories ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.telegram_bot_settings ADD CONSTRAINT telegram_bot_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.telegram_linking_codes ADD CONSTRAINT telegram_linking_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_stats ADD CONSTRAINT user_stats_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.voucher_uses ADD CONSTRAINT voucher_uses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.vouchers ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);

-- ---------------------------------------------------------------------
-- 5) Unique Constraints
-- ---------------------------------------------------------------------
ALTER TABLE ONLY public.admin_accounts ADD CONSTRAINT admin_accounts_email_key UNIQUE (email);
ALTER TABLE ONLY public.admin_push_subscriptions ADD CONSTRAINT admin_push_subscriptions_admin_id_subscription_key UNIQUE (admin_id, subscription);
ALTER TABLE ONLY public.admin_sessions ADD CONSTRAINT admin_sessions_jti_key UNIQUE (jti);
ALTER TABLE ONLY public.api_orders_log ADD CONSTRAINT api_orders_log_token_id_order_uuid_key UNIQUE (token_id, order_uuid);
ALTER TABLE ONLY public.api_token_categories ADD CONSTRAINT api_token_categories_token_id_category_type_category_id_key UNIQUE (token_id, category_type, category_id);
ALTER TABLE ONLY public.api_token_products ADD CONSTRAINT api_token_products_token_id_product_id_key UNIQUE (token_id, product_id);
ALTER TABLE ONLY public.api_tokens ADD CONSTRAINT api_tokens_token_key UNIQUE (token);
ALTER TABLE ONLY public.categories ADD CONSTRAINT categories_special_id_key UNIQUE (special_id);
ALTER TABLE ONLY public.daily_message_counts ADD CONSTRAINT daily_message_counts_user_id_date_key UNIQUE (user_id, date);
ALTER TABLE ONLY public.device_fingerprints ADD CONSTRAINT device_fingerprints_user_id_fingerprint_key UNIQUE (user_id, fingerprint);
ALTER TABLE ONLY public.payment_gateways ADD CONSTRAINT payment_gateways_gateway_code_key UNIQUE (gateway_code);
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_subscription_key UNIQUE (subscription);
ALTER TABLE ONLY public.settings ADD CONSTRAINT settings_key_key UNIQUE (key);
ALTER TABLE ONLY public.shamcash_invoices ADD CONSTRAINT shamcash_invoices_invoice_number_key UNIQUE (invoice_number);
ALTER TABLE ONLY public.sub_admins ADD CONSTRAINT sub_admins_email_key UNIQUE (email);
ALTER TABLE ONLY public.sub_sub_categories ADD CONSTRAINT sub_sub_categories_special_id_key UNIQUE (special_id);
ALTER TABLE ONLY public.subcategories ADD CONSTRAINT subcategories_special_id_key UNIQUE (special_id);
ALTER TABLE ONLY public.telegram_bot_settings ADD CONSTRAINT telegram_bot_settings_bot_type_key UNIQUE (bot_type);
ALTER TABLE ONLY public.telegram_linking_codes ADD CONSTRAINT telegram_linking_codes_code_key UNIQUE (code);
ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_tx_number_key UNIQUE (tx_number);
ALTER TABLE ONLY public.user_stats ADD CONSTRAINT user_stats_user_id_key UNIQUE (user_id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_google_id_key UNIQUE (google_id);
ALTER TABLE ONLY public.voucher_uses ADD CONSTRAINT voucher_uses_voucher_id_user_id_key UNIQUE (voucher_id, user_id);
ALTER TABLE ONLY public.vouchers ADD CONSTRAINT vouchers_code_key UNIQUE (code);

-- ---------------------------------------------------------------------
-- 6) Foreign Keys
-- ---------------------------------------------------------------------
ALTER TABLE ONLY public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.api_activity_logs ADD CONSTRAINT api_activity_logs_token_id_fkey FOREIGN KEY (token_id) REFERENCES api_tokens(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.api_activity_logs ADD CONSTRAINT api_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.api_orders_log ADD CONSTRAINT api_orders_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.api_orders_log ADD CONSTRAINT api_orders_log_token_id_fkey FOREIGN KEY (token_id) REFERENCES api_tokens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.api_token_categories ADD CONSTRAINT api_token_categories_token_id_fkey FOREIGN KEY (token_id) REFERENCES api_tokens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.api_token_products ADD CONSTRAINT api_token_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.api_token_products ADD CONSTRAINT api_token_products_token_id_fkey FOREIGN KEY (token_id) REFERENCES api_tokens(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.api_tokens ADD CONSTRAINT api_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.auto_charge_codes ADD CONSTRAINT auto_charge_codes_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.auto_charge_codes ADD CONSTRAINT auto_charge_codes_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.auto_charge_codes ADD CONSTRAINT auto_charge_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.currency_rate_history ADD CONSTRAINT currency_rate_history_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.daily_message_counts ADD CONSTRAINT daily_message_counts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.device_fingerprints ADD CONSTRAINT device_fingerprints_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.email_verifications ADD CONSTRAINT email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_units ADD CONSTRAINT inventory_units_group_id_fkey FOREIGN KEY (group_id) REFERENCES inventory_groups(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_methods ADD CONSTRAINT payment_methods_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_inventory_group_id_fkey FOREIGN KEY (inventory_group_id) REFERENCES inventory_groups(id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_sub_sub_category_id_fkey FOREIGN KEY (sub_sub_category_id) REFERENCES sub_sub_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.shamcash_invoices ADD CONSTRAINT shamcash_invoices_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.shamcash_invoices ADD CONSTRAINT shamcash_invoices_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.shamcash_invoices ADD CONSTRAINT shamcash_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sub_sub_categories ADD CONSTRAINT sub_sub_categories_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subcategories ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.telegram_linking_codes ADD CONSTRAINT telegram_linking_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_stats ADD CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_referred_by_id_fkey FOREIGN KEY (referred_by_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.voucher_uses ADD CONSTRAINT voucher_uses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.voucher_uses ADD CONSTRAINT voucher_uses_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 7) Check Constraints
-- ---------------------------------------------------------------------
ALTER TABLE ONLY public.api_token_categories ADD CONSTRAINT api_token_categories_category_type_check CHECK ((category_type = ANY (ARRAY['category'::text, 'subcategory'::text, 'sub_sub_category'::text])));
ALTER TABLE ONLY public.api_tokens ADD CONSTRAINT api_tokens_scope_check CHECK ((scope = ANY (ARRAY['all'::text, 'selected'::text])));
ALTER TABLE ONLY public.auto_charge_codes ADD CONSTRAINT auto_charge_codes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'used'::text, 'expired'::text, 'cancelled'::text])));
ALTER TABLE ONLY public.currencies ADD CONSTRAINT currencies_exchange_rate_check CHECK ((exchange_rate > (0)::numeric));
ALTER TABLE ONLY public.currency_rate_history ADD CONSTRAINT currency_rate_history_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'updated'::text])));
ALTER TABLE ONLY public.inventory_units ADD CONSTRAINT inventory_units_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'delivered'::text])));
ALTER TABLE ONLY public.maintenance_config ADD CONSTRAINT maintenance_config_single_row CHECK ((id = 1));
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE ONLY public.payment_gateways ADD CONSTRAINT payment_gateways_verification_mode_check CHECK ((verification_mode = ANY (ARRAY['transactions'::text, 'invoices'::text, 'webhook'::text])));
ALTER TABLE ONLY public.payment_methods ADD CONSTRAINT payment_methods_bonus_percent_check CHECK (((bonus_percent IS NULL) OR ((bonus_percent >= (0)::numeric) AND (bonus_percent <= (100)::numeric))));
ALTER TABLE ONLY public.payment_methods ADD CONSTRAINT payment_methods_bonus_type_check CHECK (((bonus_type IS NULL) OR (bonus_type = ANY (ARRAY['commission'::text, 'bonus'::text]))));
ALTER TABLE ONLY public.products ADD CONSTRAINT products_markup_type_check CHECK (((markup_type IS NULL) OR ((markup_type)::text = ANY (ARRAY['percent'::text, 'fixed'::text]))));
ALTER TABLE ONLY public.products ADD CONSTRAINT products_package_type_check CHECK (((package_type IS NULL) OR ((package_type)::text = 'specificPackage'::text)));
ALTER TABLE ONLY public.products ADD CONSTRAINT products_store_type_check CHECK (((store_type)::text = ANY (ARRAY['normal'::text, 'quick_order'::text, 'quantities'::text, 'numbers'::text, 'external_api'::text, 'inventory'::text, 'gallery'::text])));
ALTER TABLE ONLY public.providers ADD CONSTRAINT providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['standard'::text, 'megaapi'::text])));
ALTER TABLE ONLY public.shamcash_invoices ADD CONSTRAINT shamcash_invoices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'cancelled'::text])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_cat_columns_desktop_check CHECK ((cat_columns_desktop = ANY (ARRAY[2, 3, 4])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_cat_columns_mobile_check CHECK ((cat_columns_mobile = ANY (ARRAY[2, 3, 4])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_checkout_mode_check CHECK (((checkout_mode IS NULL) OR (checkout_mode = ANY (ARRAY['page'::text, 'modal'::text]))));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_default_home_mode_check CHECK ((default_home_mode = ANY (ARRAY['strip'::text, 'categories'::text, 'most_purchased'::text, 'favorites'::text])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_item_card_style_check CHECK ((item_card_style = ANY (ARRAY['card'::text, 'plain'::text])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_loading_spinner_type_check CHECK ((loading_spinner_type = ANY (ARRAY['pixel'::text, 'logo_pulse'::text, 'logo_ring'::text])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_pay_columns_desktop_check CHECK ((pay_columns_desktop = ANY (ARRAY[3, 4, 5])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_pay_columns_mobile_check CHECK ((pay_columns_mobile = ANY (ARRAY[2, 3, 4])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_prod_columns_mobile_check CHECK ((prod_columns_mobile = ANY (ARRAY[1, 2, 3])));
ALTER TABLE ONLY public.store_appearance ADD CONSTRAINT store_appearance_theme_mode_check CHECK ((theme_mode = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])));
ALTER TABLE ONLY public.telegram_bot_settings ADD CONSTRAINT telegram_bot_settings_bot_type_check CHECK ((bot_type = ANY (ARRAY['user'::text, 'admin'::text])));
ALTER TABLE ONLY public.transactions ADD CONSTRAINT transactions_bonus_type_check CHECK (((bonus_type IS NULL) OR (bonus_type = ANY (ARRAY['commission'::text, 'bonus'::text]))));

-- ---------------------------------------------------------------------
-- 8) الدوال (Functions) — تُنشأ قبل الـ CHECK الذي يستدعيها وقبل الـ Triggers
--    ملاحظة: chk_sub_admins_permissions_shape أعلاه يستدعي الدالة التالية،
--    لذا نفّذ قسم الدوال فعلياً قبل قسم القيود عند التنفيذ اليدوي لو لزم؛
--    بما أن sub_admins_valid_permissions_shape تُنشأ هنا، يفضّل تحريك هذا
--    القسم لأعلى الملف إذا شغّلت القطع منفصلة. عند تشغيل الملف كاملاً دفعة
--    واحدة كـ "transaction" ضمنية (كما في Supabase SQL editor) فلا مشكلة.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sub_admins_valid_permissions_shape(p jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
begin
  if p is null then
    return true;
  end if;
  if jsonb_typeof(p) <> 'object' then
    return false;
  end if;
  return not exists (
    select 1 from jsonb_object_keys(p) as key
    where key <> all(array[
      'orders','finance','users','store','elements','chat',
      'settings_ai','settings_bots','settings_logs','settings_api'
    ])
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_inventory_unit(p_group_id bigint, p_order_id bigint, p_user_id bigint)
 RETURNS inventory_units
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  claimed inventory_units;
begin
  update inventory_units
    set status = 'sold', order_id = p_order_id, delivered_user_id = p_user_id, delivered_at = now()
    where id = (
      select id from inventory_units
      where group_id = p_group_id and status = 'available'
      order by id asc
      limit 1
      for update skip locked
    )
    returning * into claimed;
  return claimed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_balance_if_sufficient(p_user_id bigint, p_amount numeric)
 RETURNS TABLE(success boolean, new_balance numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::NUMERIC;
    RETURN;
  END IF;

  UPDATE users
  SET balance = balance - p_amount
  WHERE id = p_user_id
    AND balance >= p_amount
  RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::NUMERIC;
  ELSE
    RETURN QUERY SELECT TRUE, v_new_balance;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_inventory_available_count(p_group_id bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INT FROM public.inventory_units
  WHERE group_id = p_group_id AND status = 'available';
$function$;

CREATE OR REPLACE FUNCTION public.increment_balance(user_id_param bigint, amount_param numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE users
    SET balance = balance + amount_param,
        updated_at = NOW()
    WHERE id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_recharge_sum(user_id_param bigint, amount_param numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  insert into user_stats (user_id, total_recharge_sum)
    values (user_id_param, amount_param)
      on conflict (user_id)
        do update set total_recharge_sum = coalesce(user_stats.total_recharge_sum, 0) + amount_param;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_total_orders(user_id_param bigint, amount_param numeric DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE user_stats
    SET total_orders_count = total_orders_count + 1,
        updated_at = NOW()
    WHERE user_id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_available_count(p_group_id bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select count(*) from inventory_units where group_id = p_group_id and status = 'available';
$function$;

CREATE OR REPLACE FUNCTION public.refund_order_once(p_order_id bigint)
 RETURNS TABLE(refunded boolean, amount numeric, new_balance numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total       numeric;
  v_user_id     bigint;
  v_refunded_at timestamptz;
  v_meta        text;
  v_meta_j      jsonb;
  v_new_balance numeric;
BEGIN
  SELECT total_amount, user_id, refunded_at, meta
    INTO v_total, v_user_id, v_refunded_at, v_meta
    FROM public.orders
   WHERE id = p_order_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::numeric; RETURN;
  END IF;

  IF v_refunded_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::numeric; RETURN;
  END IF;

  IF v_total IS NULL OR v_total <= 0 OR v_user_id IS NULL THEN
    UPDATE public.orders SET refunded_at = now() WHERE id = p_order_id;
    RETURN QUERY SELECT false, 0::numeric, NULL::numeric; RETURN;
  END IF;

  BEGIN
    v_meta_j := COALESCE(v_meta::jsonb, '{}'::jsonb);
  EXCEPTION WHEN others THEN
    v_meta_j := '{}'::jsonb;
  END;
  v_meta_j := jsonb_set(v_meta_j, '{refunded}', 'true'::jsonb, true);
  v_meta_j := jsonb_set(v_meta_j, '{refunded_at}', to_jsonb(now()::text), true);

  UPDATE public.orders
     SET refunded_at = now(),
         meta        = v_meta_j::text,
         updated_at  = now()
   WHERE id = p_order_id;

  UPDATE public.users
     SET balance = balance + v_total,
         updated_at = now()
   WHERE id = v_user_id
   RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (user_id, amount, note, status)
  VALUES (v_user_id, v_total, 'استرجاع رصيد - إلغاء طلب #' || p_order_id, 'approved');

  RETURN QUERY SELECT true, v_total, v_new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_inventory_unit_for_order(p_order_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_group_id BIGINT;
BEGIN
  SELECT group_id INTO v_group_id FROM public.inventory_units WHERE order_id = p_order_id LIMIT 1;

  UPDATE public.inventory_units
  SET status = 'available', order_id = NULL, delivered_user_id = NULL, delivered_at = NULL
  WHERE order_id = p_order_id;

  IF v_group_id IS NOT NULL THEN
    UPDATE public.products SET available = true
    WHERE inventory_group_id = v_group_id AND available = false;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_and_deliver_inventory_unit(p_group_id bigint, p_order_id bigint, p_user_id bigint, p_product_id bigint)
 RETURNS TABLE(unit_id bigint, content text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_id BIGINT;
  v_content TEXT;
  v_threshold INT;
  v_remaining INT;
BEGIN
  SELECT inventory_units.id, inventory_units.content INTO v_unit_id, v_content
  FROM public.inventory_units
  WHERE group_id = p_group_id AND status = 'available'
  ORDER BY id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_unit_id IS NULL THEN
    RAISE EXCEPTION 'OUT_OF_STOCK' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inventory_units
  SET status = 'delivered',
      order_id = p_order_id,
      delivered_user_id = p_user_id,
      delivered_at = now()
  WHERE id = v_unit_id;

  INSERT INTO public.inventory_delivery_logs
    (order_id, user_id, product_id, group_id, unit_id, content_snapshot, delivered_at)
  VALUES
    (p_order_id, p_user_id, p_product_id, p_group_id, v_unit_id, v_content, now());

  SELECT low_stock_threshold INTO v_threshold
  FROM public.inventory_groups WHERE id = p_group_id;

  SELECT COUNT(*) INTO v_remaining
  FROM public.inventory_units
  WHERE group_id = p_group_id AND status = 'available';

  IF v_remaining = 0 THEN
    UPDATE public.products
    SET available = false
    WHERE inventory_group_id = p_group_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NULL, '⚠️ نفدت الكمية', 'نفدت عناصر المخزون لمجموعة رقم ' || p_group_id::text, 'warning');

  ELSIF v_threshold IS NOT NULL AND v_remaining <= v_threshold THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NULL, '🔔 تنبيه انخفاض المخزون', 'تبقّى ' || v_remaining::text || ' عنصر فقط في مجموعة رقم ' || p_group_id::text, 'warning');
  END IF;

  RETURN QUERY SELECT v_unit_id, v_content;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sub_admins_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_payment_gateways_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.try_acquire_job_lock(p_job text, p_ttl_seconds integer, p_holder text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_count int;
BEGIN
  INSERT INTO public.job_locks (job, holder, locked_until)
  VALUES (p_job, p_holder, now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (job) DO UPDATE
     SET holder       = EXCLUDED.holder,
         locked_until = EXCLUDED.locked_until
   WHERE public.job_locks.locked_until < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_views()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_purchased_products;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_topup;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_referral;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_activity;
END;
$function$;

-- CHECK الذي يستدعي sub_admins_valid_permissions_shape (مؤجَّل هنا لأن الدالة تُنشأ أعلاه)
ALTER TABLE ONLY public.sub_admins ADD CONSTRAINT chk_sub_admins_permissions_shape CHECK (sub_admins_valid_permissions_shape(permissions));

-- ---------------------------------------------------------------------
-- 9) Triggers
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_auto_replies_updated_at BEFORE UPDATE ON public.auto_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_daily_msg_updated_at BEFORE UPDATE ON public.daily_message_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION trg_payment_gateways_set_updated_at();
CREATE TRIGGER trg_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sub_admins_updated_at BEFORE UPDATE ON public.sub_admins FOR EACH ROW EXECUTE FUNCTION sub_admins_set_updated_at();
CREATE TRIGGER trg_ssc_updated_at BEFORE UPDATE ON public.sub_sub_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_subcategories_updated_at BEFORE UPDATE ON public.subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_stats_updated_at BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_vouchers_updated_at BEFORE UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- 10) Materialized Views (لوحة الصدارة/الأكثر مبيعاً) — تُحدَّث عبر
--     refresh_leaderboard_views() دورياً (استدعها من كرون/job على السيرفر)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_leaderboard_activity AS
 SELECT o.user_id,
    u.name,
    u.avatar_url,
    us.profile_badge,
    count(*) AS completed_orders
   FROM ((orders o
     JOIN users u ON ((u.id = o.user_id)))
     LEFT JOIN user_stats us ON ((us.user_id = u.id)))
  WHERE ((o.status)::text = 'completed'::text)
  GROUP BY o.user_id, u.name, u.avatar_url, us.profile_badge;

CREATE MATERIALIZED VIEW public.mv_leaderboard_referral AS
 SELECT u.id AS user_id,
    u.name,
    u.avatar_url,
    us.profile_badge,
    COALESCE(u.referral_count, 0) AS referral_count
   FROM (users u
     LEFT JOIN user_stats us ON ((us.user_id = u.id)))
  WHERE (COALESCE(u.referral_count, 0) > 0);

CREATE MATERIALIZED VIEW public.mv_leaderboard_topup AS
 SELECT us.user_id,
    u.name,
    u.avatar_url,
    us.profile_badge,
    us.total_recharge_sum
   FROM (user_stats us
     JOIN users u ON ((u.id = us.user_id)))
  WHERE (COALESCE(us.total_recharge_sum, (0)::numeric) > (0)::numeric);

CREATE MATERIALIZED VIEW public.mv_top_purchased_products AS
 SELECT p.id AS product_id,
    p.name,
    p.price,
    p.price_per_unit,
    p.image_url,
    p.store_type,
    p.available,
    count(DISTINCT oi.order_id) AS purchase_count
   FROM ((order_items oi
     JOIN orders o ON (((o.id = oi.order_id) AND ((o.status)::text = 'completed'::text))))
     JOIN products p ON ((p.id = oi.product_id)))
  GROUP BY p.id, p.name, p.price, p.price_per_unit, p.image_url, p.store_type, p.available
 HAVING ((count(DISTINCT oi.order_id) >= 2) AND ((COALESCE(p.price, (0)::numeric) > (0)::numeric) OR (COALESCE(p.price_per_unit, (0)::numeric) > (0)::numeric)));

-- ---------------------------------------------------------------------
-- 11) الفهارس الإضافية (غير قيود)
-- ---------------------------------------------------------------------
CREATE INDEX idx_activity_logs_user_id_created_at ON public.activity_logs USING btree (user_id, created_at DESC);
CREATE INDEX idx_admin_accounts_email ON public.admin_accounts USING btree (email);
CREATE INDEX idx_admin_activity_logs_action_type ON public.admin_activity_logs USING btree (action_type);
CREATE INDEX idx_admin_activity_logs_admin_id ON public.admin_activity_logs USING btree (admin_id);
CREATE INDEX idx_admin_activity_logs_created_at ON public.admin_activity_logs USING btree (created_at DESC);
CREATE INDEX idx_admin_activity_logs_target ON public.admin_activity_logs USING btree (target_model, target_id);
CREATE INDEX admin_activity_logs_archive_action_type_idx ON public.admin_activity_logs_archive USING btree (action_type);
CREATE INDEX admin_activity_logs_archive_admin_id_idx ON public.admin_activity_logs_archive USING btree (admin_id);
CREATE INDEX admin_activity_logs_archive_created_at_idx ON public.admin_activity_logs_archive USING btree (created_at DESC);
CREATE INDEX admin_activity_logs_archive_target_model_target_id_idx ON public.admin_activity_logs_archive USING btree (target_model, target_id);
CREATE INDEX idx_admin_push_subscriptions_admin_id ON public.admin_push_subscriptions USING btree (admin_id);
CREATE INDEX idx_admin_sessions_jti ON public.admin_sessions USING btree (jti);
CREATE INDEX idx_admin_sessions_last_active ON public.admin_sessions USING btree (last_active_at DESC);
CREATE INDEX idx_admin_sessions_revoked ON public.admin_sessions USING btree (revoked);
CREATE INDEX idx_admin_sessions_target_id ON public.admin_sessions USING btree (target_id) WHERE (target_id IS NOT NULL);
CREATE INDEX idx_api_activity_logs_created_at ON public.api_activity_logs USING btree (created_at DESC);
CREATE INDEX idx_api_activity_logs_token_id ON public.api_activity_logs USING btree (token_id);
CREATE INDEX idx_api_activity_logs_user_id ON public.api_activity_logs USING btree (user_id);
CREATE INDEX idx_api_orders_log_order_id ON public.api_orders_log USING btree (order_id);
CREATE INDEX idx_api_orders_log_token_id ON public.api_orders_log USING btree (token_id);
CREATE INDEX idx_api_token_categories_token_id ON public.api_token_categories USING btree (token_id);
CREATE INDEX idx_api_token_products_product_id ON public.api_token_products USING btree (product_id);
CREATE INDEX idx_api_token_products_token_id ON public.api_token_products USING btree (token_id);
CREATE INDEX idx_api_tokens_token ON public.api_tokens USING btree (token);
CREATE INDEX idx_api_tokens_user_id ON public.api_tokens USING btree (user_id);
CREATE INDEX idx_api_webhook_logs_created_at ON public.api_webhook_logs USING btree (created_at DESC);
CREATE INDEX idx_auto_charge_codes_gateway_status ON public.auto_charge_codes USING btree (gateway_code, status);
CREATE INDEX idx_auto_charge_codes_user_status ON public.auto_charge_codes USING btree (user_id, status);
CREATE UNIQUE INDEX uq_auto_charge_codes_pending_code ON public.auto_charge_codes USING btree (code) WHERE (status = 'pending'::text);
CREATE INDEX idx_auto_replies_is_faq ON public.auto_replies USING btree (is_faq);
CREATE INDEX idx_auto_replies_trigger ON public.auto_replies USING btree (trigger_text);
CREATE INDEX idx_banners_order ON public.banners USING btree (order_index);
CREATE INDEX idx_categories_active ON public.categories USING btree (active);
CREATE INDEX idx_categories_order_index ON public.categories USING btree (order_index);
CREATE INDEX idx_categories_special_id ON public.categories USING btree (special_id);
CREATE UNIQUE INDEX currencies_single_default ON public.currencies USING btree (is_default) WHERE (is_default = true);
CREATE INDEX idx_currency_rate_history_created_at ON public.currency_rate_history USING btree (created_at DESC);
CREATE INDEX idx_currency_rate_history_currency_id ON public.currency_rate_history USING btree (currency_id);
CREATE INDEX idx_daily_msg_date ON public.daily_message_counts USING btree (date);
CREATE INDEX idx_daily_msg_user_id ON public.daily_message_counts USING btree (user_id);
CREATE INDEX idx_device_fingerprints_fingerprint ON public.device_fingerprints USING btree (fingerprint);
CREATE INDEX idx_device_fingerprints_user_id ON public.device_fingerprints USING btree (user_id);
CREATE INDEX idx_email_verif_code ON public.email_verifications USING btree (code);
CREATE INDEX idx_email_verif_email ON public.email_verifications USING btree (email);
CREATE INDEX idx_email_verif_expires_at ON public.email_verifications USING btree (expires_at);
CREATE INDEX idx_email_verifications_user_id ON public.email_verifications USING btree (user_id);
CREATE INDEX idx_inventory_delivery_logs_order ON public.inventory_delivery_logs USING btree (order_id);
CREATE INDEX idx_inventory_delivery_logs_user ON public.inventory_delivery_logs USING btree (user_id);
CREATE INDEX idx_inventory_logs_group ON public.inventory_delivery_logs USING btree (group_id);
CREATE INDEX idx_inventory_units_group_status ON public.inventory_units USING btree (group_id, status);
CREATE INDEX idx_inventory_units_order_id ON public.inventory_units USING btree (order_id);
CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);
CREATE INDEX idx_messages_guest_id ON public.messages USING btree (guest_id);
CREATE INDEX idx_messages_is_read ON public.messages USING btree (is_read);
CREATE INDEX idx_messages_user_id ON public.messages USING btree (user_id);
CREATE INDEX idx_mv_leaderboard_activity_count ON public.mv_leaderboard_activity USING btree (completed_orders DESC);
CREATE UNIQUE INDEX idx_mv_leaderboard_activity_uid ON public.mv_leaderboard_activity USING btree (user_id);
CREATE INDEX idx_mv_leaderboard_referral_count ON public.mv_leaderboard_referral USING btree (referral_count DESC);
CREATE UNIQUE INDEX idx_mv_leaderboard_referral_uid ON public.mv_leaderboard_referral USING btree (user_id);
CREATE INDEX idx_mv_leaderboard_topup_sum ON public.mv_leaderboard_topup USING btree (total_recharge_sum DESC);
CREATE UNIQUE INDEX idx_mv_leaderboard_topup_uid ON public.mv_leaderboard_topup USING btree (user_id);
CREATE INDEX idx_mv_top_purchased_products_count ON public.mv_top_purchased_products USING btree (purchase_count DESC);
CREATE UNIQUE INDEX idx_mv_top_purchased_products_pid ON public.mv_top_purchased_products USING btree (product_id);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_offers_active ON public.offers USING btree (active);
CREATE INDEX idx_offers_created_at ON public.offers USING btree (created_at DESC);
CREATE INDEX idx_offers_order ON public.offers USING btree (order_index);
CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);
CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);
CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (active);
CREATE INDEX idx_payment_methods_currency_id ON public.payment_methods USING btree (currency_id);
CREATE INDEX idx_products_available ON public.products USING btree (available);
CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);
CREATE INDEX idx_products_external_id ON public.products USING btree (external_id);
CREATE INDEX idx_products_inventory_group_id ON public.products USING btree (inventory_group_id);
CREATE INDEX idx_products_provider_id ON public.products USING btree (provider_id);
CREATE INDEX idx_products_sub_sub_category_id ON public.products USING btree (sub_sub_category_id);
CREATE INDEX idx_products_subcategory_id ON public.products USING btree (subcategory_id);
CREATE INDEX idx_providers_is_active ON public.providers USING btree (is_active);
CREATE INDEX idx_push_subs_user_id ON public.push_subscriptions USING btree (user_id);
CREATE INDEX idx_settings_key ON public.settings USING btree (key);
CREATE INDEX idx_shamcash_invoices_user_status ON public.shamcash_invoices USING btree (user_id, status);
CREATE INDEX idx_sub_admins_disabled ON public.sub_admins USING btree (disabled);
CREATE INDEX idx_sub_admins_email ON public.sub_admins USING btree (email);
CREATE INDEX idx_sub_admins_expires_at ON public.sub_admins USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX idx_ssc_active ON public.sub_sub_categories USING btree (active);
CREATE INDEX idx_ssc_order_index ON public.sub_sub_categories USING btree (order_index);
CREATE INDEX idx_ssc_special_id ON public.sub_sub_categories USING btree (special_id);
CREATE INDEX idx_ssc_subcategory_id ON public.sub_sub_categories USING btree (subcategory_id);
CREATE INDEX idx_subcategories_active ON public.subcategories USING btree (active);
CREATE INDEX idx_subcategories_category_id ON public.subcategories USING btree (category_id);
CREATE INDEX idx_subcategories_order_index ON public.subcategories USING btree (order_index);
CREATE INDEX idx_subcategories_special_id ON public.subcategories USING btree (special_id);
CREATE INDEX idx_telegram_bot_settings_bot_type ON public.telegram_bot_settings USING btree (bot_type);
CREATE INDEX idx_tg_link_codes_code ON public.telegram_linking_codes USING btree (code);
CREATE INDEX idx_tg_link_codes_user_id ON public.telegram_linking_codes USING btree (user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at DESC);
CREATE INDEX idx_transactions_payment_method_id ON public.transactions USING btree (payment_method_id);
CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);
CREATE INDEX idx_transactions_tx_number ON public.transactions USING btree (tx_number);
CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);
CREATE INDEX idx_user_stats_user_id ON public.user_stats USING btree (user_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by_id);
CREATE INDEX idx_users_telegram ON public.users USING btree (telegram_chat_id);
CREATE INDEX idx_voucher_uses_user_id ON public.voucher_uses USING btree (user_id);
CREATE INDEX idx_voucher_uses_voucher_id ON public.voucher_uses USING btree (voucher_id);
CREATE INDEX idx_vouchers_active ON public.vouchers USING btree (active);
CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (code);

-- ---------------------------------------------------------------------
-- 12) Row Level Security — مُفعّل على كل الجداول، والوصول عبر service_role فقط
--     (الباك إند يتصل بـ service_role key فيتجاوز RLS تلقائياً؛ أي اتصال
--     آخر بمفتاح anon لن يرى/يعدّل أي صف — هذا مقصود، لا توجد واجهة عامة
--     مباشرة لقاعدة البيانات، كل الوصول يمر عبر Express API الخاص بالتطبيقين)
-- ---------------------------------------------------------------------
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_orders_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_token_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_token_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_charge_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_message_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shamcash_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_appearance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_linking_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 13) RLS Policies
-- ---------------------------------------------------------------------
CREATE POLICY service_role_all_activity_logs ON public.activity_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_admin_accounts ON public.admin_accounts AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_admin_activity_logs ON public.admin_activity_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_admin_activity_logs_archive ON public.admin_activity_logs_archive AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_admin_notification_settings ON public.admin_notification_settings AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_admin_push_subscriptions ON public.admin_push_subscriptions AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_admin_sessions ON public.admin_sessions AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_api_activity_logs ON public.api_activity_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_api_orders_log ON public.api_orders_log AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_api_token_categories ON public.api_token_categories AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_api_token_products ON public.api_token_products AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_api_tokens ON public.api_tokens AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_api_webhook_logs ON public.api_webhook_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_only_auto_charge_codes ON public.auto_charge_codes AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_auto_replies ON public.auto_replies AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_banners ON public.banners AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_categories ON public.categories AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_currencies ON public.currencies AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_currency_rate_history ON public.currency_rate_history AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_daily_msg ON public.daily_message_counts AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_device_fingerprints ON public.device_fingerprints AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_email_verif ON public.email_verifications AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_inventory_delivery_logs ON public.inventory_delivery_logs AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_inventory_groups ON public.inventory_groups AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_inventory_units ON public.inventory_units AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_job_locks ON public.job_locks AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_maintenance_config ON public.maintenance_config AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_messages ON public.messages AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_notifications ON public.notifications AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_offers ON public.offers AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_order_items ON public.order_items AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_orders ON public.orders AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY payment_gateways_service_only ON public.payment_gateways AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_payment_methods ON public.payment_methods AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_products ON public.products AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_providers ON public.providers AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_push_subs ON public.push_subscriptions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_settings ON public.settings AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_only_shamcash_invoices ON public.shamcash_invoices AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY service_role_all_store_appearance ON public.store_appearance AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY sub_admins_service_role_only ON public.sub_admins AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_ssc ON public.sub_sub_categories AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_subcategories ON public.subcategories AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_telegram_bot_settings ON public.telegram_bot_settings AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_tg_link ON public.telegram_linking_codes AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_transactions ON public.transactions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_user_sessions ON public.user_sessions AS PERMISSIVE FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));
CREATE POLICY allow_all_user_stats ON public.user_stats AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_users ON public.users AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_voucher_uses ON public.voucher_uses AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allow_all_vouchers ON public.vouchers AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- نهاية الملف — 46 جدول + 5 دوال مساعدة + 4 Materialized Views + RLS كاملة
-- بعد تنفيذ هذا الملف على مشروع جديد:
--   1) حدّث .env بمفاتيح المشروع الجديد (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
--   2) أنشئ صف افتراضي بجدول maintenance_config (id=1) وstore_appearance (id=1)
--      إن لم يُنشأ تلقائياً عبر كود التطبيق عند أول تشغيل
--   3) شغّل: SELECT refresh_leaderboard_views(); لأول مرة لتعبئة الـ Materialized Views
-- =====================================================================
