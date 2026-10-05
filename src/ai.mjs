import {extract, requestScopeFacts} from './domain.mjs';
import {aiConfigured, requestAI, AI_PUBLIC_WARNING} from './ai-provider.mjs';

// Only these canonical synthetic examples may leave the server. Custom text stays with local rules.
export const AI_SYNTHETIC_REQUESTS = [
  "I'd like 3 rooms of carpet cleaned, with pet treatment. A weekday morning would work well.",
  'Maybe clean the carpet or the windows. I am not sure how much needs doing.',
  'Please clean 6 windows. No extra treatment needed.',
  'Clean 3 rooms of carpet with pet treatment'
];
export const AI_SCOPE_SCHEMA = {
  type: 'object',
  properties: {
    service: {type: ['string', 'null'], enum: ['carpet', 'window', 'assembly', 'cleaning', null]},
    quantity: {type: ['integer', 'null'], minimum: 1, maximum: 50},
    pet: {type: 'boolean'},
    clarified: {type: 'boolean', const: false}
  },
  required: ['service', 'quantity', 'pet', 'clarified'],
  additionalProperties: false
};

export function validateAIScope(value) {
  const fields = ['service', 'quantity', 'pet', 'clarified'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field)) ||
      !['carpet', 'window', 'assembly', 'cleaning', null].includes(value.service) ||
      !(value.quantity === null || Number.isInteger(value.quantity) && value.quantity >= 1 && value.quantity <= 50) ||
      typeof value.pet !== 'boolean' || value.clarified !== false) {
    throw new Error('Invalid AI scope.');
  }
  return value;
}

export function validateGroundedAIScope(value, request) {
  const checked = validateAIScope(value);
  const facts = requestScopeFacts(request);
  if (checked.quantity !== facts.quantity || checked.pet !== facts.pet ||
      facts.service !== null && checked.service !== facts.service) {
    throw new Error('AI scope contradicts the fictional request.');
  }
  // Multiple named services cannot be resolved by a model choosing a valid enum.
  // Null survives extract(); explicit local human details can resolve it later.
  return {...checked, service: facts.service === null ? null : checked.service};
}

export async function draftRequest(env, request, details = {}, fetcher = fetch, now = Date.now()) {
  const deterministic = {...extract(request, details), engine: 'rules',
    aiModel: null, aiPaidFallback: false, aiWarning: null};
  if (!aiConfigured(env)) return deterministic;
  const fixture = AI_SYNTHETIC_REQUESTS.find(text => text === request.trim());
  if (!fixture) return {...deterministic,
    aiWarning: 'Custom request text stays local. OpenRouter is limited to the built-in synthetic demo examples.'};
  try {
    const result = await requestAI(env,
      'Extract the fictional service request. Return only service (carpet, window, assembly, cleaning or null), ' +
      'quantity (integer 1-50 or null), pet (boolean), clarified (always false). ' +
      'Do not invent missing quantities, set rates, calculate totals, set a slot, approve or book.',
      {syntheticDemo: true, request: fixture}, AI_SCOPE_SCHEMA,
      value => validateGroundedAIScope(value, fixture), fetcher, now);
    return {...extract(request, {...result.value, ...details}), engine: 'openrouter', aiWarning: null,
      aiModel: result.model, aiPaidFallback: result.fallbackUsed};
  } catch {
    return {...deterministic, aiWarning: AI_PUBLIC_WARNING};
  }
}
