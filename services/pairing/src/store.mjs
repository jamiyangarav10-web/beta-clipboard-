const memory = new Map();

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createMemoryStore() {
  return {
    async get(key) {
      return clone(memory.get(key));
    },
    async set(key, value) {
      memory.set(key, clone(value));
    },
    async delete(key) {
      memory.delete(key);
    },
    async clear() {
      memory.clear();
    }
  };
}

export async function createNetlifyBlobStore(name = "localbridge-pairing") {
  const { getStore } = await import("@netlify/blobs");
  const blobs = getStore({ name, consistency: "strong" });
  return {
    async get(key) {
      return await blobs.get(key, { type: "json", consistency: "strong" });
    },
    async set(key, value) {
      await blobs.setJSON(key, value);
    },
    async delete(key) {
      await blobs.delete(key);
    }
  };
}
