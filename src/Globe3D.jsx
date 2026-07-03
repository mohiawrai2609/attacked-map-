// ─────────────────────────────────────────────────────────────────────────
// Globe3D — the GLOBE view, rendered as a photorealistic 3D satellite Earth
// styled to match the "Digital Twin Protocol" reference: a bright, vivid
// blue-marble Earth with a soft day/night terminator, a luminous atmosphere
// rim, a starfield, and large translucent wireframe "region spheres" floating
// above each incident (clean lat/long grids), coloured by the app's SEVERITY
// scale. Auto-orbiting camera; drag / scroll / click a sphere.
//
// Drop-in for the previous d3 globe: same props. No extra chrome — the map's
// existing HUD, the Flat/Globe toggle and the RISK LEVEL legend are unchanged.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Severity → sphere colour (mirrors GlobalAttackMap's SEVERITY scale, 1–5,
// so the RISK LEVEL legend stays accurate). The reference uses a cool cyan/
// red/white/mint set; these severity hues give the same multi-colour look.
const SEV_COLOR = {
  5: "#FF3B30", // CRITICAL
  4: "#FF6B35", // HIGH
  3: "#F5B800", // MEDIUM
  2: "#34C759", // LOW
  1: "#8E8E93", // MINIMAL
};

const R = 1;              // earth radius (scene units)
const NODE_LIFT = 1.05;   // region spheres float just above the surface

// lat/lon (degrees) → point on a sphere of `radius`, matching an
// equirectangular Earth texture (0,0 → Gulf of Guinea, off West Africa).
function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Day/night shader — the sunlit face shows the vivid day texture; the far
// side fades to a smooth dark (darkened, cool-tinted day texture, like the
// reference — no city lights). `sunDirection` is updated each frame.
const EARTH_VERT = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const EARTH_FRAG = `
  uniform sampler2D dayTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    float intensity = dot(normalize(vWorldNormal), normalize(sunDirection));
    float mixAmount = smoothstep(-0.12, 0.32, intensity);
    vec3 base = texture2D(dayTexture, vUv).rgb;
    vec3 day = base * 1.18;
    vec3 night = base * 0.09 * vec3(0.6, 0.75, 1.15);
    vec3 color = mix(night, day, mixAmount);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Atmosphere fresnel rim (back side, additive) — bright blue-white halo.
const ATMO_VERT = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ATMO_FRAG = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
    gl_FragColor = vec4(glowColor, 1.0) * clamp(intensity, 0.0, 1.0) * 1.5;
  }
`;

export default function Globe3D({ visibleIncidents = [], selectedId, onSelect, onHover }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const selectedRef = useRef(selectedId);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // ── Scene setup (mount once) ──────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      setWebglOk(false);
      return;
    }
    const width = mount.clientWidth || window.innerWidth || 1200;
    const height = mount.clientHeight || window.innerHeight || 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.35, 3.05);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.45;
    controls.enablePan = false;
    controls.minDistance = 1.55;
    controls.maxDistance = 6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.42;

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));

    // Earth — sun direction tracks the camera each frame (offset to one side)
    // so the face we look at is always brightly lit with the terminator near
    // one edge, never a black face.
    const WORLD_UP = new THREE.Vector3(0, 1, 0);
    const loader = new THREE.TextureLoader();
    const dayTex = loader.load("/textures/earth-blue-marble.jpg");
    dayTex.colorSpace = THREE.SRGBColorSpace;
    dayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTex },
        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), earthMat);
    scene.add(earth);

    // Atmosphere (bright blue-white rim)
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color("#6fb8ff") } },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 64, 64), atmoMat);
    scene.add(atmo);

    // Stars
    const starCount = 4000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const rr = 140 + Math.random() * 300;
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      starPos[i * 3] = rr * s * Math.cos(th);
      starPos[i * 3 + 1] = rr * u;
      starPos[i * 3 + 2] = rr * s * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.75 })
    );
    scene.add(stars);

    // Region-sphere group (rebuilt when incidents change)
    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    // Raycasting for sphere clicks
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0, downY = 0;
    const onPointerDown = (e) => { downX = e.clientX; downY = e.clientY; renderer.domElement.style.cursor = "grabbing"; };
    const onPointerUp = (e) => {
      renderer.domElement.style.cursor = "grab";
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return; // drag, not click
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeGroup.children, true);
      if (hits.length) {
        let obj = hits[0].object;
        while (obj && obj.userData.incidentId == null && obj.parent) obj = obj.parent;
        if (obj && obj.userData.incidentId != null && onSelect) onSelect(obj.userData.incidentId);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // Animation loop
    const clock = new THREE.Clock();
    let raf;
    const camDir = new THREE.Vector3();
    const animate = () => {
      const t = clock.getElapsedTime();

      // Sun sits just off the camera axis → the visible hemisphere stays lit,
      // terminator curves toward one edge (reference look).
      camDir.copy(camera.position).normalize();
      camDir.applyAxisAngle(WORLD_UP, 0.62);
      camDir.y += 0.16;
      camDir.normalize();
      earthMat.uniforms.sunDirection.value.copy(camDir);

      const sel = selectedRef.current;
      nodeGroup.children.forEach((n) => {
        const isSel = sel != null && n.userData.incidentId === sel;
        n.rotation.y += 0.004;                        // slow grid spin
        const base = isSel ? 1.35 : 1;
        n.scale.setScalar(base + 0.03 * Math.sin(t * 1.5 + (n.userData.phase || 0)));
        if (n.userData.wire) n.userData.wire.material.opacity = isSel ? 0.95 : 0.72;
        if (n.userData.glow) n.userData.glow.material.opacity = isSel ? 0.16 : 0.07;
      });
      stars.rotation.y = t * 0.004;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    sceneRef.current = { scene, camera, renderer, controls, nodeGroup };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      dayTex.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild region spheres when incidents change ──────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.nodeGroup) return;
    const group = s.nodeGroup;
    while (group.children.length) {
      const c = group.children.pop();
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    // Large translucent wireframe spheres with a faint gel fill + soft glow —
    // the reference "region sphere" look. Geometries shared across nodes.
    const fillGeo = new THREE.SphereGeometry(0.082, 24, 18);
    const wireGeo = new THREE.SphereGeometry(0.088, 20, 14);
    const glowGeo = new THREE.SphereGeometry(0.11, 22, 16);
    visibleIncidents.forEach((inc, i) => {
      if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return;
      const color = new THREE.Color(SEV_COLOR[inc.severity] || SEV_COLOR[3]);
      const pos = latLonToVec3(inc.latitude, inc.longitude, R * NODE_LIFT);
      const node = new THREE.Group();
      node.position.copy(pos);
      node.userData.incidentId = inc.id;
      node.userData.phase = (i % 12) * 0.5;

      const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }));
      fill.userData.incidentId = inc.id;

      const wire = new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.72 }));
      wire.userData.incidentId = inc.id;

      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
      glow.userData.incidentId = inc.id;

      node.userData.wire = wire;
      node.userData.glow = glow;
      node.add(fill, wire, glow);
      group.add(node);
    });
  }, [visibleIncidents]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      {!webglOk && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#A8A8A8", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "center", padding: 24 }}>
          Your browser could not initialise WebGL, so the globe can't render.<br />Switch to Flat view.
        </div>
      )}
    </div>
  );
}
