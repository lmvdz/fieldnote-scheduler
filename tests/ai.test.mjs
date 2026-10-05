import test from 'node:test';
import assert from 'node:assert/strict';
import {draftRequest, AI_SYNTHETIC_REQUESTS, validateAIScope} from '../src/ai.mjs';
import {freshState, approve} from '../src/domain.mjs';

const now = Date.parse('2026-10-02T12:00:00Z');
const config = {AI_MODE: 'openrouter', OPENROUTER_API_KEY: 'mock-key'};
const scope = {service: 'carpet', quantity: 3, pet: true, clarified: false};
const reply = value => Response.json({choices: [{finish_reason: 'stop',
  message: {role: 'assistant', content: JSON.stringify(value)}}]});

test('scheduler validates a synthetic primary draft and prices it with local catalog rules', async () => {
  const result = await draftRequest(config, AI_SYNTHETIC_REQUESTS[0], {}, async (_, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(body.messages[1].content), {syntheticDemo: true, request: AI_SYNTHETIC_REQUESTS[0]});
    return reply(scope);
  }, now);
  assert.equal(result.engine, 'openrouter');
  assert.equal(result.quantity, 3);
  assert.deepEqual(result.lines.map(line => line.rate), [4500, 2000]);
  assert.equal(result.approval, undefined);
  assert.equal(result.order, undefined);
});

test('custom customer text remains local even when a provider is configured', async () => {
  const result = await draftRequest(config, 'Private customer details: clean 3 rooms of carpet', {},
    async () => assert.fail('Custom text left the server'), now);
  assert.equal(result.engine, 'rules');
  assert.match(result.aiWarning, /stays local/);
  assert.equal(result.quantity, 3);
});

test('malformed, tool and policy-changing AI output return a safe deterministic draft', async () => {
  for (const value of [{...scope, rate: 1}, {...scope, clarified: true},
    {...scope, quantity: 3.5}, {...scope, quantity: 500}, {...scope, service: 'wire-transfer'},
    {...scope, pet: 'false'}, {service: null}]) {
    assert.throws(() => validateAIScope(value));
    const result = await draftRequest(config, AI_SYNTHETIC_REQUESTS[0], {}, async () => reply(value), now);
    assert.equal(result.engine, 'rules');
    assert.ok(result.aiWarning);
    assert.equal(result.lines[0].rate, 4500);
  }
  const result = await draftRequest(config, AI_SYNTHETIC_REQUESTS[0], {}, async () => Response.json({choices: [{
    finish_reason: 'tool_calls', message: {role: 'assistant', content: null, tool_calls: [{function: {name: 'book'}}]}
  }]}), now);
  assert.equal(result.engine, 'rules');
});

test('unavailable primary without paid opt-in preserves manual scope and sanitized fallback', async () => {
  let calls = 0;
  const result = await draftRequest(config, AI_SYNTHETIC_REQUESTS[0], {quantity: 4}, async () => {
    calls++; return new Response('mock-key and private provider body', {status: 404});
  }, now);
  assert.equal(calls, 1);
  assert.equal(result.engine, 'rules');
  assert.equal(result.quantity, 4);
  assert.ok(!JSON.stringify(result).includes('mock-key'));
});

test('explicit paid fallback draft is labeled and cannot approve an uncertain request', async () => {
  let calls = 0;
  const result = await draftRequest({...config, AI_ALLOW_PAID_FALLBACK: 'true'}, AI_SYNTHETIC_REQUESTS[1], {}, async () => {
    calls++; return calls === 1 ? new Response('', {status: 404}) : reply({...scope, quantity: null});
  }, now);
  assert.equal(calls, 2);
  assert.equal(result.engine, 'openrouter');
  assert.equal(result.aiPaidFallback, true);
  assert.ok(result.questions.length);
  assert.throws(() => approve({...freshState(), ...result}, 0), /scope questions/);
});
