const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createAISettings} = require('../ui/public/ai-settings');

function setup(platform = 'darwin') {
  const values = new Map();
  const storage = {get: key => values.get(key), set: (key, val) => values.set(key, val), has: key => values.has(key), delete: key => values.delete(key)};
  // Tests use a reversible fixture cipher to verify which values cross the
  // persistence boundary. The app uses Electron's operating-system encryption.
  const safeStorage = {isEncryptionAvailable: () => true,
    encryptString: text => Buffer.from(text.split('').reverse().join('')),
    decryptString: buffer => buffer.toString().split('').reverse().join('')};
  let current = {available: false, source: 'none', base_url: '', model: 'default'};
  const requests = [];
  const request = async (method, data) => {
    requests.push({method, data});
    if (method === 'PUT') current = {available: true, source: 'user', base_url: data.base_url, model: data.model};
    if (method === 'DELETE') current = {available: false, source: 'none', base_url: '', model: 'default'};
    return current;
  };
  const deps = {storage, safeStorage, request, platform};
  return {values, requests, deps, settings: createAISettings(deps)};
}

const input = {api_key: 'fixture-secret', base_url: 'https://provider.example/v1', model: 'model', remember: true};

test('remembered keys are encrypted and restored directly into the backend', async () => {
  const {settings, values, requests, deps} = setup();
  const saved = await settings('save', input);
  assert.equal(saved.remembered, true);
  assert.ok(!JSON.stringify([...values]).includes(input.api_key));
  assert.ok(!JSON.stringify(saved).includes(input.api_key));
  const restored = await createAISettings(deps)('get');
  assert.equal(restored.available, true);
  assert.equal(requests.at(-2).data.api_key, input.api_key);
  assert.ok(!JSON.stringify(restored).includes(input.api_key));
});

test('session settings remove remembered credentials and reset restores environment fallback', async () => {
  const {settings, values} = setup();
  await settings('save', input);
  const saved = await settings('save', {...input, api_key: '', model: 'new-model', remember: false});
  assert.equal(saved.remembered, false);
  assert.equal(values.size, 0);
  assert.equal((await settings('reset')).source, 'none');
});

test('remembering requires protected storage and a key for a changed endpoint', async () => {
  const {settings} = setup();
  await settings('save', input);
  await assert.rejects(settings('save', {...input, api_key: '', base_url: 'https://different.example'}), /Enter the API key/);
  const linux = setup('linux');
  await assert.rejects(linux.settings('save', input), /Protected storage is unavailable/);
  assert.equal(linux.values.size, 0);
  assert.equal((await linux.settings('save', {...input, remember: false})).available, true);
});

test('failed saves preserve the last remembered settings', async () => {
  const {settings, values, deps} = setup();
  await settings('save', input);
  const previous = values.get('ai-connection');
  const failing = createAISettings({...deps, request: async () => {throw new Error('Backend unavailable');}});
  await assert.rejects(failing('save', {...input, api_key: 'replacement-secret'}), /Backend unavailable/);
  assert.equal(values.get('ai-connection'), previous);
});
