import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { BillSummary } from '../../repositories/billRepository';

const DB_NAME = 'splitbill_mvp.db';
const TABLE_NAME = 'transaction_history';
const CURRENT_SCHEMA_VERSION = 1;
const WEB_STORAGE_KEY = 'splitbill_mvp_transaction_history';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let isInitialized = false;
const isWeb = Platform.OS === 'web';

const readWebItems = async (): Promise<BillSummary[]> => {
  const raw = await AsyncStorage.getItem(WEB_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sortByCreatedDesc(parsed.map(normalize));
  } catch {
    return [];
  }
};

const writeWebItems = async (items: BillSummary[]): Promise<void> => {
  await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(sortByCreatedDesc(items.map(normalize))));
};

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  return dbPromise;
};

const initDb = async (): Promise<void> => {
  if (isInitialized) {
    return;
  }

  const db = await getDb();
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        bill_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        currency TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL,
        participants_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
  }

  isInitialized = true;
};

const sortByCreatedDesc = (items: BillSummary[]): BillSummary[] => {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });
};

const parseParticipants = (raw: string): unknown[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapRowToBill = (row: {
  bill_id: string;
  title: string;
  currency: string;
  total_amount: number;
  status: string;
  participants_json: string;
  created_at: string;
}): BillSummary => ({
  bill_id: row.bill_id,
  title: row.title,
  currency: row.currency,
  total_amount: Number.isFinite(row.total_amount) ? row.total_amount : 0,
  status: row.status,
  participants: parseParticipants(row.participants_json),
  created_at: row.created_at,
});

const normalize = (bill: BillSummary): BillSummary => ({
  bill_id: bill.bill_id,
  title: bill.title || 'Untitled bill',
  currency: bill.currency || 'USD',
  total_amount: Number.isFinite(bill.total_amount) ? bill.total_amount : 0,
  status: bill.status || 'active',
  participants: Array.isArray(bill.participants) ? bill.participants : [],
  created_at: bill.created_at || new Date().toISOString(),
});

export const transactionHistoryStore = {
  async getAll(): Promise<BillSummary[]> {
    if (isWeb) {
      return readWebItems();
    }

    await initDb();
    const db = await getDb();
    const rows = await db.getAllAsync<{
      bill_id: string;
      title: string;
      currency: string;
      total_amount: number;
      status: string;
      participants_json: string;
      created_at: string;
    }>(`SELECT bill_id, title, currency, total_amount, status, participants_json, created_at FROM ${TABLE_NAME}`);

    return sortByCreatedDesc(rows.map(mapRowToBill));
  },

  async replaceAll(items: BillSummary[]): Promise<void> {
    if (isWeb) {
      await writeWebItems(items);
      return;
    }

    await initDb();
    const db = await getDb();
    const normalized = sortByCreatedDesc(items.map(normalize));

    await db.withTransactionAsync(async () => {
      await db.execAsync(`DELETE FROM ${TABLE_NAME}`);
      for (const item of normalized) {
        await db.runAsync(
          `
            INSERT OR REPLACE INTO ${TABLE_NAME}
            (bill_id, title, currency, total_amount, status, participants_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          item.bill_id,
          item.title,
          item.currency,
          item.total_amount,
          item.status,
          JSON.stringify(item.participants || []),
          item.created_at
        );
      }
    });
  },

  async upsert(item: BillSummary): Promise<void> {
    if (isWeb) {
      const existing = await readWebItems();
      const normalized = normalize(item);
      const merged = existing.filter((entry) => entry.bill_id !== normalized.bill_id);
      merged.push(normalized);
      await writeWebItems(merged);
      return;
    }

    await initDb();
    const db = await getDb();
    const normalized = normalize(item);

    await db.runAsync(
      `
        INSERT OR REPLACE INTO ${TABLE_NAME}
        (bill_id, title, currency, total_amount, status, participants_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      normalized.bill_id,
      normalized.title,
      normalized.currency,
      normalized.total_amount,
      normalized.status,
      JSON.stringify(normalized.participants || []),
      normalized.created_at
    );
  },
};
