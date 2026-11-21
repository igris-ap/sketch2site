// Saves the whole project in IndexedDB. Not localStorage: that caps out at
// ~5MB of strings per site, and a few phone-photo sketches plus assets as
// data URLs blow through that. IndexedDB allows hundreds of MB.

const DB = 'sketch2site', STORE = 'project', KEY = 'current'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export const loadProject = () => run('readonly', s => s.get(KEY))
export const saveProject = project => run('readwrite', s => s.put(project, KEY))
export const clearProject = () => run('readwrite', s => s.delete(KEY))
