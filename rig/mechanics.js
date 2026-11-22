import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, MeshStandardMaterial,
  PlaneGeometry, Quaternion, SphereGeometry, SRGBColorSpace,
} from 'three';
import { box, drum, GROUP, label, mats, piece, ROLLER, rod, STRIKE, stretch, UP, v } from './parts.js';

const ROWS = [
  [...'1234567890-=', '⌫'],
  [...'QWERTYUIOP[]'],
  [..."ASDFGHJKL;'", '↵'],
  ['⇧', ...'ZXCVBNM,./', '⇧'],
];
const TOP_LEGEND = '!@#$%^&*()_+';
const aliases = new Map([...TOP_LEGEND].map((char, i) => [char, ROWS[0][i]]));
for (const [from, to] of [['Backspace','⌫'], ['Delete','⌫'], ['Enter','↵'], ['Shift','⇧'], [' ', 'SPACE'], ['{','['], ['}',']'], [':',';'], ['"',"'"], ['<',','], ['>','.'], ['?','/']]) aliases.set(from,to);
const gc = new PlaneGeometry(1, 1);
const prongGeometry = new BoxGeometry(1, 1, 1);

export const mechanicalKey = key => aliases.get(key) || key.toUpperCase();

export function keyboard(parent, profile, targets) {
  const deck = GROUP(parent);
  const keys = new Map();
  const low = profile.kind === 'electric';
  for (let row = 0; row < ROWS.length; row++) {
    const legends = ROWS[row];
    const z = 1.93 + row * .59;
    const y = (low ? .98 : 1.16) - row * (low ? .052 : .10);
    legends.forEach((name, i) => add(name, (i - (legends.length - 1) / 2) * .575 + [.0,.04,.25,.15][row], y, z, .49));
  }
  add('SPACE', 0, .84, 3.99, 4.04);
  return keys;

  function add(name, x, y, z, width) {
    const pivot = GROUP(deck, x, y - .22, z - .52);
    const lever = rod(pivot, mats.darkSteel, v(0, -.02, 0), v(0, .13, .52), .044);
    lever.castShadow = false;
    const rounded = profile.shape === 'rounded' && name !== 'SPACE';
    const skirt = profile.kind === 'electric' ? mats.black : mats.steel;
    box(pivot, skirt, 0, .17, .52, width, .12, .458, rounded ? .055 : .040);
    const cap = box(pivot, name === '↵' && profile.shape === 'compact' ? mats.redKey : mats.key, 0, .239, .52, width * .94, .112, .418, rounded ? .05 : .035);
    cap.userData.control = name;
    targets.push(cap);
    if (name !== 'SPACE') {
      const texture = label(name);
      const legend = piece(pivot, gc, new MeshStandardMaterial({map: texture, transparent: true, depthWrite: false, roughness: .78}), 0, .296, .52);
      legend.rotation.x = -Math.PI / 2;
      legend.scale.set(.31, .31, 1);
    }
    if (!keys.has(name)) keys.set(name, []);
    keys.get(name).push(pivot);
  }
}

