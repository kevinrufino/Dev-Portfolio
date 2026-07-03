import PropTypes from 'prop-types';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uAspect;
  uniform float uTextureAspect;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  vec2 coverUv(vec2 uv, float planeAspect, float textureAspect) {
    vec2 centered = uv - 0.5;
    if (textureAspect > planeAspect) {
      centered.x *= planeAspect / textureAspect;
    } else {
      centered.y *= textureAspect / planeAspect;
    }
    return centered + 0.5;
  }

  void main() {
    vec2 portalGrid = vec2(38.0, 30.0);
    vec2 pixelUv = (floor(vUv * portalGrid) + 0.5) / portalGrid;
    vec2 portalUv = pixelUv - vec2(0.5);
    portalUv.x *= uAspect;

    float angle = atan(portalUv.y, portalUv.x);
    float radius = length(portalUv);
    vec2 edgeCell = floor(pixelUv * vec2(16.0, 13.0));
    float edgeNoise =
      (noise(vec2(cos(angle), sin(angle)) * 2.4 + uTime * 0.16) - 0.5) * 0.12 +
      (hash(edgeCell + floor(uTime * 1.6)) - 0.5) * 0.08;

    float blob = 0.39 + edgeNoise;
    float imageMask = step(radius, blob);

    vec2 texUv = coverUv(vUv, uAspect, uTextureAspect);
    vec4 image = texture2D(uTexture, texUv);

    if (imageMask < 0.5) discard;
    gl_FragColor = vec4(image.rgb, image.a);
  }
`;

const isImageSrc = src =>
  typeof src === 'string' && /\.(png|jpe?g|gif|webp|avif)$/i.test(src);

const PortalPlane = ({ src }) => {
  const materialRef = useRef(null);
  const [texture, setTexture] = useState(null);
  const [textureAspect, setTextureAspect] = useState(16 / 9);

  useEffect(() => {
    let disposed = false;
    let activeVideo;

    if (isImageSrc(src)) {
      const loader = new THREE.TextureLoader();
      loader.load(src, loadedTexture => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        setTextureAspect(
          loadedTexture.image.width / Math.max(1, loadedTexture.image.height),
        );
        setTexture(previous => {
          previous?.dispose();
          return loadedTexture;
        });
      });
    } else {
      const video = document.createElement('video');
      activeVideo = video;
      video.src = src;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;

      const updateAspect = () => {
        setTextureAspect(video.videoWidth / Math.max(1, video.videoHeight));
      };

      video.addEventListener('loadedmetadata', updateAspect);
      video.play().catch(() => {});
      setTexture(previous => {
        previous?.dispose();
        return videoTexture;
      });
    }

    return () => {
      disposed = true;
      if (activeVideo) {
        activeVideo.pause();
        activeVideo.removeAttribute('src');
        activeVideo.load();
      }
    };
  }, [src]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        vertexShader,
        fragmentShader,
        uniforms: {
          uTexture: { value: null },
          uTime: { value: 0 },
          uAspect: { value: 1.28 },
          uTextureAspect: { value: 16 / 9 },
        },
      }),
    [],
  );

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame(({ clock, size }) => {
    if (!materialRef.current || !texture) return;
    materialRef.current.uniforms.uTexture.value = texture;
    materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    materialRef.current.uniforms.uAspect.value = size.width / Math.max(1, size.height);
    materialRef.current.uniforms.uTextureAspect.value = textureAspect;
  });

  if (!texture) return null;

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <primitive ref={materialRef} object={material} attach="material" />
    </mesh>
  );
};

PortalPlane.propTypes = {
  src: PropTypes.string.isRequired,
};

export const ProjectPortalCanvas = ({ project }) => {
  return (
    <div className="relative aspect-[1.25/1] w-full max-w-full md:max-w-[820px]">
      <Canvas
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        frameloop="always"
        className="absolute inset-0"
      >
        <PortalPlane src={project.scrapeGif} />
      </Canvas>
    </div>
  );
};

ProjectPortalCanvas.propTypes = {
  project: PropTypes.shape({
    scrapeGif: PropTypes.string.isRequired,
  }).isRequired,
};
