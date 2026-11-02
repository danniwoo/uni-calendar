type SecureStore = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };

// Keep each Keychain value below the historical ~2 KB boundary. A new manifest
// is committed only once every chunk is written; interrupted writes retain the
// previous complete session. The random generation is an opaque storage suffix.
export function chunkedSessionStorage(store: SecureStore, uniqueId: () => string) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = queue.then(fn, fn); queue = result.catch(() => {}); return result;
  };
  const manifest = async (key: string): Promise<{ generation: string; count: number } | null> => {
    const raw = await store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!/^[a-zA-Z0-9-]+$/.test(parsed.generation) || !Number.isInteger(parsed.count) || parsed.count < 1 || parsed.count > 256)
      throw new Error("Stored session is unreadable. Sign out and try again.");
    return parsed;
  };
  const clean = async (key: string, old: { generation: string; count: number } | null) => {
    if (old) await Promise.all(Array.from({length:old.count},(_,i)=>store.removeItem(`${key}.${old.generation}.${i}`)));
  };
  return {
    getItem: (key: string) => serial(async () => {
      const m = await manifest(key); if (!m) return null;
      const chunks = await Promise.all(Array.from({length:m.count},(_,i)=>store.getItem(`${key}.${m.generation}.${i}`)));
      if (chunks.some(c=>c===null)) throw new Error("Stored session is incomplete. Sign out and try again.");
      return chunks.join("");
    }),
    setItem: (key: string, value: string) => serial(async () => {
      const old = await manifest(key), generation = uniqueId(), points = Array.from(value), chunks: string[] = [];
      for (let i=0;i<points.length;i+=400) chunks.push(points.slice(i,i+400).join(""));
      if (!chunks.length) chunks.push("");
      if (chunks.length > 256) throw new Error("Session is too large to save securely.");
      const next = {generation,count:chunks.length};
      try {
        for (let i=0;i<chunks.length;i++) await store.setItem(`${key}.${generation}.${i}`,chunks[i]);
        await store.setItem(key,JSON.stringify(next));
      } catch (error) { await clean(key,next).catch(()=>{}); throw error; }
      await clean(key,old).catch(()=>{});
    }),
    removeItem: (key: string) => serial(async () => {
      const old = await manifest(key).catch(()=>null); await store.removeItem(key); await clean(key,old);
    }),
  };
}
