import {execFileSync as run} from 'node:child_process';
const source='output/glyphs/our-force-1/source.mp4';
const raw=run('ffmpeg',['-v','error','-i',source,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<29});
// The green title is separate from the monochrome shoe; key it before scaling.
for(let p=0;p<raw.length;p+=3){const [r,g,b]=[raw[p],raw[p+1],raw[p+2]];if(g-b>18&&g>r*.95){raw[p]=raw[p+1]=raw[p+2]=0;}}
for(const n of [88,256]){
 const small=run('ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','512x512','-r','64','-i','pipe:0','-vf',`scale=${n}:${n}:flags=area,format=gray`,'-f','rawvideo','-pix_fmt','gray','-'],{input:raw,maxBuffer:1<<28});
 const rgba=Buffer.alloc(small.length*4);
 for(let i=0;i<small.length;i++){
 const v=small[i]<8?0:51*(1+Math.round((small[i]-8)/247*4));small[i]=v;
 rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=v;rgba[i*4+3]=v?255:0;
 }
 if(n===88)run('ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','gray','-s','88x88','-r','64','-i','pipe:0','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv420p','-y','public/cursors/levels/our-force-1-L6.webm'],{input:small});
 else run('ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','rgba','-s','256x256','-r','64','-i','pipe:0','-filter_complex','fps=32,split[a][b];[a]palettegen=max_colors=6:reserve_transparent=1[p];[b][p]paletteuse=dither=none','-loop','0','-y','output/glyphs/our-force-1/our-force-1-glyph.gif'],{input:rgba});
 console.log(n,'px;',small.length/(n*n),'frames; shades:',[...new Set(small)].sort((a,b)=>a-b));
}
