const config=JSON.parse(document.getElementById('flow-data').textContent);
const buttons=[...document.querySelectorAll('[data-step]')];
const text=document.getElementById('step-copy'),card=document.getElementById('flow-card');
function showStep(index){const step=config.steps[index];document.body.dataset.flowStep=String(index);buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));text.querySelector('h3').textContent=step.title;text.querySelector('p').textContent=step.text;card.querySelector('.card-value').textContent=step.value;card.querySelector('.card-unit').textContent=step.unit;const rows=card.querySelector('.card-rows');rows.replaceChildren(...step.rows.map(([label,value])=>{const line=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;line.append(dt,dd);return line}));document.getElementById('flow-status').textContent=step.title+' '+step.value+' '+step.unit;document.dispatchEvent(new Event('motionchange'));}
buttons.forEach((button,i)=>button.addEventListener('click',()=>showStep(i)));
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),motion=document.getElementById('motion-toggle');let paused=reduced.matches;
function updateMotion(){document.documentElement.classList.toggle('motion-paused',paused);motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'Enable motion':'Pause motion';document.dispatchEvent(new Event('motionchange'));}
motion.addEventListener('click',()=>{paused=!paused;updateMotion()});reduced.addEventListener('change',event=>{paused=event.matches;updateMotion()});updateMotion();
// Native scrolling remains in charge; only a deliberate forward gesture wraps.
const closing=document.getElementById('return-scene');let frame=0,pointerUntil=0,previous=scrollY,touching=false,touchStart=0,touchDelta=0;
const editing=()=>document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
function wrap(overshoot=0){document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,overshoot);document.documentElement.style.removeProperty('scroll-behavior');previous=overshoot;}
window.addEventListener('keydown',()=>{pointerUntil=0;});
window.addEventListener('wheel',event=>{if(event.deltaY>0)pointerUntil=performance.now()+900;else pointerUntil=0;},{passive:true});
window.addEventListener('touchstart',event=>{touching=true;touchStart=event.touches[0].clientY;touchDelta=0;pointerUntil=0;},{passive:true});
window.addEventListener('touchmove',event=>{touchDelta=touchStart-event.touches[0].clientY;},{passive:true});
window.addEventListener('touchend',()=>{touching=false;if(!paused&&!editing()&&touchDelta>24&&closing.getBoundingClientRect().top<=1){pointerUntil=0;requestAnimationFrame(()=>wrap(Math.max(0,-closing.getBoundingClientRect().top)));}touchDelta=0;},{passive:true});
window.addEventListener('touchcancel',()=>{touching=false;touchDelta=0;},{passive:true});
function loop(){frame=0;const top=closing.getBoundingClientRect().top,y=scrollY,focus=document.activeElement;const reading=focus&&(closing.contains(focus)||editing());
 if(!touching&&!paused&&!reading&&performance.now()<pointerUntil&&y>previous&&top<=0){wrap(Math.max(0,-top));return;}previous=y;}
window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(loop)},{passive:true});
