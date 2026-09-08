from PIL import Image, ImageFilter
import numpy as np, subprocess
from pathlib import Path
out=Path('output/glyphs/candid')
src=Image.open('output/glyphs/candid/source.png').convert('RGB')
a=np.asarray(src);lum=np.asarray(src.convert('L'))
# White foreground is separated from the mid-gray baked checkerboard.
mask=Image.fromarray(np.where(lum>230,255,0).astype('uint8')).filter(ImageFilter.GaussianBlur(.6))
rgba=src.convert('RGBA');rgba.putalpha(mask);rgba.save(out/'candid-transparent.png')
box=mask.getbbox();mark=rgba.crop(box);mark.thumbnail((240,240),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(360,360));canvas.alpha_composite(mark,((360-mark.width)//2,(360-mark.height)//2))
frames=[];raw=[]
for i in range(72):
 im=canvas.rotate(-360*i/72,Image.Resampling.BICUBIC,expand=False)
 # Quantize alpha coverage after downsizing; black is empty in the site sampler.
 small=im.resize((88,88),Image.Resampling.LANCZOS)
 alpha=np.asarray(small.getchannel('A'),dtype=float)
 field=(np.rint(alpha/255*5)*51).astype('uint8');raw.append(field.tobytes())
 preview=im.resize((256,256),Image.Resampling.LANCZOS)
 ix=np.where(np.asarray(preview.getchannel('A'))>=128,1,0).astype('uint8')
 pal=Image.fromarray(ix,'P');pal.putpalette([0,0,0,255,255,255]+[0]*762);pal.info['transparency']=0;frames.append(pal)
frames[0].save(out/'candid-rotation.gif',save_all=True,append_images=frames[1:],duration=[40,40,40,50]*18,loop=0,disposal=2,transparency=0,optimize=False)
subprocess.run(['ffmpeg','-v','error','-f','rawvideo','-pix_fmt','gray','-s','88x88','-r','24','-i','pipe:0','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv420p','-y','public/cursors/levels/candid-rotation-L6.webm'],input=b''.join(raw),check=True)
print('72 frames, 3-second full rotation; transparent PNG and GIF saved')
