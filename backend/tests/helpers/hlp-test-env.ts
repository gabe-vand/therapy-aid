// Preloaded by bunfig.toml before any test file imports app code. svc-db opens its database at
// import time, so the path must be set first: every test run gets a fresh in-memory SQLite.
process.env.DB_PATH = ':memory:';
process.env.APP_REVISION = 'test';
