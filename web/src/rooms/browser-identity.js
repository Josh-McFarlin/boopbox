const STORAGE_KEY = "boopbox.room-browser-id.v1";
const LOCK_NAME = "boopbox.room-browser-identity.v1";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_ERROR = "Room access needs browser storage and tab coordination. Enable site storage and refresh this page.";

function isUuid(value) {
  return typeof value === "string" && UUID_V4.test(value);
}

function createUuid(crypto) {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID().toLowerCase();
  if (typeof crypto?.getRandomValues !== "function") throw new Error(STORAGE_ERROR);

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getRoomBrowserIdentity(environment = globalThis) {
  let storage;
  let locks;
  let crypto;
  try {
    storage = environment.localStorage;
    locks = environment.navigator?.locks;
    crypto = environment.crypto;
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error(STORAGE_ERROR);
    }
    const existing = storage.getItem(STORAGE_KEY);
    if (isUuid(existing)) return existing.toLowerCase();
  } catch {
    throw new Error(STORAGE_ERROR);
  }

  if (!locks || typeof locks.request !== "function") throw new Error(STORAGE_ERROR);
  try {
    return await locks.request(LOCK_NAME, () => {
      const existing = storage.getItem(STORAGE_KEY);
      if (isUuid(existing)) return existing.toLowerCase();

      const browserId = createUuid(crypto);
      storage.setItem(STORAGE_KEY, browserId);
      const persisted = storage.getItem(STORAGE_KEY);
      if (!isUuid(persisted)) throw new Error(STORAGE_ERROR);
      return persisted.toLowerCase();
    });
  } catch {
    throw new Error(STORAGE_ERROR);
  }
}
