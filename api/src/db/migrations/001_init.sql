-- GridSight initial schema
-- References: IEC 60076 (transformer specifications), IEEE C57.91 (loading guide)

CREATE TABLE IF NOT EXISTS assets (
  id                       TEXT    PRIMARY KEY,
  name                     TEXT    NOT NULL,
  asset_type               TEXT    NOT NULL CHECK (asset_type IN ('distribution_transformer','mv_lv_substation','feeder_breaker')),
  primary_voltage_kv       REAL    NOT NULL,
  secondary_voltage_kv     REAL    NOT NULL,
  rated_power_kva          REAL    NOT NULL,
  oil_type                 TEXT    NOT NULL CHECK (oil_type IN ('mineral','ester','silicone','dry')),
  install_year             INTEGER NOT NULL,
  location_name            TEXT    NOT NULL,
  location_lat             REAL,
  location_lng             REAL,
  last_inspection_date     TEXT,
  cooling_class            TEXT    NOT NULL DEFAULT 'ONAN',
  created_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telemetry (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id          TEXT    NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  ts                TEXT    NOT NULL,
  oil_temp_c        REAL    NOT NULL,
  winding_temp_c    REAL    NOT NULL,
  ambient_temp_c    REAL    NOT NULL,
  load_factor       REAL    NOT NULL,
  voltage_pu        REAL    NOT NULL,
  current_a         REAL    NOT NULL,
  dga_h2_ppm        REAL    NOT NULL,
  dga_ch4_ppm       REAL    NOT NULL,
  dga_c2h2_ppm      REAL    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_asset_ts ON telemetry(asset_id, ts DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT    PRIMARY KEY,
  asset_id    TEXT    NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  rule        TEXT    NOT NULL,
  severity    TEXT    NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  message     TEXT    NOT NULL,
  status      TEXT    NOT NULL CHECK (status IN ('open','ack','resolved')) DEFAULT 'open',
  raised_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  acked_at    TEXT,
  ack_user    TEXT,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_status_raised ON alerts(status, raised_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_asset ON alerts(asset_id);

CREATE TABLE IF NOT EXISTS recommendations_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id     TEXT    NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  alert_id     TEXT             REFERENCES alerts(id) ON DELETE SET NULL,
  source       TEXT    NOT NULL CHECK (source IN ('live','fixture')),
  payload_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rec_asset_created ON recommendations_cache(asset_id, created_at DESC);
