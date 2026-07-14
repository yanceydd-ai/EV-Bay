CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bays (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'occupied', 'unknown')),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bay_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bay_id INTEGER NOT NULL REFERENCES bays(id),
  previous_status TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'occupied', 'unknown')),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_sms BOOLEAN NOT NULL DEFAULT false,
  min_open_bays INTEGER NOT NULL DEFAULT 1,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  verified_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_bay_count INTEGER NOT NULL,
  bay_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id UUID NOT NULL REFERENCES notification_events(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO bays (id, label, status)
VALUES
  (1, 'Bay 1', 'unknown'),
  (2, 'Bay 2', 'unknown'),
  (3, 'Bay 3', 'unknown'),
  (4, 'Bay 4', 'unknown')
ON CONFLICT (id) DO NOTHING;

