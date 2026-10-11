import assert from 'node:assert/strict';
import test from 'node:test';
import {createDeskServer} from '../scripts/serve-desk.mjs';

test('the desk serves its page and modules without exposing repository files', async () => {
  const server = createDeskServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Creator Desk/);
    assert.equal((await fetch(origin + '/workflow.mjs')).status, 200);
    assert.equal((await fetch(origin + '/.env')).status, 404);
    assert.equal((await fetch(origin + '/package.json')).status, 404);
    assert.equal((await fetch(origin, {method: 'POST'})).status, 405);
  } finally {await new Promise<void>((resolve) => server.close(() => resolve()));}
});
