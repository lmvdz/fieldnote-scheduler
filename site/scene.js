// Original modeled mechanisms and an architectural world. Three.js is MIT-licensed.
(()=>{
const canvas=document.getElementById('world');
const fail=error=>{document.documentElement.dataset.scene='fallback';canvas.hidden=true;console.warn('3D unavailable; the static illustration and all content remain available.',error?.message||error);};
import(window.__THREE_MODULE_URL||'./three.module.js').then(start).catch(fail);
function start(T){
const variant=Number(document.body.dataset.world),palettes=[{paper:0xe5e8de,ink:0x153d32,ceramic:0xa2b2a2,metal:0x194c3a,copper:0xb77943},{paper:0xe0e6d8,ink:0x243c28,ceramic:0x6e8361,metal:0x253f2e,copper:0xb97532},{paper:0xe5e2e9,ink:0x39354d,ceramic:0x8d8ba9,metal:0x36334f,copper:0xbc8853}],palette=palettes[variant];
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new T.Scene();scene.background=new T.Color(palette.paper);scene.fog=new T.Fog(palette.paper,16,38);
const camera=new T.PerspectiveCamera(34,1,.1,60);const assembly=new T.Group();scene.add(assembly);
// Deterministic, subtle ceramic and concrete grain. The generated texture is our own.
let seed=429+variant*97;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Coherent mineral pores at several scales, plus fine grain, are generated locally.
const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=512;const ctx=grainCanvas.getContext('2d'),pixels=ctx.createImageData(512,512);
const noiseHash=(x,y)=>{let n=Math.imul(x+variant*37,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=noiseHash(ix,iy),b=noiseHash(ix+1,iy),c=noiseHash(ix,iy+1),d=noiseHash(ix+1,iy+1);return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;};
for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,n=110+(noise(x/64,y/64)-.5)*65+(noise(x/17,y/17)-.5)*45+(noise(x/4,y/4)-.5)*25+(random()-.5)*12;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=Math.round(n);pixels.data[i+3]=255;}
ctx.putImageData(pixels,0,0);const grain=new T.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(8,8);grain.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
const pigmentCanvas=document.createElement('canvas');pigmentCanvas.width=pigmentCanvas.height=512;const pigmentContext=pigmentCanvas.getContext('2d'),pigmentPixels=pigmentContext.createImageData(512,512);
for(let i=0;i<pixels.data.length;i+=4){const tone=215+pixels.data[i]*.17;pigmentPixels.data[i]=pigmentPixels.data[i+1]=pigmentPixels.data[i+2]=tone;pigmentPixels.data[i+3]=255;}pigmentContext.putImageData(pigmentPixels,0,0);
const pigment=new T.CanvasTexture(pigmentCanvas);pigment.colorSpace=T.SRGBColorSpace;pigment.wrapS=pigment.wrapT=T.RepeatWrapping;pigment.repeat.set(8,8);pigment.anisotropy=grain.anisotropy;
const ceramic=new T.MeshPhysicalMaterial({color:palette.ceramic,roughness:.61,metalness:.01,map:pigment,bumpMap:grain,bumpScale:.022,clearcoat:.08,clearcoatRoughness:.55});
const metal=new T.MeshStandardMaterial({color:new T.Color(palette.metal).lerp(new T.Color(0xafbdac),.34),roughness:.15,metalness:.92,envMapIntensity:1.6,bumpMap:grain,bumpScale:.003});
const copper=new T.MeshStandardMaterial({color:new T.Color(palette.copper).lerp(new T.Color(0xefc597),.26),roughness:.17,metalness:.92,envMapIntensity:1.6,bumpMap:grain,bumpScale:.002});
const inlay=new T.MeshStandardMaterial({color:0xc5d0ba,roughness:.5,metalness:.25});
const groundMaterial=new T.MeshStandardMaterial({color:palette.paper,roughness:.94,map:pigment,bumpMap:grain,bumpScale:.075});
const darkMaterial=new T.MeshStandardMaterial({color:palette.ink,roughness:.62,metalness:.16});
const luminous=new T.MeshStandardMaterial({color:palette.copper,emissive:palette.copper,emissiveIntensity:.35,roughness:.35,metalness:.55});
// A locally generated studio environment adds soft, physically coherent reflections.
const room=new T.Scene();room.background=new T.Color(0x101813);const panel=(x,y,z,w,h,color)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(color===0xffffff?4:2),side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,1,0);room.add(m);};panel(-4,5,4,4,5,0xffffff);panel(4,3,0,5,6,0x050a07);panel(0,7,-3,5,3,0x758174);panel(0,3.5,6,5,6,0x5c6d62);const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromScene(room,.06,.1,30);scene.environment=environment.texture;pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});
scene.add(new T.HemisphereLight(0xf1f2e9,palette.ink,.70));const key=new T.DirectionalLight(0xffffff,2.7);key.position.set(-4.5,7.5,4);key.castShadow=true;key.shadow.mapSize.set(1536,1536);Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-4,near:.1,far:24});key.shadow.bias=-.00015;key.shadow.normalBias=.009;key.shadow.radius=3;scene.add(key);const fill=new T.DirectionalLight(0xc8d4de,.4);fill.position.set(4,3,-5);scene.add(fill);
const mesh=(geometry,material,parent=assembly)=>{const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
function cylinder(radius,height,mat,y,parent=assembly){const m=mesh(new T.CylinderGeometry(radius,radius,height,64),mat,parent);m.position.y=y;return m;}
function roundedBox(w,h,d,r=.035){const shape=new T.Shape(),x=-w/2,y=-h/2;shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);const thickness=Math.min(r,d*.22),bevel=Math.min(r*.6,w*.1,h*.1);const geo=new T.ExtrudeGeometry(shape,{depth:d-2*thickness,bevelEnabled:true,bevelThickness:thickness,bevelSize:bevel,bevelSegments:3,steps:1,curveSegments:7});geo.translate(0,0,-d/2+thickness);geo.computeVertexNormals();return geo;}
function annulus(radius,width,start,angle,depth=.13){const shape=new T.Shape(),outer=radius+width/2,inner=radius-width/2;shape.absarc(0,0,outer,start,start+angle,false);shape.lineTo(Math.cos(start+angle)*inner,Math.sin(start+angle)*inner);shape.absarc(0,0,inner,start+angle,start,true);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:depth-.025,bevelEnabled:true,bevelThickness:.0125,bevelSize:.016,bevelSegments:3,steps:1,curveSegments:72});geo.translate(0,0,-depth/2+.0125);geo.computeVertexNormals();return geo;}
function horizontalArc(radius,width,start,angle,mat,parent){const m=mesh(annulus(radius,width,start,angle),mat,parent);m.rotation.x=-Math.PI/2;return m;}
const base=new T.Group();assembly.add(base);cylinder(.63,.17,darkMaterial,.085,base);cylinder(.55,.075,ceramic,.20,base);const baseTrim=mesh(new T.TorusGeometry(.57,.014,8,128),copper,base);baseTrim.rotation.x=Math.PI/2;baseTrim.position.y=.15;cylinder(.12,1.52,metal,1.015,base);cylinder(.21,.055,copper,1.70,base);
// Small radial fasteners and recessed caps make the support an authored assembly.
for(let i=0;i<8;i++){const a=i*Math.PI/4,bolt=mesh(new T.CylinderGeometry(.021,.021,.012,6),copper,base);bolt.position.set(Math.cos(a)*.44,.245,Math.sin(a)*.44);}
const moving=[];let dialHands=[],receiptPart=null,dialBody=null;
if(variant===0){
 const body=new T.Group();body.position.y=1.85;body.rotation.set(.48,0,.07);assembly.add(body);
 for(let i=0;i<5;i++){const layer=new T.Group();body.add(layer);layer.rotation.y=i*.22;const radius=1.31-i*.095,end=2.54-i*.04;horizontalArc(radius,.16,-end,end*2,i%2?metal:ceramic,layer);const returned=horizontalArc(radius,.16,end,Math.PI*2-end*2,copper,layer);const trim=horizontalArc(radius-.045,.021,-end+.06,end*2-.12,inlay,layer);trim.position.y=.081;
 for(const angle of [-end,end]){const cap=mesh(new T.CylinderGeometry(.045,.045,.015,12),metal,layer);cap.position.set(Math.cos(angle)*radius,.080,Math.sin(angle)*radius);const screw=mesh(new T.CylinderGeometry(.018,.018,.017,6),copper,layer);screw.position.copy(cap.position);screw.position.y+=.014;}
 moving.push({group:layer,index:i,returned,variant:0});}
 cylinder(.25,.35,metal,0,body);cylinder(.27,.035,copper,.18,body);cylinder(.18,.018,inlay,.205,body);
}else if(variant===1){
 const body=new T.Group();body.position.y=1.55;body.rotation.y=.27;assembly.add(body);
 const shellGeometry=roundedBox(.75,.58,.70,.055),topGeometry=roundedBox(.55,.035,.50,.012),boltGeometry=new T.CylinderGeometry(.016,.016,.015,6);
 for(let level=0;level<3;level++){const tier=new T.Group();tier.rotation.y=level*.92;body.add(tier);for(let lane=-1;lane<=1;lane++){const module=new T.Group();tier.add(module);mesh(shellGeometry,lane===0?metal:ceramic,module);const top=mesh(topGeometry,inlay,module);top.position.y=.324;const rail=mesh(roundedBox(.62,.022,.028,.008),copper,module);rail.position.set(0,.18,.39);const inset=mesh(roundedBox(.34,.15,.012,.016),darkMaterial,module);inset.position.set(0,-.04,.365);for(let j=0;j<3;j++){const led=mesh(new T.SphereGeometry(.013,8,6),j===1?luminous:copper,module);led.position.set((j-1)*.065,-.04,.378);}for(const x of [-.26,.26])for(const z of [-.22,.22]){const bolt=mesh(boltGeometry,copper,module);bolt.position.set(x,.347,z);}moving.push({group:module,tier,level,lane,variant:1});}}
const receipt=new T.Group();body.add(receipt);receipt.position.set(0,-.89,.54);const paper=new T.MeshStandardMaterial({color:0xeeeede,roughness:.9});mesh(roundedBox(.42,.62,.012,.01),paper,receipt);for(const [w,y] of [[.24,.17],[.28,.07],[.19,-.025],[.27,-.18]]){const row=mesh(roundedBox(w,.012,.003,.002),darkMaterial,receipt);row.position.set(0,y,.009);}receiptPart=receipt;
}else{
 const body=new T.Group();body.position.y=1.92;body.rotation.set(-.14,-.30,-.35);assembly.add(body);dialBody=body;
 for(let i=0;i<3;i++){const layer=new T.Group();body.add(layer);const radius=1.43-i*.205,start=.26+i*.14;mesh(annulus(radius,.135,start,Math.PI*2-.58-i*.2,.105),i===1?metal:ceramic,layer);const rim=mesh(annulus(radius+.013,.022,start+.04,Math.PI*2-.66-i*.2,.025),copper,layer);rim.position.z=.069;for(const a of [start,start+Math.PI*2-.58-i*.2]){const cap=mesh(new T.CylinderGeometry(.046,.046,.15,20),metal,layer);cap.rotation.x=Math.PI/2;cap.position.set(Math.cos(a)*radius,Math.sin(a)*radius,0);}const closingPart=new T.Group();layer.add(closingPart);const sectorAngle=Math.PI*2-.58-i*.2;mesh(annulus(radius,.135,start+sectorAngle,Math.PI*2-sectorAngle,.105),copper,closingPart);if(i===1){const selectedTick=mesh(roundedBox(.185,.062,.075,.012),luminous,closingPart);selectedTick.position.set(radius,0,.12);}moving.push({group:layer,index:i,returned:closingPart,variant:2});}
 for(let i=0;i<12;i++){if(i===3)continue;const a=i*Math.PI/6,tick=new T.Group();tick.position.set(Math.sin(a)*1.23,Math.cos(a)*1.23,.12);tick.rotation.z=-a;body.add(tick);mesh(roundedBox(.062,.185,.075,.012),metal,tick);const face=mesh(roundedBox(.035,.12,.012,.008),copper,tick);face.position.z=.049;}
 const hub=mesh(new T.CylinderGeometry(.20,.20,.27,64),metal,body);hub.rotation.x=Math.PI/2;const cap=mesh(new T.CylinderGeometry(.13,.13,.022,64),copper,body);cap.rotation.x=Math.PI/2;cap.position.z=.155;const face=mesh(new T.CylinderGeometry(.066,.066,.024,32),inlay,body);face.rotation.x=Math.PI/2;face.position.z=.176;
 for(const [length,width,angle,z] of [[.96,.044,-.92,.22],[.68,.067,1.27,.27]]){const hand=new T.Group();body.add(hand);const blade=mesh(roundedBox(width,length,.045,.013),copper,hand);blade.position.y=length*.39;hand.position.z=z;hand.rotation.z=angle;dialHands.push({group:hand,angle});}
}
// Near, middle and far planes use original courtyard architecture, not a copied landscape.
const ground=new T.PlaneGeometry(80,80,100,100);ground.rotateX(-Math.PI/2);const positions=ground.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),d=Math.hypot(x,z);const far=T.MathUtils.smoothstep(d,3.8,12);positions.setY(i,(-.01+Math.sin(x*.21+z*.17)*.35+Math.cos(z*.25)*.18)*far);}ground.computeVertexNormals();const floor=mesh(ground,groundMaterial,scene);floor.castShadow=false;
const terrace=mesh(new T.CylinderGeometry(3.25,3.35,.07,128),groundMaterial,scene);terrace.position.y=-.06;terrace.castShadow=false;
// Each environment extends its own mechanism: repair, selection, or reservation.
const stone=new T.MeshStandardMaterial({color:palette.ceramic,roughness:.89,map:pigment,bumpMap:grain,bumpScale:.06});
const stoneLight=groundMaterial.clone();stoneLight.color.multiplyScalar(.93);
const worldMoving=[];
if(variant===0){
 for(let j=0;j<3;j++){const group=new T.Group();scene.add(group);group.position.set(0,.20+j*.25,-1.65);
  const radius=3.0+j*.62;for(const [a,length] of [[.19,1.12],[1.73,1.22]]){const ledge=horizontalArc(radius,.38,a,length,j===1?stone:stoneLight,group);ledge.scale.y=3.6;}
  const fitting=new T.Group();group.add(fitting);const returned=horizontalArc(radius,.38,1.31,.42,stone,fitting);returned.scale.y=3.6;const seam=horizontalArc(radius-.12,.018,1.325,.39,copper,fitting);seam.position.y=.245;
  worldMoving.push({group:fitting,variant:0,index:j});
 }
}else if(variant===1){
 const tileGeometry=roundedBox(1.08,.17,.96,.045);
 for(let row=0;row<3;row++)for(let lane=-2;lane<=2;lane++){const group=new T.Group();scene.add(group);group.position.set(lane*1.15,.13+row*.18,-2.4-row*1.04);mesh(tileGeometry,lane===0?stone:stoneLight,group);
  const inset=mesh(roundedBox(.62,.018,.025,.006),lane===0?copper:ceramic,group);inset.position.set(0,.101,.37);
  if(lane===0){const guide=mesh(roundedBox(.025,.018,.72,.006),copper,group);guide.position.set(.38,.101,0);worldMoving.push({group:inset,variant:1,index:row});}}
 for(const x of [-3.9,3.9]){const dock=mesh(roundedBox(.7,.4,2.8,.05),stoneLight,scene);dock.position.set(x,.19,-3.6);const rail=mesh(roundedBox(.027,.018,2.5,.006),copper,scene);rail.position.set(x,.407,-3.6);}
}else{
 const columns=new T.Group();scene.add(columns);
 for(let i=0;i<12;i++){const angle=-1.1+i*.18,radius=5.1,group=new T.Group();columns.add(group);group.position.set(Math.sin(angle)*radius,0,-Math.cos(angle)*radius-1.5);group.rotation.y=-angle;const height=1.65+.22*Math.cos(angle*1.8);const pillar=mesh(roundedBox(.22,height,.36,.028),stoneLight,group);pillar.position.y=height/2;const band=mesh(roundedBox(.25,.035,.39,.008),copper,group);band.position.y=height-.10;const cap=mesh(roundedBox(.55,.10,.52,.022),stoneLight,group);cap.position.y=height+.04;
  if(i===5){worldMoving.push({group:band,variant:2,index:i});band.material=luminous;}
 }
 for(let j=0;j<2;j++){const ledge=horizontalArc(3.8+j*.6,.31,.15,Math.PI-.30,j?stone:stoneLight,scene);ledge.position.set(0,.035+j*.10,-1.5);ledge.scale.y=1.6;}
}
// Original generated mineral albedo; local image only, with a native-texture fallback.
new T.TextureLoader().load(window.__MINERAL_TEXTURE_URL||'/site/mineral.webp',texture=>{
 texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(10,10);texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());groundMaterial.map=texture;groundMaterial.bumpMap=texture;groundMaterial.bumpScale=.065;groundMaterial.needsUpdate=true;
 const stoneTexture=texture.clone();stoneTexture.repeat.set(1.6,1.6);stoneTexture.needsUpdate=true;const ceramicTexture=texture.clone();ceramicTexture.repeat.set(2.4,2.4);ceramicTexture.needsUpdate=true;ceramic.map=ceramicTexture;ceramic.bumpMap=ceramicTexture;ceramic.bumpScale=.026;ceramic.needsUpdate=true;stone.map=stoneTexture;stone.bumpMap=stoneTexture;stone.bumpScale=.028;stone.needsUpdate=true;
 const lightTexture=stoneTexture.clone();lightTexture.needsUpdate=true;stoneLight.map=lightTexture;stoneLight.bumpMap=lightTexture;stoneLight.bumpScale=.028;stoneLight.needsUpdate=true;document.documentElement.dataset.surface='mineral';request();
},undefined,()=>{document.documentElement.dataset.surface='procedural';});
const rockGeometry=new T.IcosahedronGeometry(1,2);
for(let i=0;i<12;i++){const rock=mesh(rockGeometry,i%3===0?stone:stoneLight,scene);const side=i<6?-1:1,x=side*(4.2+random()*1.5),z=-2.5-random()*4;rock.position.set(x,.02,z);const size=.12+random()*.2;rock.scale.set(size*1.5,size*.65,size);rock.rotation.set(random(),random()*6,random()*.3);}
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),closing=document.getElementById('return-scene');let raf=0,settle=0,interactive=false,pointerX=0,pointerY=0,previousTime=0,lastWidth=0,lastHeight=0,lastScale=0,lastShadowSignature='';
const evidence={engine:'modeled-three-r186',draws:0,cpuFrameMs:[],triangles:0,calls:0};window.__sceneEvidence=evidence;
function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function state(){const h=innerHeight,y=scrollY,close=closing.offsetTop;let p=Math.min(4.6,y/h*.8);const arrival=smooth((y-(close-h*1.3))/(h*1.3));p*=1-arrival;if(y>=close)p=(y-close)/h*.8;return {p,spread:smooth((p-.45)/.55)*(1-smooth((p-1.75)/.40))};}
function render(now=0){raf=0;if(document.hidden)return;const paused=reduced.matches||document.documentElement.classList.contains('motion-paused');if(now-previousTime<32&&interactive&&!paused){raf=requestAnimationFrame(render);return;}previousTime=now;const mobile=innerWidth<600,scale=interactive?Math.min(devicePixelRatio,1):Math.min(devicePixelRatio,1.75);if(lastWidth!==innerWidth||lastHeight!==innerHeight||lastScale!==scale){if(lastScale!==scale)renderer.setPixelRatio(scale);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=mobile?43:34;camera.updateProjectionMatrix();lastWidth=innerWidth;lastHeight=innerHeight;lastScale=scale;}const s=paused?{p:0,spread:0}:state();const p=s.p,spread=s.spread,joined=smooth((p-1.75)/.40);const detailTop=document.querySelector('.detail-pause').offsetTop;const detail=smooth((scrollY-(detailTop-innerHeight*.5))/(innerHeight*.4))*(1-smooth((scrollY-(detailTop+innerHeight*.25))/(innerHeight*.4)));const yaw=.40+p*.32+(paused?0:pointerX*.035),distance=(mobile?12.3:10.2)+spread*(mobile?.6:1.1)-detail*(mobile?2.6:3.2);camera.position.set(Math.sin(yaw)*distance,3.3+Math.sin(p*.8)*.6,Math.cos(yaw)*distance);const rightTop=document.querySelector('.chapter.right').offsetTop;const turn=smooth((scrollY-(rightTop-innerHeight*.65))/(innerHeight*.55))*(1-smooth((scrollY-(rightTop+innerHeight*.95))/(innerHeight*.55)));const side=mobile?0:(1.30-3.10*turn)*(1-detail);camera.lookAt(-Math.cos(yaw)*side,(mobile?.63:.65)+detail*1.0,Math.sin(yaw)*side);if(!paused)camera.rotateX(pointerY*.005);
 for(const part of moving){if(part.variant===0){part.group.position.y=(part.index-2)*(.22+spread*.27);part.returned.position.x=.30*(1-smooth((p-1.75)/.40))+spread*.5;part.returned.position.y=-spread*.16;}else if(part.variant===1){const joined=smooth((p-1.75)/.40);part.tier.rotation.y=part.level*.92*(1-joined);part.tier.position.y=(part.level-1)*(.71+spread*.22);part.group.position.x=part.lane*(.83+spread*.24+joined*.36);part.group.position.y=part.lane?-.12*joined:0;part.group.position.z=spread*(part.lane===0?-.12:.10);}else{part.group.position.z=(part.index-1)*(.16*(1-joined)+spread*.27);part.group.rotation.z=part.index*spread*.13;if(part.returned){const emerging=smooth((p-1.75)/.40);part.returned.scale.setScalar(Math.max(.001,emerging));part.returned.position.set(.32*(1-joined)+spread*.12,0,.26*(1-joined));}}}
 if(dialBody)dialBody.rotation.y=-.30+.90*smooth((p-.80)/.90);
 for(const hand of dialHands)hand.group.rotation.z=hand.angle+spread*.3;
 if(receiptPart){receiptPart.scale.y=Math.max(.001,joined);receiptPart.position.y=-.58-joined*.31;}
 const locked=smooth((p-1.75)/.40);for(const part of worldMoving){if(part.variant===0){part.group.position.x=(1-locked)*(.28+part.index*.09);part.group.position.y=(1-locked)*.06;}else if(part.variant===1){part.group.scale.x=.4+.6*locked;}else{part.group.scale.x=.45+.55*locked;}}
 const shadowSignature=spread.toFixed(3)+'/'+joined.toFixed(3)+'/'+smooth((p-1.75)/.40).toFixed(3)+'/'+(dialBody?dialBody.rotation.y.toFixed(3):'');if(shadowSignature!==lastShadowSignature){renderer.shadowMap.needsUpdate=true;lastShadowSignature=shadowSignature;}
 // Mobile framing reserves space using native text geometry at the current scroll position.
 if(mobile){
  if(camera.view?.enabled)camera.clearViewOffset();camera.updateMatrixWorld();
  const navFloor=document.querySelector('.nav').getBoundingClientRect().bottom+18;
  let safeBottom=innerHeight*.64;for(const copy of document.querySelectorAll('.chapter-copy')){const rect=copy.getBoundingClientRect();if(rect.bottom>navFloor&&rect.top<innerHeight*.78)safeBottom=Math.min(safeBottom,rect.top-24);}
  const available=safeBottom-navFloor,zoneHeight=Math.max(135,available);
  const box=new T.Box3().setFromObject(assembly),point=new T.Vector3();
  const bounds=()=>{let top=Infinity,bottom=-Infinity,left=Infinity,right=-Infinity;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){point.set(x,y,z).project(camera);const py=(1-point.y)*innerHeight/2,px=(point.x+1)*innerWidth/2;top=Math.min(top,py);bottom=Math.max(bottom,py);left=Math.min(left,px);right=Math.max(right,px);}return {top,bottom,left,right,height:bottom-top,width:right-left};};
  for(let i=0;i<2;i++){const b=bounds();const fit=Math.max(b.height/zoneHeight,b.width/(innerWidth*.88));if(fit<=1)break;const zoom=fit*1.02;camera.position.x*=zoom;camera.position.z*=zoom;camera.lookAt(0,.63+detail*1.0,0);camera.updateMatrixWorld();}
  const b=bounds(),shift=Math.max(0,b.bottom-safeBottom);if(shift>0)camera.setViewOffset(innerWidth,innerHeight,0,shift,innerWidth,innerHeight);
  canvas.style.opacity=String(smooth((available-70)/100));evidence.mobileFrame={...bounds(),safeBottom,navFloor,opacity:Number(canvas.style.opacity)};
  }else{
  if(camera.view?.enabled)camera.clearViewOffset();camera.updateMatrixWorld();
  const box=new T.Box3().setFromObject(assembly),point=new T.Vector3(),navFloor=document.querySelector('.nav').getBoundingClientRect().bottom+12;
  const top=()=>{let min=Infinity;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){point.set(x,y,z).project(camera);min=Math.min(min,(1-point.y)*innerHeight/2);}return min;};
  const shift=Math.max(0,navFloor-top());if(shift>0)camera.setViewOffset(innerWidth,innerHeight,0,-shift,innerWidth,innerHeight);
  evidence.desktopFrame={top:top(),navFloor};canvas.style.removeProperty('opacity');
 }
 const before=performance.now();renderer.render(scene,camera);const elapsed=performance.now()-before;evidence.cpuFrameMs.push(Math.round(elapsed*10)/10);if(evidence.cpuFrameMs.length>64)evidence.cpuFrameMs.shift();evidence.draws++;evidence.triangles=renderer.info.render.triangles;evidence.calls=renderer.info.render.calls;document.documentElement.dataset.scene='ready';document.documentElement.dataset.sceneVersion='mesh-v6';}
function request(){interactive=true;clearTimeout(settle);settle=setTimeout(()=>{interactive=false;if(!raf)raf=requestAnimationFrame(render);},160);if(!raf)raf=requestAnimationFrame(render);}
window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request);document.addEventListener('motionchange',request);document.addEventListener('visibilitychange',request);reduced.addEventListener('change',request);window.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;pointerX=(event.clientX/innerWidth-.5)*2;pointerY=(event.clientY/innerHeight-.5)*2;request();},{passive:true});canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(raf)cancelAnimationFrame(raf);clearTimeout(settle);fail('Graphics context lost');});request();
}
})();
