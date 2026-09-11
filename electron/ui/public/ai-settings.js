// Credentials are decrypted only in Electron's main process and sent directly
// to the local backend. The renderer receives configuration metadata only.
function createAISettings({ storage, safeStorage, request, platform = process.platform }) {
  const storeKey = 'ai-connection';
  let restored = false;
  let activeSettings = null;
  let queue = Promise.resolve();

  const canRemember = () => safeStorage.isEncryptionAvailable() && (
    platform !== 'linux' || (typeof safeStorage.getSelectedStorageBackend === 'function'
      && !['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend()))
  );
  const describe = settings => ({ ...settings, can_remember: canRemember(), remembered: storage.has(storeKey) });
  const restore = async () => {
    if (restored) return;
    if (storage.has(storeKey)) {
      if (!canRemember()) throw new Error('Saved AI settings cannot be unlocked. Remove them or use session settings.');
      let saved;
      try {
        saved = JSON.parse(safeStorage.decryptString(Buffer.from(storage.get(storeKey), 'base64')));
      } catch {
        throw new Error('Saved AI settings cannot be unlocked. Remove them and enter the key again.');
      }
      await request('PUT', saved);
      activeSettings = saved;
    }
    restored = true;
  };

  const operations = {
    async get() {
      await restore();
      return describe(await request('GET'));
    },
    async save(input) {
      if (!input || typeof input.base_url !== 'string' || typeof input.model !== 'string'
          || (input.api_key != null && typeof input.api_key !== 'string')) {
        throw new Error('Enter valid AI settings.');
      }
      const settings = {base_url: input.base_url.trim().replace(/\/+$/, ''), model: input.model.trim(), api_key: (input.api_key || '').trim()};
      if (!settings.api_key && settings.base_url === activeSettings?.base_url) settings.api_key = activeSettings.api_key;
      let encrypted;
      if (input.remember) {
        if (!canRemember()) throw new Error('Protected storage is unavailable. Use settings for this session instead.');
        if (!settings.api_key) throw new Error('Enter the API key to remember these settings.');
        try {
          encrypted = safeStorage.encryptString(JSON.stringify(settings)).toString('base64');
        } catch {
          throw new Error('Unable to protect the API key. Use settings for this session instead.');
        }
      }
      const result = await request('PUT', settings);
      activeSettings = settings;
      restored = true;
      try {
        if (input.remember) storage.set(storeKey, encrypted);
        else storage.delete(storeKey);
      } catch {
        throw new Error('Settings were applied for this session, but the saved settings could not be updated.');
      }
      return describe(result);
    },
    async reset() {
      const result = await request('DELETE');
      storage.delete(storeKey);
      activeSettings = null;
      restored = true;
      return describe(result);
    },
  };

  return (operation, input) => {
    const task = queue.then(async () => {
      if (!operations[operation]) throw new Error('Unknown settings operation.');
      return operations[operation](input);
    });
    queue = task.catch(() => {});
    return task;
  };
}

module.exports = { createAISettings };
