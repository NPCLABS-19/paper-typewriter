import {
  ACESFilmicToneMapping, AmbientLight, DirectionalLight, HemisphereLight, OrthographicCamera,
  PCFShadowMap, PlaneGeometry, PMREMGenerator, Raycaster, Scene, SRGBColorSpace,
  Vector2, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { box, drum, GROUP, mats, piece, profileShell, rod, SHEET_WIDTH, STRIKE, stretch, v, wood } from './parts.js';
import { basket, electricCarrier, keyboard, mechanicalKey, platen, ribbon } from './mechanics.js';
import { MACHINES } from '../profiles.js';

const angle = .405;
const up = v(0, Math.cos(angle), -Math.sin(angle));
const cameraOffset = v(0, Math.sin(angle) * 20, Math.cos(angle) * 20);
const plateRadius = .357;
const rigs = new WeakMap();
export const rigFor = canvas => rigs.get(canvas);

export class MechanicalRig {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'});
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .89;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-8,8,5,-5,.1,60);
    this.cameraCenter = v(0,0,0);
    this.ray = new Raycaster();
    this.models = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.pose = {x:0,feed:0,shift:0};
    this.gsap = window.gsap;
    this.stage();
    rigs.set(canvas,this);
  }
  stage() {
    const generator = new PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.scene.environment = generator.fromScene(environment, .065).texture;
    this.scene.environmentIntensity = .52;
    generator.dispose();
    environment.dispose();
    this.scene.add(new AmbientLight(0xffead9,.065));
    this.scene.add(new HemisphereLight(0xfff2de,0x27212d,.54));
    const main = new DirectionalLight(0xffd3a7,2.25);
    main.position.set(-8,9,5);
    main.target.position.set(0,.5,1.3);
    main.castShadow = true;
    main.shadow.mapSize.set(1024,1024);
    Object.assign(main.shadow.camera,{left:-9,right:9,top:7,bottom:-9,far:30});
    main.shadow.normalBias = .033;
    main.shadow.bias = -.0005;
    this.scene.add(main,main.target);
    this.fill = new DirectionalLight(0xe2eaff,1.32);
    this.fill.position.set(5,4,-6);
    this.scene.add(this.fill);
    const board = piece(this.scene,new PlaneGeometry(34,12),wood(this.queue),0,-.04,3.8);
    board.rotation.x=-Math.PI/2;
    board.receiveShadow=true;
  }
  select(id) {
    for (const model of this.models.values()) model.root.visible = false;
    if (!this.models.has(id)) this.models.set(id,this.build(MACHINES[id]));
    this.machine=this.models.get(id);
    this.machine.root.visible=true;
    this.canvas.dataset.machine=id;
    this.renderer.shadowMap.needsUpdate=true;
    this.queue();
  }
  build(profile) {
    const electric=profile.kind==='electric';
    const root=GROUP(this.scene);
    const targets=[];
    profileShell(root,profile);
    const keys=keyboard(root,profile,targets);
    const paper=platen(root,profile,targets);
    const bars=electric ? null : basket(root);
    const element=electric ? electricCarrier(root) : null;
    const tape=ribbon(element?.carrier || root,electric);
    tape.update(0);
    if(!electric) {
      box(root,mats.darkSteel,0,1.33,.66,6.9,.104,1.14,.042);
      box(root,mats.brass,0,1.58,-.02,.62,.25,.11,.035);
      box(root,mats.chrome,0,1.70,-.02,.34,.12,.12,.025);
    }
    const wheel=GROUP(root,0,1.56,.31);
    drum(wheel,mats.brass,0,0,0,.158,.074);
    for(let i=0;i<14;i++) {
      const a=i*Math.PI/7;
      box(wheel,mats.darkSteel,.158*Math.sin(a),0,.158*Math.cos(a),.054,.082,.046).rotation.y=a;
    }
    const pawl=box(root,mats.chrome,.20,1.612,.36,.18,.043,.071,.012);
    const bell=drum(root,mats.brass,3.67,1.90,-.18,.212,.099);
    drum(root,mats.steel,3.67,1.97,-.18,.067,.055);
    const clapper=rod(root,mats.chrome,v(3.39,1.94,-.05),v(3.59,1.94,-.145),.024);
    const cord=rod(root,mats.darkSteel,v(3.57,1.59,-.88),v(1,1.60,-.89),.019);
    const rack=GROUP(paper.carriage,0,1.52,-.92);
    box(rack,mats.steel,0,0,0,7.54,.10,.15,.016);
    for(let i=-33;i<=33;i++) box(rack,mats.darkSteel,i*.11,-.052,.02,.053,.044,.099);
    return {root,profile,electric,targets,keys,paper,bars,element,tape,wheel,pawl,bell,clapper,cord,
      lift:{value:0},escapement:{value:0},bellMotion:{value:0},shift:{value:0},actor:{stroke:0,yaw:0,tilt:0},wind:0};
  }
  resize(width,height,paperWidth,strikeY) {
    this.width=width;
    this.height=height;
    this.scale=paperWidth/SHEET_WIDTH;
    this.strikeY=strikeY;
    this.camera.left=-width/(2*this.scale);
    this.camera.right=width/(2*this.scale);
    this.camera.top=height/(2*this.scale);
    this.camera.bottom=-height/(2*this.scale);
    this.camera.updateProjectionMatrix();
    const ratio=Math.min(devicePixelRatio, width>1500 ? 1.25 : 1.5);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width,height,false);
    this.queue();
  }
  frame(pose) {
    this.pose=pose;
    this.queue();
  }
  queue = () => {
    if (this.request) return;
    this.request=requestAnimationFrame(()=>{
      this.request=0;
      if (!this.width || !this.machine) return;
      this.draw();
    });
  };
  draw() {
    const m=this.machine;
    const shift=m.shift.value;
    const worldX=(this.pose.x-this.width/2)/this.scale;
    const cameraFollow=m.electric ? 0 : -worldX;
    m.paper.carriage.position.x=cameraFollow;
    m.paper.carriage.position.y=m.profile.shape==='rounded' ? shift*.13 : 0;
    if(m.bars) m.bars.segment.position.y=m.profile.shape==='compact' ? -shift*.13 : 0;
    const rollerAngle=-this.pose.feed/(this.scale * Math.cos(angle) * plateRadius);
    m.paper.cylinder.rotation.x=rollerAngle;
    for(const wheel of m.paper.pinch) wheel.rotation.x=-rollerAngle * 3.8;
    m.tape.update(m.lift.value);
    for(const [i,reel] of m.tape.spools.entries()) reel.rotation.y=m.wind * (i ? 1 : -.74);
    m.wheel.rotation.y=worldX*1.9+m.escapement.value*.18;
    m.pawl.rotation.y=-m.escapement.value*.55;
    m.bell.rotation.z=.009*m.bellMotion.value;
    m.clapper.rotation.y=m.bellMotion.value*1.45;
    stretch(m.cord,v(3.68,1.59,-.88),v(cameraFollow-3.8,1.60,-.89),.014);
    if(m.element) {
      m.element.carrier.position.x=worldX;
      m.element.strap.position.z=-.13-m.actor.stroke*.328;
      m.element.strap.rotation.x=-m.actor.stroke*.23;
      m.element.ballPivot.rotation.set(m.actor.tilt,m.actor.yaw,0);
      m.element.drive.rotation.y=worldX*4.0;
    }
    this.cameraCenter.copy(STRIKE).addScaledVector(up,-(this.height*.5-this.strikeY)/this.scale);
    this.cameraCenter.x=cameraFollow;
    this.camera.position.copy(this.cameraCenter).add(cameraOffset);
    this.camera.lookAt(this.cameraCenter);
    this.renderer.render(this.scene,this.camera);
  }
  press(key,side) {
    if (this.reduced.matches) return;
    const m=this.machine;
    const slots=m.keys.get(mechanicalKey(key));
    if(!slots) return;
    const pivot=side==='ShiftRight' ? slots.at(-1) : slots[0];
    this.gsap.killTweensOf(pivot.rotation);
    this.gsap.timeline({onUpdate:this.queue}).to(pivot.rotation,{x:m.electric ? .105 : .226,duration:.027,ease:'power2.in'}).to(pivot.rotation,{x:0,duration:.094,ease:'power2.out'},'+=.032');
  }
  strike(char) {
    const m=this.machine;
    this.press(char);
    if(this.reduced.matches) return;
    const tempo=m.profile;
    const g=this.gsap;
    g.killTweensOf([m.lift,m.escapement]);
    g.timeline({onUpdate:this.queue}).to(m.lift,{value:1,duration:tempo.strike*.8,ease:'power2.out'}).to(m.lift,{value:0,duration:tempo.release,ease:'power2.out'},'+=.012');
    this.step();
    const spool={phase:m.wind};
    g.to(spool,{phase:m.wind+.080,duration:tempo.release+.05,onUpdate:()=>{m.wind=spool.phase;this.queue();}});
    if (m.element) {
      g.killTweensOf(m.actor);
      const ordinal=char.codePointAt(0);
      const target=(ordinal%22)*Math.PI/11+(char===char.toUpperCase() ? Math.PI : 0);
      g.timeline({onUpdate:this.queue})
        .to(m.actor,{yaw:target,tilt:((ordinal%4)-1.5)*.18,duration:tempo.strike*.7,ease:'power2.out'},0)
        .to(m.actor,{stroke:1,duration:tempo.strike,ease:'power3.in'},0)
        .to(m.actor,{stroke:0,duration:tempo.release,ease:'power2.out'});
      return;
    }
    const bar=m.bars.bars.get(mechanicalKey(char))||m.bars.bars.get('A');
    bar.motion ??= {value:0};
    g.killTweensOf(bar.motion);
    const update=()=>{m.bars.move(bar,bar.motion.value);this.queue();};
    g.timeline({onUpdate:update}).to(bar.motion,{value:1,duration:tempo.strike,ease:'power2.in'}).to(bar.motion,{value:0,duration:tempo.release,ease:'power2.out'});
  }
  step() {
    const m=this.machine;
    if(this.reduced.matches) return;
    this.gsap.killTweensOf(m.escapement);
    this.gsap.timeline({onUpdate:this.queue}).to(m.escapement,{value:1,duration:.040,ease:'power2.in'}).to(m.escapement,{value:0,duration:.094,ease:'power2.out'});
  }
  shift(down,side) {
    if(this.reduced.matches) return;
    const m=this.machine;
    const slots=m.keys.get('⇧');
    const pivot=side==='ShiftRight' ? slots.at(-1) : slots[0];
    this.gsap.to(pivot.rotation,{x:down ? .20 : 0,duration:.092,overwrite:true,onUpdate:this.queue});
    if(m.electric) return;
    this.gsap.to(m.shift,{value:down ? 1 : 0,duration:.086,overwrite:true,onUpdate:this.queue});
  }
  ding() {
    if(this.reduced.matches) return;
    const state=this.machine.bellMotion;
    this.gsap.fromTo(state,{value:1},{value:0,duration:.27,ease:'elastic.out(1,.30)',overwrite:true,onUpdate:this.queue});
  }
  return(duration,automatic) {
    this.press(automatic ? '' : 'Enter');
    if(this.reduced.matches||this.machine.electric) return;
    const lever=this.machine.paper.lever;
    this.gsap.killTweensOf(lever.rotation);
    this.gsap.timeline({onUpdate:this.queue}).to(lever.rotation,{y:-.79,duration:.10,ease:'power2.inOut'}).to(lever.rotation,{y:0,duration:.15,ease:'power2.out'},Math.max(.10,duration-.12));
  }
  loadSheet() {
    if(this.reduced.matches) return;
    const bail=this.machine.paper.paperBail;
    this.gsap.killTweensOf(bail.rotation);
    this.gsap.timeline({onUpdate:this.queue}).to(bail.rotation,{x:-.80,duration:.22,ease:'power2.out'}).to(bail.rotation,{x:0,duration:.28,ease:'power2.inOut'},'+=.20');
  }
  light(x,y) {
    this.fill.position.set(4+x*4,3+y*4,-3);
    this.queue();
  }
  pick(x,y) {
    this.ray.setFromCamera(new Vector2(x/this.width*2-1,1-y/this.height*2),this.camera);
    return this.ray.intersectObjects(this.machine.targets,false)[0]?.object.userData.control;
  }
}