export function platen(parent, profile, targets) {
  const carriage = GROUP(parent);
  const cylinder = GROUP(carriage, 0, ROLLER.y, ROLLER.z);
  const roller = drum(cylinder, mats.rubber, 0, 0, 0, .357, 7.20, 'x');
  roller.castShadow = true;
  const paperBail = GROUP(carriage, 0, ROLLER.y + .18, -.39);
  drum(paperBail, mats.chrome, 0, .105, .05, .036, 7.37, 'x');
  const pinch = [];
  for (const x of [-1.92, 1.92]) {
    const pinchWheel = GROUP(paperBail, x, .102, .05);
    drum(pinchWheel, mats.rubber, 0, 0, 0, .093, .39, 'x');
    drum(pinchWheel, mats.brass, .204, 0, 0, .062, .024, 'x');
    box(pinchWheel, mats.steel, 0, .09, 0, .34, .012, .014);
    pinch.push(pinchWheel);
  }
  const knobs = [];
  for (const sign of [-1,1]) {
    const x = sign * 3.76;
    const bracket = box(carriage, mats.chrome, x, ROLLER.y, -.61, .205, .68, .90, .075);
    bracket.castShadow = true;
    rod(paperBail, mats.steel, v(x, .105,.05), v(x,.02,-.34), .055);
    const knob = GROUP(cylinder, sign * 4.04, 0, 0);
    drum(knob, mats.darkSteel, 0, 0, 0, .33, .20, 'x');
    const dial = drum(knob, mats.key, sign * .126, 0, 0, .286, .105, 'x');
    dial.userData.control = 'feed';
    targets.push(dial);
    for (let i=0;i<28;i++) {
      const a = i*Math.PI/14;
      drum(knob, mats.steel, 0, .327*Math.sin(a), .327*Math.cos(a), .018, .178, 'x');
    }
    box(knob, mats.brass, sign * .182, .21, 0, .012, .071,.022);
    knobs.push(knob);
  }
  const ruler = box(carriage, mats.darkSteel, 0, 1.70, -.12, 7.54, .071, .15, .024);
  ruler.castShadow = true;
  for (let i=-34;i<=34;i++) {
    const long = i%5===0;
    box(carriage, long ? mats.brass : mats.steel, i*.105, 1.741, -.115, .010, .012, long ? .115 : .055);
  }
  const feedRatchet = GROUP(cylinder, -3.66, 0, 0);
  drum(feedRatchet, mats.brass,0,0,0,.259,.072,'x');
  for(let i=0;i<18;i++) {
    const a = i*Math.PI/9;
    const tooth = box(feedRatchet,mats.brass,.005,.253*Math.cos(a),.253*Math.sin(a),.08,.10,.05);
    tooth.rotation.x = a;
  }
  const lever = GROUP(carriage, -3.73, 2.31, -.32);
  drum(lever, mats.brass, 0, 0, 0, .125, .085);
  if (profile.kind === 'manual') {
    const edge = profile.shape === 'compact' ? -.64 : -1.04;
    rod(lever,mats.chrome,v(0,0,0),v(edge,.05,.39),.062);
    const handle = box(lever,mats.chrome,edge-.12,.055,.47,.49,.093,.21,.048);
    handle.rotation.y = -.24;
    handle.userData.control = '↵';
    targets.push(handle);
  }
  return {carriage, cylinder, pinch, lever, paperBail};
}

export function ribbon(parent, electric) {
  const spoolPositions = electric ? [-.44,.44] : [-3.08,3.08];
  const z = electric ? .14 : -.03;
  const spoolY = electric ? 1.66 : 1.59;
  const spools = spoolPositions.map(x => {
    const group = GROUP(parent, x, spoolY, z);
    const radius = electric ? .27 : .47;
    drum(group, mats.black, 0, .0, 0, radius, .18);
    drum(group, mats.darkSteel, 0, .113, 0, radius + .04, .028);
    for(let i=0;i<5;i++) {
      const a = i*Math.PI*.4;
      drum(group,mats.brass, radius*.69*Math.cos(a),.131,radius*.69*Math.sin(a),.035,.023);
    }
    drum(group,mats.chrome,0,.145,0,.087,.063);
    return group;
  });
  function createBand(color) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(24),3));
    geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6]);
    const inked = new MeshStandardMaterial({color,roughness:.98,side:DoubleSide,metalness:.05});
    const band = piece(parent,geometry,inked,0,0,0);
    band.frustumCulled = false;
    return geometry;
  }
  const blackBand = createBand(0x20191c);
  const lowerBand = createBand(electric ? 0x281e21 : 0x80251f);
  const guide = GROUP(parent);
  for (const sign of [-1,1]) box(guide,mats.chrome,sign*.163,0,0,.027,.23,.045,.008);
  box(guide,mats.darkSteel,0,-.104,.003,.353,.044,.067,.009);
  return {spools, guide, update(lift) {
    const y = 1.96 + lift*.342;
    const front = -.62 - lift*.064;
    for(const [geometry,offset] of [[blackBand,.039],[lowerBand,-.038]]) {
      const data = geometry.getAttribute('position');
      const points = [[spoolPositions[0],spoolY,z-.10],[-.19,y,front],[.19,y,front],[spoolPositions[1],spoolY,z-.10]];
      points.forEach(([x,center,depth],i)=>{
        data.setXYZ(i*2,x,center+offset+.039,depth);
        data.setXYZ(i*2+1,x,center+offset-.039,depth);
      });
      data.needsUpdate = true;
      geometry.computeVertexNormals();
    }
    guide.position.set(0,y,front+.025);
  }};
}

