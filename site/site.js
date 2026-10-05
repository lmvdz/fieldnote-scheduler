const config=JSON.parse(document.getElementById('flow-data').textContent);
const buttons=[...document.querySelectorAll('[data-step]')];
const text=document.getElementById('step-copy'),card=document.getElementById('flow-card');
function showStep(index){const step=config.steps[index];document.body.dataset.step=String(index);buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));text.querySelector('h3').textContent=step.title;text.querySelector('p').textContent=step.text;card.querySelector('.card-value').textContent=step.value;card.querySelector('.card-unit').textContent=step.unit;const rows=card.querySelector('.card-rows');rows.replaceChildren(...step.rows.map(([label,value])=>{const line=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;line.append(dt,dd);return line}));document.getElementById('flow-status').textContent=step.title+' '+step.value+' '+step.unit;document.dispatchEvent(new Event('motionchange'));}
buttons.forEach((button,i)=>button.addEventListener('click',()=>showStep(i)));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),motion=document.getElementById('motion-toggle');let paused=reduced.matches;
function updateMotion(){document.documentElement.classList.toggle('motion-paused',paused);motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'Enable motion':'Pause motion';document.dispatchEvent(new Event('motionchange'));}
motion.addEventListener('click',()=>{paused=!paused;updateMotion()});reduced.addEventListener('change',event=>{paused=event.matches;updateMotion()});updateMotion();
// Native scrolling remains in charge. Only deliberate wheel/touch movement wraps.
// Keyboard, focused closing links, reduced motion and paused motion retain a normal end.
const closing=document.getElementById('return-scene');let frame=0,pointerUntil=0,previous=scrollY;
window.addEventListener('keydown',()=>{pointerUntil=0;});
for(const type of ['wheel','touchmove'])window.addEventListener(type,()=>{pointerUntil=performance.now()+900},{passive:true});
function loop(){frame=0;const top=closing.getBoundingClientRect().top,y=scrollY,focus=document.activeElement;const reading=focus&&(closing.contains(focus)||focus.matches('input,textarea,select,[contenteditable=true]'));
 if(!paused&&!reading&&performance.now()<pointerUntil&&y>previous&&top<=0){const overshoot=Math.max(0,-top);document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,overshoot);document.documentElement.style.removeProperty('scroll-behavior');previous=overshoot;return;}previous=y;}
window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(loop)},{passive:true});
