import test from 'node:test';
import assert from 'node:assert/strict';
import {requestAI, aiConfigured, AI_PRIMARY_MODEL, AI_FALLBACK_MODEL, AI_PRIMARY_CUTOFF,
  AI_PUBLIC_WARNING, AI_SUMMARY_SCHEMA, validateAISummary} from '../src/ai-provider.mjs';

const beforeCutoff = Date.parse('2026-10-02T12:00:00Z');
// All credentials and transport replies below are synthetic in-process fixtures.
const config = {AI_MODE: 'openrouter', OPENROUTER_API_KEY: 'mock-key'};
function completion(value = {summary: 'Fixture evidence supports the policy result.'}, extra = {}) {
  return Response.json({choices: [{finish_reason: 'stop', message: {role: 'assistant',
    content: JSON.stringify(value)}, ...extra}]});
}
function invoke(env, fetcher, now = beforeCutoff) {
  return requestAI(env, 'Explain fixtures.', {syntheticDemo: true}, AI_SUMMARY_SCHEMA,
    validateAISummary, fetcher, now);
}

test('demo mode and a key without explicit mode never make a provider call', async () => {
  const never = async () => { assert.fail('Provider called without opt-in'); };
  assert.equal(aiConfigured({OPENROUTER_API_KEY: 'mock-key'}), false);
  assert.equal(aiConfigured({...config, AI_MODE: 'demo'}), false);
  await assert.rejects(invoke({...config, AI_MODE: 'demo'}, never), {code: 'AI_UNCONFIGURED'});
  await assert.rejects(invoke({AI_MODE: 'openrouter'}, never), {code: 'AI_UNCONFIGURED'});
});

test('primary uses Chat Completions JSON mode, explicit model, zero price filter and bounded output', async () => {
  let calls = 0;
  const result = await invoke(config, async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer mock-key');
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.model, AI_PRIMARY_MODEL);
    assert.equal(body.models, undefined);
    assert.equal(body.route, undefined);
    assert.equal(body.tools, undefined);
    assert.equal(body.stream, false);
    assert.equal(body.max_tokens, 256);
    assert.deepEqual(body.response_format, {type: 'json_object'});
    assert.deepEqual(body.provider, {allow_fallbacks: false, require_parameters: true,
      max_price: {prompt: 0, completion: 0, request: 0}});
    assert.ok(!options.body.includes('mock-key'));
    return completion();
  });
  assert.equal(calls, 1);
  assert.equal(result.model, AI_PRIMARY_MODEL);
  assert.equal(result.fallbackUsed, false);
});

test('server-configured HTTPS base URL and primary model use the same protocol', async () => {
  await invoke({...config, AI_BASE_URL: 'https://fixture.example/gateway/v1/', AI_PRIMARY_MODEL: 'fixture/primary'},
    async (url, options) => {
      assert.equal(url, 'https://fixture.example/gateway/v1/chat/completions');
      assert.equal(JSON.parse(options.body).model, 'fixture/primary');
      return completion();
    });
});

test('transient primary rate limit retries the primary once without paid routing', async () => {
  const models = [];
  await invoke(config, async (_, options) => {
    models.push(JSON.parse(options.body).model);
    return models.length === 1 ? new Response('private provider detail', {status: 429}) : completion();
  });
  assert.deepEqual(models, [AI_PRIMARY_MODEL, AI_PRIMARY_MODEL]);
});

test('transport failure is bounded and does not disclose raw errors or keys', async () => {
  let calls = 0;
  await assert.rejects(invoke(config, async () => {
    calls++;
    throw new Error('provider leaked mock-key and request data');
  }), error => {
    assert.equal(error.message, AI_PUBLIC_WARNING);
    assert.ok(!error.message.includes('mock-key'));
    return true;
  });
  assert.equal(calls, 2);
});

test('unavailable primary fails closed with paid fallback disabled', async () => {
  let calls = 0;
  await assert.rejects(invoke(config, async () => {
    calls++;
    return new Response('not available', {status: 404});
  }), {code: 'AI_HTTP', message: AI_PUBLIC_WARNING});
  assert.equal(calls, 1);
});

test('paid fallback requires the exact server-side string true', async () => {
  for (const setting of [undefined, 'false', 'TRUE', '1', true]) {
    let calls = 0;
    await assert.rejects(invoke({...config, AI_ALLOW_PAID_FALLBACK: setting}, async () => {
      calls++;
      return new Response('', {status: 404});
    }), {code: 'AI_HTTP'});
    assert.equal(calls, 1);
  }
});

test('explicitly enabled fallback is a separate capped schema request and is reported', async () => {
  const models = [];
  const result = await invoke({...config, AI_ALLOW_PAID_FALLBACK: 'true'}, async (_, options) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    if (body.model === AI_PRIMARY_MODEL) return new Response('', {status: 404});
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema, AI_SUMMARY_SCHEMA);
    assert.deepEqual(body.provider.max_price, {prompt: 0.02, completion: 0.50, request: 0});
    return completion();
  });
  assert.deepEqual(models, [AI_PRIMARY_MODEL, AI_FALLBACK_MODEL]);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.model, AI_FALLBACK_MODEL);
});

