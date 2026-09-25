-- ============================================================
-- Fulla OTP Gateway: Supabase Database Schema
-- Copy and paste this script into your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Run)
-- ============================================================

-- 1. API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Default API Key',
    key TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- 2. OTP Delivery & Verification Logs
CREATE TABLE IF NOT EXISTS public.otp_logs (
    id BIGSERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'sms'
    code_preview TEXT,
    status TEXT NOT NULL DEFAULT 'dispatched', -- 'dispatched' | 'verified' | 'failed'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SMS Gateway Dispatches & Status Reports
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SENT' | 'DELIVERED' | 'FAILED'
    device_model TEXT,
    carrier TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Android Gateway Devices
CREATE TABLE IF NOT EXISTS public.devices (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL DEFAULT 'Android Phone',
    carrier TEXT DEFAULT 'Cellular SIM',
    battery INTEGER,
    is_online BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) and allow public read/write if using publishable key
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Permissive policies for gateway backend with anon/publishable key
CREATE POLICY "Allow gateway full access to api_keys" ON public.api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow gateway full access to otp_logs" ON public.otp_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow gateway full access to sms_logs" ON public.sms_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow gateway full access to devices" ON public.devices FOR ALL USING (true) WITH CHECK (true);
