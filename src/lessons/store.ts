// Device store for lessons (IndexedDB). Falls back to memory where IndexedDB is unavailable.
const DB = "gf-lessons";
const ST = "lessons";
const mem = new Map<string, unknown>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ST);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(ST, mode).objectStore(ST));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deviceGet<T>(id: string): Promise<T | null> {
  try {
    return ((await tx("readonly", (s) => s.get(id))) as T | undefined) ?? null;
  } catch {
    return (mem.get(id) as T | undefined) ?? null;
  }
}

export async function deviceSet(id: string, value: unknown): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(value, id));
  } catch {
    mem.set(id, value);
  }
}

export async function deviceKeys(): Promise<string[]> {
  try {
    return (await tx("readonly", (s) => s.getAllKeys())) as string[];
  } catch {
    return [...mem.keys()];
  }
}