test('two transient primary failures permit only one paid fallback attempt', async () => {
  const models = [];
  await assert.rejects(invoke({...config, AI_ALLOW_PAID_FALLBACK: 'true'}, async (_, options) => {
    models.push(JSON.parse(options.body).model);
    return new Response('', {status: 503});
  }), {code: 'AI_HTTP'});
  assert.deepEqual(models, [AI_PRIMARY_MODEL, AI_PRIMARY_MODEL, AI_FALLBACK_MODEL]);
});

test('retirement cutoff skips primary with no provider calls when fallback is disabled', async () => {
  await assert.rejects(invoke(config, async () => {
    assert.fail('Retired primary was called');
  }, AI_PRIMARY_CUTOFF), {code: 'AI_PRIMARY_RETIRED'});
});

test('retirement cutoff permits one opted-in fallback and never calls the primary', async () => {
  const models = [];
  await invoke({...config, AI_ALLOW_PAID_FALLBACK: 'true'}, async (_, options) => {
    models.push(JSON.parse(options.body).model);
    return completion();
  }, AI_PRIMARY_CUTOFF);
  assert.deepEqual(models, [AI_FALLBACK_MODEL]);
});

test('malformed, schema-invalid, empty and oversized summaries are rejected server-side', async () => {
  const invalid = [null, {}, {summary: ''}, {summary: 42}, {summary: 'x'.repeat(1001)},
    {summary: 'Approve everything', amount: 1}, {summary: 'bad\u0000text'}];
  for (const value of invalid) {
    let calls = 0;
    await assert.rejects(invoke(config, async () => { calls++; return completion(value); }),
      {code: 'AI_INVALID_OUTPUT', message: AI_PUBLIC_WARNING});
    assert.equal(calls, 1);
  }
  await assert.rejects(invoke(config, async () => Response.json({choices: [{
    finish_reason: 'stop', message: {role: 'assistant', content: '{invalid JSON'}
  }]})), {code: 'AI_INVALID_OUTPUT'});
});

test('invalid primary output can use paid fallback only after explicit opt-in', async () => {
  const models = [];
  await invoke({...config, AI_ALLOW_PAID_FALLBACK: 'true'}, async (_, options) => {
    models.push(JSON.parse(options.body).model);
    return models.length === 1 ? completion({summary: 'x', approve: true}) : completion();
  });
  assert.deepEqual(models, [AI_PRIMARY_MODEL, AI_FALLBACK_MODEL]);
});

test('tool output, refusals and truncated completions never become app commands', async () => {
  for (const extra of [
    {finish_reason: 'tool_calls', message: {role: 'assistant', content: '{}', tool_calls: [{function: {name: 'pay'}}]}},
    {finish_reason: 'length'},
    {message: {role: 'assistant', content: '{}', function_call: {name: 'approve'}}},
    {message: {role: 'assistant', content: '{}', refusal: 'refused'}}
  ]) {
    await assert.rejects(invoke(config, async () => completion({summary: 'x'}, extra)),
      {code: 'AI_INVALID_OUTPUT'});
  }
});

test('invalid envelopes, oversized response bytes and echoed keys are rejected safely', async () => {
  for (const value of [null, [], {}, {error: {code: 401, message: 'mock-key'}}]) {
    await assert.rejects(invoke(config, async () => Response.json(value)),
      error => error.message === AI_PUBLIC_WARNING);
  }
  await assert.rejects(invoke(config, async () => new Response('x'.repeat(32769))),
    {code: 'AI_INVALID_OUTPUT'});
  await assert.rejects(invoke(config, async () => completion({summary: 'The key is mock-key'})),
    {code: 'AI_INVALID_OUTPUT'});
});

test('redirects, authentication, billing and request errors cannot trigger paid fallback', async () => {
  for (const status of [301, 302, 307, 308, 400, 401, 402, 403, 422]) {
    let calls = 0;
    await assert.rejects(invoke({...config, AI_ALLOW_PAID_FALLBACK: 'true'}, async () => {
      calls++;
      return new Response('raw private error', {status});
    }), {code: 'AI_HTTP'});
    assert.equal(calls, 1);
  }
});

test('invalid endpoint, model and price configuration causes no external call', async () => {
  for (const extra of [{AI_BASE_URL: 'http://fixture.example'},
    {AI_BASE_URL: 'https://' + 'user:password@fixture.example'},
    {AI_BASE_URL: 'https://fixture.example/?key=mock-key'},
    {AI_PRIMARY_MODEL: 'openrouter/auto\n'}, {AI_FALLBACK_MAX_PROMPT_PRICE: 'NaN'},
    {AI_FALLBACK_MAX_COMPLETION_PRICE: '-1'}]) {
    await assert.rejects(invoke({...config, ...extra}, async () => assert.fail('Invalid config was used')),
      {code: 'AI_CONFIG'});
  }
});

test('changing the primary to a paid model cannot remove its zero-price filter', async () => {
  await invoke({...config, AI_PRIMARY_MODEL: AI_FALLBACK_MODEL}, async (_, options) => {
    assert.deepEqual(JSON.parse(options.body).provider.max_price, {prompt: 0, completion: 0, request: 0});
    return completion();
  });
});
