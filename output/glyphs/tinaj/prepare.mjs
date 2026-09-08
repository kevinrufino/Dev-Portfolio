import {execFileSync as run} from 'node:child_process';
import fs from 'node:fs';
const dir='output/glyphs/tinaj';
for(const n of [240,88]){
 const raw=run('ffmpeg',['-v','error','-i',`${dir}/source.gif`,'-vf',`format=rgba,colorkey=0xFFFFFF:0.08:0,pad=280:280:20:20:color=black@0,scale=${n}:${n}:flags=area`,'-f','rawvideo','-pix_fmt','rgba','-'],{maxBuffer:1<<28});
 let lo=255,hi=0;
 for(let p=0;p<raw.length;p+=4)if(raw[p+3]>=128){let y=.299*raw[p]+.587*raw[p+1]+.114*raw[p+2];lo=Math.min(lo,y);hi=Math.max(hi,y)}
 const gray=Buffer.alloc(raw.length/4);
 for(let p=0,j=0;p<raw.length;p+=4,j++){
 const solid=raw[p+3]>=128;
 const y=.299*raw[p]+.587*raw[p+1]+.114*raw[p+2];
 const k=solid?1+Math.round(Math.max(0,Math.min(1,(y-lo)/(hi-lo)))*4):0;
 gray[j]=k*51;raw[p]=raw[p+1]=raw[p+2]=k*51;raw[p+3]=solid?255:0;
 }
 if(n===88)run('ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','gray','-s','88x88','-r','40','-i','pipe:0','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv420p','-y','public/cursors/levels/tinaj-gimbal-L6.webm'],{input:gray});
 else run('ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','rgba','-s','240x240','-r','40','-i','pipe:0','-filter_complex','split[a][b];[a]palettegen=max_colors=6:reserve_transparent=1[p];[b][p]paletteuse=dither=none','-loop','0','-y',`${dir}/tinaj-glyph.gif`],{input:raw});
 console.log(n,'pixels;',raw.length/(n*n*4),'frames; grayscale:',[...new Set(gray)].sort((a,b)=>a-b));
}
