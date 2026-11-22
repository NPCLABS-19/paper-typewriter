import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, ExtrudeGeometry, Group, Mesh,
  MeshPhysicalMaterial, MeshStandardMaterial, Path, RepeatWrapping, Shape, SRGBColorSpace,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const v = (x, y, z) => new Vector3(x, y, z);
export const UP = v(0, 1, 0);
export const STRIKE = v(0, 2.30, -.705);
export const ROLLER = v(0, 1.96, -.57);
export const SHEET_WIDTH = 6.6;
export const GROUP = (parent, x = 0, y = 0, z = 0) => {
  const group = new Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
};
const cube = new BoxGeometry(1, 1, 1);
const cylinder = new CylinderGeometry(1, 1, 1, 24);
let surface;
function surfaceMap() {
  if (surface) return surface;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  const pixels=ctx.createImageData(256,256);
  for(let y=0;y<256;y++) for(let x=0;x<256;x++) {
    const grain=220+(hash(x,y)-.5)*41;
    pixels.data.set([grain,grain,grain,255],(x+y*256)*4);
  }
  ctx.putImageData(pixels,0,0);
  ctx.lineWidth=.5;
  for(let i=1;i<38;i++) {
    const x=hash(i,31)*256,y=hash(i,71)*256;
    ctx.strokeStyle=i%3?'#a6a6a6a2':'#f8f8f8';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+hash(i,2)*21,y+hash(i,4)*4);ctx.stroke();
  }
  surface=new CanvasTexture(canvas);
  surface.colorSpace=SRGBColorSpace;
  surface.wrapS=surface.wrapT=RepeatWrapping;
  return surface;
}
export function piece(parent, geometry, material, x, y, z) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
export function box(parent, mat, x, y, z, w, h, d, radius = 0) {
  if (radius) return piece(parent, new RoundedBoxGeometry(w, h, d, 2, radius), mat, x, y, z);
  const mesh = piece(parent, cube, mat, x, y, z);
  mesh.scale.set(w, h, d);
  return mesh;
}
export function drum(parent, mat, x, y, z, radius, height, axis = 'y') {
  const mesh = piece(parent, cylinder, mat, x, y, z);
  mesh.scale.set(radius, height, radius);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  return mesh;
}
export function stretch(mesh, from, to, radius) {
  const axis = to.clone().sub(from);
  mesh.position.copy(from).addScaledVector(axis, .5);
  mesh.quaternion.setFromUnitVectors(UP, axis.clone().normalize());
  mesh.scale.set(radius, axis.length(), radius);
}
export function rod(parent, mat, from, to, radius) {
  const mesh = piece(parent, cylinder, mat, 0, 0, 0);
  stretch(mesh, from, to, radius);
  return mesh;
}
function noise(x, y, pitch, seed) {
  const sx=x/pitch, sy=y/pitch;
  const ix=Math.floor(sx), iy=Math.floor(sy);
  const smooth=t=>t*t*(3-2*t);
  const tx=smooth(sx-ix), ty=smooth(sy-iy);
  const mix=(a,b,t)=>a+(b-a)*t;
  return mix(mix(hash(ix+seed,iy),hash(ix+1+seed,iy),tx),mix(hash(ix+seed,iy+1),hash(ix+1+seed,iy+1),tx),ty);
}
function casingMaps(profile) {
  const size=384;
  const surfaces=Array.from({length:2},()=>{
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    return canvas.getContext('2d');
  });
  const [color,roughness]=surfaces.map(ctx=>ctx.createImageData(size,size));
  const tone=[profile.finish>>16&255,profile.finish>>8&255,profile.finish&255];
  const electric=profile.kind==='electric';
  const matte=profile.shape==='compact';
  const midRoughness=electric?.57:matte?.52:.36;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=(x+y*size)*4;
    const speck=hash(x,y)-.5;
    const peel=noise(x,y,electric?3:5,9)-.5;
    const age=noise(x,y,38,41)-.5;
    const finish=1+age*.19+peel*(matte?.15:.085)+speck*.045;
    const r=midRoughness+peel*.19+age*.23+speck*.05;
    for(let channel=0;channel<3;channel++) color.data[i+channel]=tone[channel]*finish+speck*5;
    color.data[i+3]=255;
    // Red carries surface height, green roughness, and blue exposed metal.
    roughness.data[i]=128+peel*50+speck*13;
    roughness.data[i+1]=r*255;
    roughness.data[i+2]=electric?3:18;
    roughness.data[i+3]=255;
  }
  surfaces[0].putImageData(color,0,0);
  surfaces[1].putImageData(roughness,0,0);
  for(let i=0;i<(electric?54:94);i++){
    const x=hash(i,51)*size,y=hash(i,73)*size;
    const length=2+hash(i,91)**3*(electric?13:30);
    const angle=hash(i,58)*Math.PI;
    const chip=!electric&&i%13===0;
    for(const [j,ctx] of surfaces.entries()) {
      ctx.lineCap='round';
      ctx.lineWidth=chip?1.3:.5+hash(i,21)*.63;
      ctx.strokeStyle=j===0?(chip?'rgba(116,110,99,.78)':i%3?'rgba(34,25,24,.36)':'rgba(247,227,201,.31)'):(chip?'rgb(96,186,178)':'rgba(105,194,29,.53)');
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x+Math.cos(angle)*length*.46,y+Math.sin(angle)*length*.50+1,x+Math.cos(angle)*length,y+Math.sin(angle)*length);
      ctx.stroke();
    }
  }
  return surfaces.map((ctx,i)=>{
    const map=new CanvasTexture(ctx.canvas);
    map.wrapS=map.wrapT=RepeatWrapping;
    if(i===0)map.colorSpace=SRGBColorSpace;
    map.anisotropy=4;
    return map;
  });
}
export function paint(profile) {
  const [color,pbr]=casingMaps(profile);
  const glossy=profile.shape==='rounded';
  return new MeshPhysicalMaterial({map:color,bumpMap:pbr,bumpScale:glossy?.016:.027,
    metalness:profile.kind==='electric'?0:1,metalnessMap:pbr,roughness:1,roughnessMap:pbr,
    clearcoat:glossy?.48:.17,clearcoatRoughness:glossy?.35:.48,clearcoatRoughnessMap:pbr,envMapIntensity:.85});
}
export const mats = {
  black: new MeshStandardMaterial({color: 0x0c0b0c, roughness: .76, metalness: .08}),
  darkSteel: new MeshStandardMaterial({color: 0x3d3933, roughness: .48, metalness: .75}),
  steel: new MeshStandardMaterial({color: 0x969189, roughness: .32, metalness: .88}),
  brass: new MeshStandardMaterial({color: 0x8e6f47, roughness: .34, metalness: .85}),
  chrome: new MeshStandardMaterial({color: 0xafaaa0, roughness: .24, metalness: 1}),
  key: new MeshPhysicalMaterial({color: 0x111013, roughness: .48, clearcoat: .27}),
  redKey: new MeshPhysicalMaterial({color: 0x9b3026, roughness: .32, clearcoat: .36}),
  rubber: new MeshStandardMaterial({color: 0x24201f, roughness: .94}),
};

