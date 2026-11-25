import { useEffect, useRef } from 'react';

// An isometric access network drawn at the device's native pixel density.
export default function NetworkArt() {
  const canvas = useRef(null);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    function draw() {
      const bounds = element.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(bounds.width * ratio);
      element.height = Math.round(bounds.height * ratio);
      if (!element.width || !element.height) return;
      ctx.scale(element.width / 370, element.height / 190);
      function shape(points, color, stroke, width = 1) {
        ctx.beginPath();
        points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        if (color) { ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
      }
      function light(x, y, r, fill) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      }
      for (let i = -5; i < 17; i++) {
        shape([[i * 33, 0], [i * 33 + 335, 190]], '', 'rgba(179,212,255,.105)', .65);
        shape([[i * 33, 0], [i * 33 - 335, 190]], '', 'rgba(179,212,255,.105)', .65);
      }
      const wires = [
        [[214,139],[186,155],[150,135],[110,157],[88,145]],
        [[218,148],[181,169],[143,148],[112,165],[82,148],[55,163]],
        [[245,134],[269,148],[312,125],[335,138]],
        [[251,142],[269,153],[310,131],[337,146],[355,136]],
        [[220,91],[177,68],[148,84],[112,63]],
        [[254,96],[293,73],[277,65],[312,45]],
        [[239,92],[270,74],[258,66],[277,55]]
      ];
      for (const [i, points] of wires.entries()) {
        shape(points, '', i % 2 ? 'rgba(161,220,255,.58)' : '#81c3ff', 1.25);
        const [x,y] = points[points.length - 1];
        light(x,y,3.1,'#78b8ff'); light(x,y,1.45,'#e3f8ff');
      }
      // Layered chassis with individually lit ports on the visible faces.
      function chassis(x,y,w,d,h,base=false) {
        const a=[x,y], b=[x+d,y-d*.53], c=[x+d+w,y-d*.53+w*.53], e=[x+w,y+w*.53];
        const lower=([px,py])=>[px,py+h];
        const top = ctx.createLinearGradient(x,y-18,x+w+d,y+30);
        top.addColorStop(0,base?'#5691ff':'#b3d1ff'); top.addColorStop(.5,base?'#4a7cf4':'#7ca8ff'); top.addColorStop(1,base?'#254ee4':'#6081ee');
        shape([a,b,c,e],top,'rgba(222,235,255,.86)',1);
        shape([a,e,lower(e),lower(a)],base?'#294bbc':'#234cbb','#83aeff',.85);
        shape([e,c,lower(c),lower(e)],base?'#1b329a':'#17388e','#779df3',.85);
        if (!base) {
          for(let j=0;j<6;j++) {
            const lx=x+7+j*4.3, ly=y+(lx-x)*.53+4;
            shape([[lx,ly],[lx+1.8,ly+.9],[lx+1.8,ly+3.7],[lx,ly+2.8]],j<2?'#b8f5ff':'#668be1');
          }
          for(let k=0;k<5;k++){
            const lx=e[0]+8+k*4.3,ly=e[1]-(lx-e[0])*.53+5;
            light(lx,ly,1,k===0?'#ccfbff':'#6386db');
          }
        }
      }
      chassis(165,119,59,59,5,true);
      chassis(176,108,48,48,12);
      chassis(176,92,48,48,12);
      chassis(176,76,48,48,12);
      const diamond=[[201,77],[224,65],[247,77],[224,89]];
      shape(diamond,'rgba(43,80,201,.36)','#d5e7ff',.9);
      shape([[209,77],[224,69],[239,77],[224,85]],'','#e8f0ff',.8);
      shape([[216,77],[224,73],[232,77],[224,81]],'#d0e7ff');
      chassis(88,105,13,13,4,true); chassis(97,47,14,14,4,true);
      chassis(300,39,12,12,4,true); chassis(320,130,15,15,5,true);
      for(const [x,y] of [[79,59],[276,23],[321,88],[153,115],[248,39],[344,72],[130,143]]){
        light(x,y,1.65,'rgba(215,240,255,.9)');
        shape([[x-3.8,y],[x+3.8,y]],'','rgba(190,228,255,.6)',.65);
        shape([[x,y-3.8],[x,y+3.8]],'','rgba(190,228,255,.6)',.65);
      }
    }
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <canvas ref={canvas} className="bay-network-art" aria-hidden="true" />;
}
