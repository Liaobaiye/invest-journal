import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const empty = () => ({
  users: [],
  posts: [],
  comments: [],
  exchange_config: [],
  alert_configs: [],
  alert_log: [],
  position_records: [],
  settings: {
    site_title: '投资日志',
    site_description: '记录投资日常与交易心得',
  },
  counters: {},
});

let data = empty();
let saveTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDb() {
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      data = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
      if (!data.settings) data.settings = empty().settings;
    } catch (e) {
      console.error('[db] failed to load, starting fresh', e.message);
      data = empty();
    }
  }
  return data;
}

export function saveDb() {
  ensureDir();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

export function flushDb() {
  clearTimeout(saveTimer);
  ensureDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function getDb() {
  return data;
}

export function nextId(collection) {
  data.counters[collection] = (data.counters[collection] || 0) + 1;
  return data.counters[collection];
}

export function now() {
  return new Date().toISOString();
}
