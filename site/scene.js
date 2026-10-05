(()=>{
// Original procedural sculptures. No reference-site assets, models, or code.
const canvas=document.getElementById('world');
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
const variant=Number(document.body.dataset.world);
const vertex=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
uniform vec2 resolution,pointer;uniform float time,journey,spread;uniform int world;
const float PI=3.14159265359;
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float box(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float ring(vec3 p,float r,float t){return length(vec2(length(p.xz)-r,p.y))-t;}
vec2 nearer(vec2 a,vec2 b){return a.x<b.x?a:b;}
float arc(vec3 p,float radius,float thick,float end){float a=atan(p.z,p.x);if(abs(a)<end)return ring(p,radius,thick);vec3 cap=vec3(cos(end),0.,sign(a)*sin(end))*radius;return length(p-cap)-thick;}
vec2 sculpture(vec3 p){
 vec2 d=vec2(100.,0.);
 if(world==0){
  p.y-=1.7;p.yz=turn(.48)*p.yz;p.xz=turn(-.55+journey*.1)*p.xz;
  for(int i=0;i<5;i++){float f=float(i);vec3 q=p;float a=f*.26;q.xz=turn(a)*q.xz;q.y-=(f-2.)*(.23+spread*.32);q.x+=sin(f)*spread*.25;
   d=nearer(d,vec2(arc(q,1.28-f*.11,.105,2.55-f*.07),mod(f,2.)<.5?1.:2.));
   vec3 e=q-vec3(cos(2.84)* (1.28-f*.11),0.,sin(2.84)*(1.28-f*.11));e.x-=spread*.65;e.y+=spread*.12;d=nearer(d,vec2(length(e)-.112,3.));
  }
  d=nearer(d,vec2(length(p)-.38,2.));
 }else if(world==1){
  p.y-=1.55;p.xz=turn(.32)*p.xz;
  for(int i=0;i<9;i++){float f=float(i),level=floor(f/3.),lane=mod(f,3.)-1.;vec3 q=p;q.y-=(level-1.)*(.73+spread*.45);float a=level*1.05;vec2 xy=turn(a)*vec2(lane*(.86+spread*.36),0.);q.xz-=xy;q.xz=turn(a)*q.xz;
   d=nearer(d,vec2(box(q,vec3(.36,.26,.37),.08),lane==0.?2.:1.));
   vec3 inset=q-vec3(0.,.315,0.);d=nearer(d,vec2(box(inset,vec3(.25,.013,.25),.012),3.));
  }
  d=nearer(d,vec2(box(p,vec3(.055,1.15,.055),.015),3.));
 }else{
  p.y-=1.8;p.yz=turn(.64)*p.yz;p.xz=turn(-.3)*p.xz;
  for(int i=0;i<3;i++){float f=float(i);vec3 q=p;q.y-=(f-1.)*(.29+spread*.55);q.xz=turn(f*.5+spread*.4)*q.xz;d=nearer(d,vec2(arc(q,1.37-f*.22,.075,2.8-f*.26),f==1.?2.:1.));}
  for(int i=0;i<12;i++){float f=float(i);float a=f*PI/6.;vec3 q=p-vec3(cos(a)*1.12,0.,sin(a)*1.12);q.xz=turn(-a)*q.xz;d=nearer(d,vec2(box(q,vec3(.045,.12,.075),.018),3.));}
  vec3 hand=p;hand.xz=turn(-.65+spread*.8)*hand.xz;hand.x-=.4;d=nearer(d,vec2(box(hand,vec3(.65,.045,.035),.025),2.));
  d=nearer(d,vec2(length(p)-.24,3.));
 }
 return d;
}
float terrain(vec3 p){
 float d=length(p.xz),edge=smoothstep(2.8,7.,d);
 float height=.0;
 if(world==0){height=(.28+.23*sin(p.x*.62+p.z*.32)+.12*sin(p.z*.8))*edge;}
 else if(world==1){height=(.19+.11*sin(p.x*.43)*sin(p.z*.53))*edge;}
 else{height=(.19+.17*sin(d*.85+p.x*.15))*edge;}
 return (p.y+.04-height)*.75;
}
vec2 map(vec3 p){
 vec2 d=nearer(sculpture(p),vec2(terrain(p),4.));
 // Low architectural terraces give each world foreground and distant depth.
 if(world==0){vec3 q=p;q.y+=.10;d=nearer(d,vec2(ring(q,3.5,.16),5.));q.y+=.06;d=nearer(d,vec2(ring(q,5.3,.22),5.));}
 else if(world==1){for(int i=0;i<4;i++){float f=float(i);vec3 q=p-vec3((mod(f,2.)-.5)*8.,.10,-3.-floor(f/2.)*4.);d=nearer(d,vec2(box(q,vec3(1.3,.18,.8),.12),5.));}}
 else{vec3 q=p;q.y+=.09;q.xz=turn(.3)*q.xz;d=nearer(d,vec2(ring(q,3.4,.12),5.));q.x+=1.;q.z+=2.;q.y+=.10;d=nearer(d,vec2(ring(q,5.,.16),5.));}
 return d;
}
vec3 normal(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}
float shadow(vec3 p,vec3 l){float s=1.,t=.04;for(int i=0;i<24;i++){float h=sculpture(p+l*t).x;s=min(s,12.*h/t);t+=clamp(h,.035,.25);if(t>6.||s<.02)break;}return clamp(s,.0,1.);}
vec3 palette(float id){
 if(world==0){if(id<1.5)return vec3(.62,.76,.75);if(id<2.5)return vec3(.12,.43,.42);return vec3(.77,.35,.18);}
 if(world==1){if(id<1.5)return vec3(.44,.51,.37);if(id<2.5)return vec3(.13,.24,.17);return vec3(.87,.49,.15);}
 if(id<1.5)return vec3(.62,.64,.77);if(id<2.5)return vec3(.30,.27,.55);return vec3(.76,.46,.23);
}
vec3 sky(vec3 rd){vec3 base=world==0?vec3(.91,.91,.86):world==1?vec3(.84,.88,.79):vec3(.86,.85,.91);return base+vec3(.055)*rd.y;}
vec3 environment(vec3 r){vec3 c=sky(r)*.62;float window=pow(max(0.,dot(r,normalize(vec3(-1.8,3.,2.)))),14.);c+=vec3(1.5)*window;float dark=pow(max(0.,dot(r,normalize(vec3(2.,.3,1.)))),9.);c*=1.-dark*.72;return c;}
float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;float mobile=resolution.x/resolution.y<.85?1.:0.;
 // Scroll follows one camera path; the final frame returns to its starting pose.
 float yaw=.26+journey*.54+pointer.x*.07;vec3 ro=vec3(sin(yaw)*7.3,3.8+sin(journey*1.2)*.4,cos(yaw)*7.3);vec3 target=vec3(0.,1.4,0.);
 vec3 f=normalize(target-ro),r=normalize(cross(f,vec3(0.,1.,0.))),u=cross(r,f);uv.x-=mix(.25,0.,mobile);uv.y+=mix(.08,.16,mobile)+pointer.y*.014;
 vec3 rd=normalize(f*1.65+r*uv.x+u*uv.y);float t=0.;vec2 hit;bool found=false;
 for(int i=0;i<88;i++){vec3 p=ro+rd*t;hit=map(p);if(hit.x<.002){found=true;break;}t+=hit.x*.8;if(t>30.)break;}
 vec3 color=sky(rd);
 if(found){vec3 p=ro+rd*t,n=normal(p),l=normalize(vec3(-3.,6.,4.));float diffuse=max(0.,dot(n,l));float occlusion=clamp(1.-sculpture(p+n*.13).x/.13,0.,.7);float sh=shadow(p+n*.02,l);
  if(hit.y>3.5){vec3 ground=sky(vec3(0.));float grooves=.5+.5*cos(length(p.xz)*24.);ground-=.018*grooves;float ao=exp(-length(p.xz)*length(p.xz)*.28)*.12;color=ground*(.74+.15*diffuse+.11*sh)-ao;if(hit.y>4.5)color*=.91;}
  else{vec3 base=palette(hit.y);vec3 reflected=environment(reflect(rd,n));float fresnel=.18+.65*pow(1.-max(0.,dot(-rd,n)),4.);color=base*(.22+diffuse*.50*sh)*(1.-occlusion*.38)+reflected*(.42+fresnel*.55);float spec=pow(max(0.,dot(reflect(-l,n),-rd)),50.);color+=vec3(1.3)*spec*sh;float brushed=sin(p.y*180.+p.x*60.)*sin(p.z*70.);color-=brushed*.012;}
  float fog=1.-exp(-t*t*.0018);color=mix(color,sky(rd),fog);
 }
 color=pow(max(color,0.),vec3(.92));color+=(noise(gl_FragCoord.xy)-.5)*.008;gl_FragColor=vec4(color,1.);
}`;
let program,locations,drawn=false,failed=false,lastDraw=0,raf=0,px=0,py=0;
function fail(error){failed=true;document.documentElement.dataset.scene='fallback';canvas.hidden=true;console.warn('3D scene unavailable; static art remains available.',error);}
if(gl){try{
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
 program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 locations=Object.fromEntries(['resolution','pointer','time','journey','spread','world'].map(name=>[name,gl.getUniformLocation(program,name)]));gl.uniform1i(locations.world,variant);
}catch(error){fail(error)}}else fail('WebGL is unavailable');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const closing=document.getElementById('return-scene');
function ease(x){return x*x*(3-2*x);}
function state(){const h=innerHeight,y=scrollY,close=closing.offsetTop;let p=Math.min(4.6,y/h*.8);const arrival=ease(Math.max(0,Math.min(1,(y-(close-h*1.3))/(h*1.3))));p*=1-arrival;if(y>=close)p=(y-close)/h*.8;return {p,spread:Math.sin(Math.min(Math.PI,p*.86))*.95,arrival};}
function render(now=0){raf=0;if(failed||document.hidden)return;const paused=document.documentElement.classList.contains('motion-paused');const still=paused||reduced.matches;
 // There is no unrequested idle motion. Draw only in response to input or layout.
 if(now-lastDraw<=45&&drawn&&!still){raf=requestAnimationFrame(render);return;}
 if(now-lastDraw>45||!drawn||still){lastDraw=now;const scale=Math.min(devicePixelRatio,1.25)*(innerWidth>900?.8:1.);const w=Math.round(innerWidth*scale),h=Math.round(innerHeight*scale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}const s=state();
  gl.uniform2f(locations.resolution,w,h);gl.uniform2f(locations.pointer,still?0:px,still?0:py);gl.uniform1f(locations.time,0);gl.uniform1f(locations.journey,still?0:s.p);gl.uniform1f(locations.spread,still?0:s.spread);gl.drawArrays(gl.TRIANGLES,0,6);
  if(!drawn){drawn=true;document.documentElement.dataset.scene='ready';}
 }
}
function request(){if(!raf&&!failed)raf=requestAnimationFrame(render);}
window.addEventListener('pointermove',e=>{px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2;request()},{passive:true});
window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request);document.addEventListener('visibilitychange',request);document.addEventListener('motionchange',request);reduced.addEventListener('change',request);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(raf)cancelAnimationFrame(raf);fail('Graphics context lost');});request();

})();
