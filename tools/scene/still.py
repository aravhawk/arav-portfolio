"""Encode a first-paint AVIF from a composed, word-free WebGL capture."""
import sys
from pathlib import Path
from PIL import Image
source,dest,width=sys.argv[1:]
image=Image.open(source).convert('RGB')
w=min(int(width),image.width)
image.resize((w,round(w*image.height/image.width)),Image.Resampling.LANCZOS).save(
    Path(dest),format='AVIF',quality=46,speed=4,subsampling='4:2:0')
