const DB_NAME = "nyx-registration";
const STORE_NAME = "pending-avatars";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(result);
    });
  } finally {
    database.close();
  }
}

export async function savePendingAvatar(email: string, blob: Blob) {
  await runTransaction("readwrite", store => store.put(blob, email.trim().toLowerCase()));
}

export async function loadPendingAvatar(email: string) {
  return runTransaction<Blob | undefined>("readonly", store => store.get(email.trim().toLowerCase()));
}

export async function clearPendingAvatar(email: string) {
  await runTransaction("readwrite", store => store.delete(email.trim().toLowerCase()));
}
