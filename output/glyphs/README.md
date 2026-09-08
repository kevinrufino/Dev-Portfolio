# Project glyph assets

Approved assets prepared for the portfolio's 88×88 luminance renderer.
Black is empty in the runtime WebM files; five nonzero grayscale levels retain the subject. Lossless VP9 avoids adding shades through compression. Transparent previews and larger masters are retained here.

| Project | Runtime file under public/cursors/levels | Duration |
| --- | --- | --- |
| Candid Chat Agent | candid-rotation-L6.webm | 3 s |
| Max's Lab | maxs-lab-L6.webm | 2.516 s |
| EA Sports FC Partner Page | eafc-L6.webm | 3.333 s |
| TINAJ Collection Listing Page | tinaj-gimbal-L6.webm | 2.5 s |
| Our Force 1 Poster Content Display Page | our-force-1-L6.webm | 2.516 s |

Candid: checkerboard removed from the supplied white C-and-dot logo, rotated in plane.
Max: foreground segmented frame by frame with rembg/isnet-general-use; full-resolution transparent WebM retained. Some moving finger edges are soft. Runtime motion is twice original speed.
EAFC: supplied logo animation trimmed before the left-hand EA SPORTS banner starts; cropped square, white background removed, and foreground inverted for the luminance renderer.
TINAJ: https://commons.wikimedia.org/wiki/File:Rotating_gimbal-xyz.gif — Lars H. Rohwedder (RokerHRO), public domain. Background removed, padded, grayscale, twice original speed.
Our Force 1: supplied video with lime title keyed out; particle shoe retained, twice original speed.

Moodie has no new supplied asset yet. Existing unrelated glyphs should be preserved when applying a Studio export.

Run preparation helpers from the repository root. Python helper requires Pillow and NumPy; video encoders require FFmpeg. These are offline asset tools, not application dependencies.
