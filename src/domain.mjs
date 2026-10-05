export const CATALOG = { carpet:{name:'Carpet cleaning',unit:'room',rate:4500}, window:{name:'Window cleaning',unit:'window',rate:1200}, assembly:{name:'Furniture assembly',unit:'item',rate:6000}, cleaning:{name:'Home cleaning',unit:'hour',rate:4500} };
export const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function freshState(){return {version:0,stage:'draft',request:'',service:'carpet',quantity:3,pet:true,lines:[],questions:[],slot:null,approval:null,order:null,payment:null,log:[]};}
export function amount(lines){if(!Array.isArray(lines)||!lines.length||lines.length>10)throw Error('Add between 1 and 10 quote lines.');let sum=0;for(const l of lines){if(!l.description?.trim()||l.description.length>120||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>50||!Number.isInteger(l.rate)||l.rate<0||l.rate>100000)throw Error('Use whole quantities from 1–50 and rates between $0 and $1,000.');sum+=l.quantity*l.rate;}if(sum<100||sum>1000000)throw Error('The quote total must be between $1 and $10,000.');return sum;}
export function requestScopeFacts(request) {
  if (typeof request !== 'string' || request.length < 5 || request.length > 2000) {
    throw Error('Describe the job in 5–2,000 characters.');
  }
  const text = request.toLowerCase();
  const services = [/(carpet|rug)/.test(text) ? 'carpet' : null,
    /window/.test(text) ? 'window' : null,
    /(assembl|furniture|chair|desk)/.test(text) ? 'assembly' : null].filter(Boolean);
  const found = text.match(/\b(\d+)\s*(?:rooms?|windows?|items?|hours?|chairs?|desks?)\b/);
  return {
    service: services.length > 1 ? null : services[0] || (/clean/.test(text) ? 'cleaning' : null),
    quantity: found ? Number(found[1]) : null,
    pet: /\b(pet|dog|cat)\b/.test(text),
    uncertain: /\b(maybe|not sure|possibly|or)\b/.test(text)
  };
}
export function extract(request, details = {}) {
  const facts = requestScopeFacts(request);
  // Explicit null/zero are unresolved human values, not permission to re-infer.
  let service = Object.hasOwn(details, 'service') ? details.service : facts.service;
  const quantity = Number(Object.hasOwn(details, 'quantity') ? details.quantity : facts.quantity);
  const pet = details.pet ?? facts.pet;
  const questions = [];
  if (!service || !CATALOG[service]) { service = null; questions.push('What kind of service do you need?'); }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) questions.push('How many rooms, windows, items, or hours should we include?');
  if (facts.uncertain && !details.clarified) questions.push('Your request has an uncertain detail. Confirm the scope before quoting.');
  if (quantity > 6 && service === 'carpet') questions.push('This job is larger than a single visit. Reduce the scope or arrange a custom visit.');
  const lines = service && quantity > 0 ? [{description: CATALOG[service].name, quantity, rate: CATALOG[service].rate}] : [];
  if (lines.length && service === 'carpet' && pet) lines.push({description: 'Pet treatment', quantity: 1, rate: 2000});
  return {request, service, quantity, pet, questions, lines};
}
export function slotOptions(now=new Date()){const result=[];const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));while(result.length<15){if(day.getUTCDay()>0&&day.getUTCDay()<6){for(const h of [9,12,15])result.push(day.toISOString().slice(0,10)+'T'+String(h).padStart(2,'0')+':00:00.000Z');}day.setUTCDate(day.getUTCDate()+1);}return result;}
export function fixtures(now=new Date()){const s=slotOptions(now);return [s[1],s[6],s[10]];}
export function fingerprint(s){return JSON.stringify({request:s.request,service:s.service,quantity:s.quantity,pet:s.pet,lines:s.lines,slot:s.slot,total:amount(s.lines)});}
export function canEdit(s){if(['creating','capturing','reconciling','booked'].includes(s.stage))throw Error('Finish or reconcile this payment before changing the job.');}
export function edit(s,data){canEdit(s);const n={...s,...data,version:s.version+1,stage:'review',approval:null,order:null,payment:null};if(n.lines.length)amount(n.lines);return n;}
export function approve(s,expectedVersion,now=new Date()){if(s.version!==expectedVersion)throw Error('This quote changed. Review the latest price and time, then approve again.');if(s.questions.length)throw Error('Resolve the open scope questions first.');if(!slotOptions(now).includes(s.slot)||fixtures(now).includes(s.slot))throw Error('Choose an available job slot.');amount(s.lines);return {...s,version:s.version+1,stage:'approved',approval:{fingerprint:fingerprint(s),at:now.toISOString()},order:null};}
export function assertApproved(s){if(!s.approval||s.approval.fingerprint!==fingerprint(s))throw Error('Approve the exact current scope, price, and time before payment.');}
export function verifyCapture(order,expected){const units=order.purchase_units||[];if(order.id!==expected.id||order.status!=='COMPLETED'||units.length!==1)throw Error('Payment is not verified as completed. No booking was made.');const captures=units[0].payments?.captures||[];if(captures.length!==1)throw Error('Expected one completed capture.');const c=captures[0];if(c.status!=='COMPLETED'||c.amount?.currency_code!=='USD'||Math.round(Number(c.amount?.value)*100)!==expected.amount||!c.id)throw Error('Payment amount or currency did not match the approved quote.');if(units[0].custom_id!==expected.session)throw Error('Payment belongs to a different request.');return c.id;}
export function audit(s,text){return {...s,log:[{at:new Date().toISOString(),text},...s.log].slice(0,20)};}
