// ─────────────────────────────────────────────────────────────────────────
// Globe3D — the GLOBE view, rendered as a photorealistic 3D satellite Earth.
//
// Drop-in replacement for the previous d3 orthographic globe: same props
// (visibleIncidents / selectedId / onSelect / onHover). Realistic blue-marble
// day texture blended with a night texture across a fixed day/night
// terminator, an auto-orbiting camera (drag / scroll / click a node), a
// starfield + atmospheric rim, and glowing wireframe "region nodes" placed
// at each incident's lat/lon and coloured by the app's SEVERITY scale.
//
// No extra chrome (no header, no layer bar) — the map's existing HUD, the
// Flat/Globe toggle and the RISK LEVEL legend are unchanged.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Severity → node colour (mirrors GlobalAttackMap's SEVERITY scale, 1–5,
// so the RISK LEVEL legend stays accurate).
const SEV_COLOR = {
  5: "#FF3B30", // CRITICAL
  4: "#FF6B35", // HIGH
  3: "#F5B800", // MEDIUM
  2: "#34C759", // LOW
  1: "#8E8E93", // MINIMAL
};

const R = 1;              // earth radius (scene units)
const NODE_LIFT = 1.045;  // nodes float just above the surface

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

// Day/night blend shader — mixes a day and night texture across the
// terminator defined by a world-space sun direction.
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
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    float intensity = dot(normalize(vWorldNormal), normalize(sunDirection));
    float mixAmount = smoothstep(-0.08, 0.28, intensity);
    vec3 day = texture2D(dayTexture, vUv).rgb * 1.15;
    vec3 night = texture2D(nightTexture, vUv).rgb * 0.5;
    vec3 color = mix(night, day, mixAmount);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Atmosphere fresnel rim (back side, additive).
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
    float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(glowColor, 1.0) * clamp(intensity, 0.0, 1.0);
  }
`;

export default function Globe3D({ visibleIncidents = [], selectedId, onSelect, onHover }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const selectedRef = useRef(selectedId);
  const [webglOk, setWebglOk] = useState(true);

  // keep the animation loop's notion of "selected" fresh without rebuilds
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
    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.cursor = "grab";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0.4, 3.1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.45;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(-3, 1.4, 2.5);
    scene.add(dir);

    // Earth. The sun direction is updated every frame to track the camera
    // (offset to one side) so the face we look at stays brightly lit.
    const WORLD_UP = new THREE.Vector3(0, 1, 0);
    const sunDirection = new THREE.Vector3(-0.6, 0.28, 0.55).normalize();
    const loader = new THREE.TextureLoader();
    const dayTex = loader.load("/textures/earth-blue-marble.jpg");
    const nightTex = loader.load("/textures/earth-night.jpg");
    dayTex.colorSpace = THREE.SRGBColorSpace;
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTex },
        nightTexture: { value: nightTex },
        sunDirection: { value: sunDirection },
      },
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), earthMat);
    scene.add(earth);

    // Faint graticule (lat/lon grid) for the "digital twin" satellite feel.
    const grat = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.001, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x2a3550, wireframe: true, transparent: true, opacity: 0.14 })
    );
    scene.add(grat);

    // Atmosphere (soft blue rim)
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color("#4EA1FF") } },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 64, 64), atmoMat);
    scene.add(atmo);

    // Stars
    const starCount = 3500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const rr = 120 + Math.random() * 260;
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      starPos[i * 3] = rr * s * Math.cos(t);
      starPos[i * 3 + 1] = rr * u;
      starPos[i * 3 + 2] = rr * s * Math.sin(t);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.7 })
    );
    scene.add(stars);

    // Node group (rebuilt when incidents change)
    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    // Raycasting for node clicks
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0, downY = 0;
    const onPointerDown = (e) => { downX = e.clientX; downY = e.clientY; renderer.domElement.style.cursor = "grabbing"; };
    const onPointerUp = (e) => {
      renderer.domElement.style.cursor = "grab";
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return; // was a drag
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
    const animate = () => {
      const t = clock.getElapsedTime();

      // Keep the sun just off to the side of the camera: the hemisphere we're
      // looking at stays lit and vivid, with the day/night terminator curving
      // across toward one edge (like the reference), never a black face.
      const camDir = camera.position.clone().normalize();
      camDir.applyAxisAngle(WORLD_UP, 0.6);
      camDir.y += 0.18;
      camDir.normalize();
      earthMat.uniforms.sunDirection.value.copy(camDir);

      const sel = selectedRef.current;
      nodeGroup.children.forEach((m) => {
        const isSel = sel != null && m.userData.incidentId === sel;
        const base = isSel ? 1.4 : 1;
        const s = base + 0.06 * Math.sin(t * 1.6 + (m.userData.phase || 0));
        m.scale.setScalar(s);
        if (m.userData.halo) {
          m.userData.halo.material.opacity =
            (isSel ? 0.24 : 0.10) + 0.05 * (0.5 + 0.5 * Math.sin(t * 1.6 + (m.userData.phase || 0)));
        }
        if (m.userData.wire) m.userData.wire.material.opacity = isSel ? 0.95 : 0.7;
      });
      stars.rotation.y = t * 0.005;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    // Resize
    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
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
      dayTex.dispose(); nightTex.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild nodes when incidents change ───────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.nodeGroup) return;
    const group = s.nodeGroup;
    while (group.children.length) {
      const c = group.children.pop();
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    // Small, finely-gridded wireframe spheres with a soft halo — delicate
    // "region nodes" like the reference, not solid glowing blobs.
    const wireGeo = new THREE.SphereGeometry(0.03, 16, 12);
    const haloGeo = new THREE.SphereGeometry(0.046, 16, 12);
    visibleIncidents.forEach((inc, i) => {
      if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return;
      const color = new THREE.Color(SEV_COLOR[inc.severity] || SEV_COLOR[3]);
      const pos = latLonToVec3(inc.latitude, inc.longitude, R * NODE_LIFT);
      const node = new THREE.Group();
      node.position.copy(pos);
      node.userData.incidentId = inc.id;
      node.userData.phase = (i % 12) * 0.5;

      const wire = new THREE.Mesh(
        wireGeo,
        new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.7 })
      );
      wire.userData.incidentId = inc.id;
      node.userData.wire = wire;
      node.add(wire);

      const halo = new THREE.Mesh(
        haloGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      halo.userData.incidentId = inc.id;
      node.userData.halo = halo;
      node.add(halo);

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
