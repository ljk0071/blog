// 아주 작은 IndexedDB key-value 저장소. 브라우저 전용(서버에서는 호출하지 않는다: ssrSource: "client").
// IndexedDB를 못 쓰는 환경(사생활 보호 모드 등)에서는 메모리에만 저장해 앱이 깨지지 않게 한다.
const DB_NAME = "garden";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | undefined;
const memory = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  return (dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory.get(key) as T | undefined;
  return (await request<T | undefined>(db, "readonly", (s) => s.get(key))) as T | undefined;
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await open();
  if (!db) {
    memory.set(key, value);
    return;
  }
  await request(db, "readwrite", (s) => s.put(value, key));
}