export function basket(parent) {
  const segment = GROUP(parent);
  const bars = new Map();
  const keys = ROWS.flat().filter(key=>key!=='⌫' && key!=='↵' && key!=='⇧');
  keys.forEach((key,i) => {
    const a = (i / (keys.length - 1) - .5) * 2.42;
    const fan = Math.sin(a);
    const edge = Math.abs(fan);
    const base = v(fan*2.87, 1.30 + edge*.22, .46 - edge*.98);
    const tip = STRIKE.clone().add(v(0,0,.038));
    const arm = tip.clone().sub(base);
    const length = arm.length();
    const lateral = -fan * 2.29;
    const drop = .46 + .31 * (1-edge);
    const reach = Math.sqrt(Math.max(0,length**2 - lateral**2 - drop**2));
    const rest = v(lateral,-drop,reach).normalize();
    const sweep = new Quaternion().setFromUnitVectors(UP, rest);
    const impact = new Quaternion().setFromUnitVectors(UP, arm.normalize());
    const pivot = GROUP(segment,base.x,base.y,base.z);
    const shaft = piece(pivot,prongGeometry,mats.steel,0,length*.44,0);
    shaft.scale.set(.046,length*.91,.050);
    const elbow = box(pivot,mats.darkSteel,0,length*.735,.023,.061,length*.33,.052);
    const slug = box(pivot,mats.steel,0,length*.993,.022,.096,.138,.099,.014);
    box(pivot,mats.chrome,0,length*1.005,-.040,.089,.085,.028);
    elbow.rotation.z = fan*.038;
    slug.castShadow = true;
    drum(segment,mats.brass,base.x,base.y,base.z,.055,.074,'x');
    const rear = v(base.x*.81, .76, 1.77);
    const link = rod(segment,mats.darkSteel,rear,base,.017);
    pivot.quaternion.copy(sweep);
    bars.set(key,{pivot,sweep,impact,link,rear,base});
  });
  return {segment,bars,move(bar,stroke) {
    bar.pivot.quaternion.slerpQuaternions(bar.sweep,bar.impact,stroke);
    stretch(bar.link,bar.rear,bar.base.clone().add(v(0,.092*stroke,-.12*stroke)),.017);
  }};
}

export function electricCarrier(parent) {
  const carrier = GROUP(parent);
  drum(parent,mats.chrome,0,1.57,-.03,.062,8.26,'x');
  drum(parent,mats.darkSteel,0,1.65,.28,.042,8.18,'x');
  box(carrier,mats.darkSteel,0,1.66,.011,.92,.20,.59,.056);
  for(const s of [-1,1]) drum(carrier,mats.chrome,s*.39,1.58,-.035,.092,.093,'x');
  const strap = GROUP(carrier,0,1.68,-.13);
  drum(strap,mats.chrome,0,.20,0,.067,.41);
  const ballPivot = GROUP(strap,0,.47,0);
  const canvas = document.createElement('canvas');
  canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#9c9690';ctx.fillRect(0,0,1024,512);
  ctx.font='600 56px Georgia';ctx.fillStyle='#c4beb2';ctx.textAlign='center';ctx.textBaseline='middle';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&,.!?;:/';
  for(let i=0;i<44;i++) ctx.fillText(characters[i%characters.length], (i%11)*93+47, Math.floor(i/11)*81+131);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  const body = piece(ballPivot,new SphereGeometry(.24,40,24),new MeshStandardMaterial({color:0xc0b9ad,map:texture,bumpMap:texture,bumpScale:.034,roughness:.29,metalness:.88}),0,0,0);
  drum(ballPivot,mats.chrome,0,.205,0,.20,.072);
  drum(ballPivot,mats.key,0,.255,0,.088,.055);
  const drive = GROUP(parent,3.68,1.57,-.02);
  drum(drive,mats.brass,0,0,0,.13,.14);
  box(drive,mats.chrome,.08,.075,0,.035,.047,.19);
  return {carrier,strap,ballPivot,body,drive};
}