export function label(text, color = '#eddec0', background) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (background) {ctx.fillStyle = background;ctx.fillRect(0, 0, 128, 128);}
  ctx.font = `500 ${text.length <= 1 ? 78 : 35}px Georgia`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 67, 110);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
export function profileShell(parent, profile) {
  const enamel = paint(profile);
  for(const m of [mats.steel,mats.chrome,mats.rubber,mats.key]) {
    m.bumpMap=surfaceMap();
    m.bumpScale=m===mats.rubber?.032:.010;
  }
  const round = profile.shape === 'rounded' ? .34 : profile.shape === 'compact' ? .21 : .14;
  const width = profile.kind === 'electric' ? 9.25 : profile.shape === 'compact' ? 8.35 : 8.8;
  const side = width / 2 - .26;
  const base = box(parent, mats.black, 0, .23, 1.57, width - .3, .43, 5.36, .19);
  base.castShadow = true;
  box(parent, enamel, 0, .47, 1.57, width, .41, 5.50, round * .65);
  const keyWell=box(parent, mats.black, 0, .67, 2.74, width - .72, .13, 2.97, .062);
  keyWell.rotation.x=.040;
  keyWell.receiveShadow=true;
  for (const sign of [-1, 1]) {
    const cheek = box(parent, enamel, sign * side, .90, 1.6, .64, .76, 5.31, round * .70);
    cheek.rotation.x = .104;
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    box(parent, mats.rubber, sign * (side - .25), .075, 3.70, .75, .16, .46, .08);
    box(parent, mats.rubber, sign * (side - .25), .075, -.36, .75, .16, .46, .08);
    box(parent, enamel, sign * (side - .42), 1.40, -.03, 1.71, .40, 1.66, round * .55);
    box(parent, mats.steel, sign * side, .64, 2.34, .075, .034, 3.68);
  }
  // The raised lip around the open mechanism is a bevelled casting with a cutaway.
  const casting = new Shape();
  casting.moveTo(-side, 1.13);
  casting.quadraticCurveTo(-side - .26, .94, -side - .21, .67);
  casting.lineTo(-side + .07, -1.49);
  casting.quadraticCurveTo(-side + .26, -1.80, -side + .71, -1.81);
  casting.lineTo(side - .71, -1.81);
  casting.quadraticCurveTo(side - .26, -1.80, side - .07, -1.49);
  casting.lineTo(side + .21, .67);
  casting.quadraticCurveTo(side + .26, .94, side, 1.13);
  casting.closePath();
  const cutaway = new Path();
  cutaway.moveTo(-side + .64, .73);
  cutaway.quadraticCurveTo(0, .63, side - .64, .73);
  cutaway.lineTo(side - .68, -.83);
  cutaway.quadraticCurveTo(0, -1.54, -side + .68, -.83);
  cutaway.closePath();
  casting.holes.push(cutaway);
  const castGeometry=new ExtrudeGeometry(casting, {depth:.13,bevelThickness:.095,bevelSize:.085,bevelSegments:6,curveSegments:26});
  // The extruded top uses dimensions in model units. Spread the finish across it
  // at the same scale as the enamel on the side panels.
  const uv=castGeometry.getAttribute('uv');
  for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*.18+.37,uv.getY(i)*.18+.47);
  const shell = piece(parent, castGeometry, enamel, 0, 1.12, -.08);
  shell.rotation.x = -Math.PI / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  box(parent, enamel, 0, .63, 4.19, width - .31, .20, .34, .095);
  return enamel;
}

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
export function wood(onLoad) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const warp = y + Math.sin(x * .005 + y * .03) * 5 + Math.sin(x * .013 - y * .018) * 2;
    const grain = Math.sin(warp * .37) * 7 + Math.sin(warp * 2.3) * 4 + (hash(x, y) - .5) * 14;
    const seam = y % 128 < 2 ? -18 : 0;
    const base = 59 + 13 * Math.sin(y * .045 + x * .001) + grain + seam;
    const i = (y * canvas.width + x) * 4;
    image.data.set([base * 1.54, base * .91, base * .54, 255], i);
  }
  ctx.putImageData(image, 0, 0);
  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(2.4, 4.0);
  map.colorSpace = SRGBColorSpace;
  const board = new MeshStandardMaterial({color: new Color(0x9b785e), map, roughness: .71, bumpMap: map, bumpScale: .031});
  const sample=new Image();
  sample.onload=()=>{
    ctx.clearRect(0,0,1024,512);
    const width=512,height=256;
    for(let x=0;x<2;x++) for(let y=0;y<2;y++){
      ctx.save();ctx.translate((x+Number(x===1))*width,(y+Number(y===1))*height);
      ctx.scale(x===1?-1:1,y===1?-1:1);
      ctx.drawImage(sample,8,672,212,330,0,0,width,height);ctx.restore();
    }
    map.needsUpdate=true;
    onLoad();
  };
  sample.src=new URL('./assets/typewriter-desk.webp',document.baseURI).href;
  return board;
}
