import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

export const dataDir = resolve(process.env.DATA_DIR || ".data");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const keyFile = join(dataDir, "encryption.key");
if (!existsSync(keyFile))
  writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: "wx" });
const key = readFileSync(keyFile);
export function encrypt(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decrypt(value) {
  const [iv, tag, body] = value.split(".").map((v) => Buffer.from(v, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(body), decipher.final()]).toString(),
  );
}
export const db = new DatabaseSync(join(dataDir, "workspace.sqlite"));
chmodSync(join(dataDir, "workspace.sqlite"), 0o600);
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL, json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS kind_idx ON entities(kind); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, json TEXT NOT NULL);",
);
export function list(kind) {
  return db
    .prepare("SELECT json FROM entities WHERE kind=? ORDER BY rowid DESC")
    .all(kind)
    .map((r) => JSON.parse(r.json));
}
export function get(kind, id) {
  const r = db
    .prepare("SELECT json FROM entities WHERE id=? AND kind=?")
    .get(id, kind);
  return r && JSON.parse(r.json);
}
export function put(kind, value) {
  const old = value.id && get(kind, value.id);
  const entity = {
    ...old,
    ...value,
    id: value.id || randomUUID(),
    createdAt: old?.createdAt || value.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO entities VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json WHERE entities.kind=excluded.kind",
  ).run(entity.id, kind, JSON.stringify(entity));
  return entity;
}
export function remove(kind, id) {
  db.prepare("DELETE FROM entities WHERE id=? AND kind=?").run(id, kind);
}
export function setting(key, fallback = null) {
  const r = db.prepare("SELECT json FROM settings WHERE key=?").get(key);
  return r ? JSON.parse(r.json) : fallback;
}
export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json",
  ).run(key, JSON.stringify(value));
}
export function secret(name) {
  return (
    process.env[name] ||
    (setting(`secret:${name}`) ? decrypt(setting(`secret:${name}`)) : "")
  );
}
export function setSecret(name, value) {
  setSetting(`secret:${name}`, encrypt(value));
}
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
