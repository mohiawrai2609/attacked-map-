// ─────────────────────────────────────────────────────────────────────────
// Globe3D — the GLOBE view, rendered with CesiumJS as a photorealistic
// Google-Earth-style satellite globe (ArcGIS World Imagery + sky atmosphere +
// ground haze + fog + HDR). Cesium is loaded from a CDN via <script> tags in
// index.html (window.Cesium), so it needs no local npm install.
//
// Drop-in for the previous globe: same props (visibleIncidents / selectedId /
// onSelect). Incidents render as severity-coloured points; clicking one calls
// onSelect(incident._id) → opens the existing GUARD incident card. No extra
// chrome — the map's HUD, Flat/Globe toggle and RISK LEVEL legend are intact.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";

// Severity → point colour (mirrors GlobalAttackMap's SEVERITY scale, 1–5).
const SEV_COLOR = {
  5: "#FF3B30", // CRITICAL
  4: "#FF6B35", // HIGH
  3: "#F5B800", // MEDIUM
  2: "#34C759", // LOW
  1: "#8E8E93", // MINIMAL
};

const ARCGIS_WORLD_IMAGERY =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
const ARCGIS_LABELS =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer";

export default function Globe3D({ mapMode = "globe", visibleIncidents = [], selectedId, hoveredId, activeCountries = new Set(), onSelect, onHover, showBlastRadius = false, showLabels = false, world = null }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const labelsLayerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const incidentsRef = useRef(visibleIncidents);
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.Cesium);
  const [failed, setFailed] = useState(false);
  const [tooltip, setTooltip] = useState(null); // { x, y, name, channel, color, incidentName }

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // ── Wait for the Cesium global (script is `defer`red in index.html) ──────
  useEffect(() => {
    if (window.Cesium) { setReady(true); return; }
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      if (window.Cesium) { setReady(true); clearInterval(iv); }
      else if (tries > 200) { setFailed(true); clearInterval(iv); } // ~20s
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // ── Morph between 2D and 3D based on mapMode ──────────────────────────
  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const scene = viewer.scene;
    const Cesium = window.Cesium;
    if (mapMode === "flat") {
      scene.morphTo2D(1.2);
      const done = scene.morphComplete.addEventListener(() => {
        done();
        if (!viewer.isDestroyed()) {
          viewer.camera.flyHome(0);
          if (viewer.camera.frustum && typeof viewer.camera.frustum.width === "number") {
            viewer.camera.frustum.width *= 1.7;
          }
        }
      });
    } else {
      scene.morphTo3D(1.2);
      const done = scene.morphComplete.addEventListener(() => {
        done();
        if (!viewer.isDestroyed()) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(-45, 15, 2.4e7),
            duration: 0.8,
          });
        }
      });
    }
  }, [mapMode]);

  // ── Toggle country/city label overlay based on showLabels ──────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    const Cesium = window.Cesium;

    if (showLabels) {
      if (!labelsLayerRef.current) {
        labelsLayerRef.current = viewer.imageryLayers.addImageryProvider(
          new Cesium.ArcGisMapServerImageryProvider({ url: ARCGIS_LABELS })
        );
      }
    } else {
      if (labelsLayerRef.current) {
        viewer.imageryLayers.remove(labelsLayerRef.current);
        labelsLayerRef.current = null;
      }
    }
    viewer.scene.requestRender();
  }, [showLabels, ready]);
  // ── Highlight country/region on map ─────────────────────────────────────
  const geoDataSourceRef = useRef(null);
  const [highlightedCountry, setHighlightedCountry] = useState(null);
  const highlightSevRef = useRef(3);
  const [geoLoaded, setGeoLoaded] = useState(false);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium || !world || !world.features) return;
    if (geoDataSourceRef.current) return;
    const Cesium = window.Cesium;
    const geojson = { type: "FeatureCollection", features: world.features };
    Cesium.GeoJsonDataSource.load(geojson, {
      clampToGround: true,
    }).then(ds => {
      viewer.dataSources.add(ds);
      geoDataSourceRef.current = ds;
      ds.entities.values.forEach(ent => {
        const nm = ent.properties && ent.properties.name && ent.properties.name.getValue();
        ent._countryName = nm || null;
        if (ent.polygon) {
          ent.polygon.material = Cesium.Color.TRANSPARENT;
          ent.polygon.outline = false;
        }
      });
      setGeoLoaded(true);
      viewer.scene.requestRender();
    }).catch(() => {});
  }, [world, ready]);

  // Case-insensitive & alias-tolerant country matching helper
  const isSameCountry = (c1, c2) => {
    if (!c1 || !c2) return false;
    const n1 = c1.toLowerCase().trim();
    const n2 = c2.toLowerCase().trim();
    if (n1 === n2) return true;
    
    const aliases = {
      "united states": ["united states of america", "usa", "us"],
      "united states of america": ["united states", "usa", "us"],
      "united kingdom": ["united kingdom of great britain and northern ireland", "uk", "great britain"],
      "united kingdom of great britain and northern ireland": ["united kingdom", "uk", "great britain"],
      "south korea": ["korea, republic of", "korea", "republic of korea", "korea, south"],
      "korea, republic of": ["south korea", "korea", "republic of korea", "korea, south"],
      "republic of korea": ["south korea", "korea", "korea, republic of", "korea, south"],
      "russia": ["russian federation"],
      "russian federation": ["russia"],
      "vietnam": ["viet nam"],
      "viet nam": ["vietnam"],
      "iran": ["iran, islamic republic of"],
      "iran, islamic republic of": ["iran"],
      "syria": ["syrian arab republic"],
      "syrian arab republic": ["syria"],
    };

    if (aliases[n1] && aliases[n1].includes(n2)) return true;
    if (aliases[n2] && aliases[n2].includes(n1)) return true;
    return n1.includes(n2) || n2.includes(n1);
  };

  useEffect(() => {
    const ds = geoDataSourceRef.current;
    if (!ds || !window.Cesium) return;
    const Cesium = window.Cesium;
    const goldColor = Cesium.Color.fromCssColorString("#F5B800");
    const c = Cesium.Color.fromCssColorString(SEV_COLOR[highlightSevRef.current] || "#F5B800");
    ds.entities.values.forEach(ent => {
      if (!ent.polygon) return;
      const countryName = ent._countryName;
      if (!countryName) return;

      const isFocused = highlightedCountry && isSameCountry(countryName, highlightedCountry);
      let isActiveFilter = false;
      if (activeCountries && activeCountries.size > 0) {
        for (const ac of activeCountries) {
          if (isSameCountry(countryName, ac)) {
            isActiveFilter = true;
            break;
          }
        }
      }

      if (isFocused) {
        ent.polygon.material = c.withAlpha(0.25);
        ent.polygon.outline = true;
        ent.polygon.outlineColor = c.withAlpha(0.9);
      } else if (isActiveFilter) {
        ent.polygon.material = goldColor.withAlpha(0.18);
        ent.polygon.outline = true;
        ent.polygon.outlineColor = goldColor.withAlpha(0.85);
      } else {
        ent.polygon.material = Cesium.Color.TRANSPARENT;
        ent.polygon.outline = false;
      }
    });
    if (viewerRef.current) viewerRef.current.scene.requestRender();
  }, [highlightedCountry, activeCountries, geoLoaded]);

  useEffect(() => {
    const focusId = selectedId || hoveredId;
    if (!focusId) { setHighlightedCountry(null); return; }
    const inc = visibleIncidents.find(i => i._id === focusId);
    if (!inc || !inc.country) { setHighlightedCountry(null); return; }
    highlightSevRef.current = inc.severity || 3;
    setHighlightedCountry(inc.country);
  }, [selectedId, hoveredId, visibleIncidents]);

// Country centroid fallback — used when an incident has no lat/lng
// but has a country ISO-2 code. Covers the most common countries in the data.
const COUNTRY_CENTROIDS = {
  US: [-98.58, 39.83],  AD: [1.52, 42.55],  AE: [53.85, 23.42],  AF: [67.71, 33.94],
  AG: [-61.80, 17.08],  AL: [20.17, 41.15],  AM: [45.04, 40.07],  AO: [17.87, -11.20],
  AR: [-63.62, -38.42], AT: [14.55, 47.52],  AU: [133.78, -25.27], AZ: [47.58, 40.14],
  BA: [17.68, 44.16],   BB: [-59.56, 13.19], BD: [90.36, 23.68],  BE: [4.47, 50.50],
  BF: [-1.56, 12.36],   BG: [25.48, 42.73],  BH: [50.56, 26.02],  BI: [29.92, -3.38],
  BJ: [2.32, 9.31],     BN: [114.73, 4.54],  BO: [-64.67, -16.29],BR: [-51.93, -14.24],
  BS: [-77.40, 24.78],  BT: [90.43, 27.51],  BW: [24.68, -22.33], BY: [28.05, 53.71],
  BZ: [-88.50, 17.19],  CA: [-96.80, 56.13], CD: [23.65, -2.88],  CF: [20.94, 6.61],
  CG: [15.83, -0.23],   CH: [8.23, 46.82],   CI: [-5.55, 7.54],   CL: [-71.54, -35.68],
  CM: [12.35, 5.70],    CN: [104.20, 35.86], CO: [-74.30, 4.57],  CR: [-84.02, 9.75],
  CU: [-79.52, 21.52],  CV: [-23.99, 15.12], CY: [33.43, 35.13],  CZ: [15.47, 49.82],
  DE: [10.45, 51.17],   DJ: [42.59, 11.83],  DK: [9.50, 56.26],   DO: [-70.16, 18.74],
  DZ: [1.66, 28.03],    EC: [-78.18, -1.83], EE: [25.01, 58.60],  EG: [30.80, 26.82],
  ER: [39.78, 15.18],   ES: [-3.75, 40.46],  ET: [40.49, 9.15],   FI: [25.75, 61.92],
  FJ: [179.41, -16.58], FR: [2.21, 46.23],   GA: [11.61, -0.80],  GB: [-3.44, 55.38],
  GE: [43.36, 42.32],   GH: [-1.02, 7.95],   GM: [-15.31, 13.44], GN: [-11.81, 10.95],
  GQ: [10.27, 1.65],    GR: [21.82, 39.07],  GT: [-90.23, 15.78], GW: [-14.45, 11.80],
  GY: [-58.93, 4.86],   HN: [-86.24, 15.20], HR: [15.20, 45.10],  HT: [-72.29, 18.97],
  HU: [19.50, 47.16],   ID: [117.75, -0.79], IE: [-8.24, 53.41],  IL: [34.85, 30.80],
  IN: [78.96, 20.59],   IQ: [43.68, 33.22],  IR: [53.69, 32.43],  IS: [-18.53, 64.96],
  IT: [12.57, 41.87],   JM: [-77.30, 18.11], JO: [36.24, 30.59],  JP: [138.25, 36.20],
  KE: [37.91, 0.02],    KG: [74.77, 41.20],  KH: [104.99, 12.57], KI: [174.00, 1.87],
  KM: [43.87, -11.88],  KP: [127.51, 40.34], KR: [127.77, 35.91], KW: [47.48, 29.34],
  KZ: [66.92, 48.02],   LA: [102.50, 17.97], LB: [35.86, 33.85],  LK: [80.77, 7.87],
  LR: [-9.43, 6.43],    LS: [28.23, -29.61], LT: [23.88, 55.17],  LU: [6.13, 49.82],
  LV: [24.60, 56.88],   LY: [17.23, 26.34],  MA: [-7.09, 31.79],  MD: [28.37, 47.41],
  ME: [19.37, 42.71],   MG: [46.87, -18.77], MK: [21.75, 41.61],  ML: [-3.00, 17.57],
  MM: [95.96, 16.87],   MN: [103.85, 46.86], MR: [-10.94, 17.28], MT: [14.38, 35.94],
  MU: [57.55, -20.35],  MV: [73.22, 3.20],   MW: [34.30, -13.25], MX: [-102.55, 23.95],
  MY: [109.70, 4.21],   MZ: [35.53, -18.67], NA: [18.49, -22.96], NE: [8.08, 17.61],
  NG: [8.68, 9.08],     NI: [-85.21, 12.87], NL: [5.29, 52.13],   NO: [8.47, 60.47],
  NP: [84.12, 28.39],   NR: [166.93, -0.52], NZ: [174.89, -40.90],OM: [57.55, 21.51],
  PA: [-80.78, 8.54],   PE: [-75.02, -9.19], PG: [143.96, -6.31], PH: [122.87, 12.88],
  PK: [69.35, 30.38],   PL: [19.15, 51.92],  PT: [-8.22, 39.40],  PW: [134.58, 7.51],
  PY: [-58.44, -23.44], QA: [51.18, 25.35],  RO: [24.97, 45.94],  RS: [21.01, 44.02],
  RU: [105.32, 61.52],  RW: [29.87, -1.94],  SA: [45.08, 23.89],  SB: [160.16, -9.64],
  SD: [30.22, 12.86],   SE: [18.64, 60.13],  SG: [103.82, 1.36],  SI: [14.99, 46.15],
  SK: [19.70, 48.67],   SL: [-11.78, 8.46],  SM: [12.46, 43.94],  SN: [-14.45, 14.50],
  SO: [46.20, 5.15],    SR: [-56.03, 3.92],  SS: [31.30, 6.88],   ST: [6.61, 0.33],
  SV: [-88.90, 13.79],  SY: [38.30, 34.80],  SZ: [31.46, -26.52], TD: [18.73, 15.45],
  TG: [0.82, 8.62],     TH: [100.99, 15.87], TJ: [71.28, 38.86],  TL: [125.73, -8.87],
  TM: [58.74, 40.07],   TN: [9.54, 33.89],   TO: [-175.20, -21.18],TR: [35.24, 38.96],
  TT: [-61.22, 10.69],  TV: [177.65, -7.11], TZ: [34.89, -6.37],  UA: [31.17, 48.38],
  UG: [32.29, 1.37],    UY: [-55.77, -32.52],UZ: [63.95, 41.38],  VA: [12.45, 41.90],
  VC: [-61.20, 12.98],  VE: [-66.59, 6.42],  VN: [108.28, 14.06], VU: [166.36, -15.38],
  WS: [-172.10, -13.76],YE: [47.59, 15.55],  ZA: [25.08, -29.00], ZM: [27.85, -13.13],
  ZW: [29.15, -19.00],
  // Regional/global fallbacks
  EU: [10.00, 50.00], // Europe centroid
  ZZ: [0.00, 20.00],  // Global/unknown fallback
};

function resolveCoords(inc) {
  if (typeof inc.latitude === "number" && typeof inc.longitude === "number"
      && inc.latitude !== 0 && inc.longitude !== 0) {
    return [inc.longitude, inc.latitude];
  }
  // Try country code fallback
  if (inc.country && COUNTRY_CENTROIDS[inc.country]) {
    return COUNTRY_CENTROIDS[inc.country];
  }
  return null; // truly unknown — skip rendering
}

  // ── Build / rebuild incident points ─────────────────────────────────────
  function buildEntities(viewer, incidents) {
    const Cesium = window.Cesium;
    viewer.entities.removeAll();
    incidents.forEach((inc) => {
      const coords = resolveCoords(inc);
      if (!coords) return;
      const [lng, lat] = coords;
      const c = Cesium.Color.fromCssColorString(SEV_COLOR[inc.severity] || SEV_COLOR[3]);
      const entity = viewer.entities.add({
        id: String(inc._id),
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        point: {
          pixelSize: 22,
          color: c.withAlpha(0.95),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.5, 4.0e7, 0.5),
        },
      });
      entity._incident = inc;
    });
    viewer.scene.requestRender();
  }

  // ── Initialise the Cesium viewer (once, when ready) ─────────────────────
  useEffect(() => {
    if (!ready || !containerRef.current || viewerRef.current) return;
    const Cesium = window.Cesium;
    let viewer;
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({ url: ARCGIS_WORLD_IMAGERY }),
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        animation: false,
        creditContainer: document.createElement("div"), // hide the credit bar
        contextOptions: { webgl: { alpha: false } },
        mapMode2D: Cesium.MapMode2D.CLAMP,
      });
      viewerRef.current = viewer;

      // ── Photogenic "Google Earth" look, with a real day/night terminator ──
      // Lighting is ON (so there are day + night hemispheres like the
      // reference), but the sun is FROZEN at equinox-noon over the prime
      // meridian and the camera starts on the lit side — so it opens bright
      // with the terminator toward one edge, never a black face.
      viewer.scene.globe.enableLighting = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = 0.15;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.00008;
      viewer.scene.highDynamicRange = true;
      viewer.scene.globe.baseColor = Cesium.Color.BLACK;
      viewer.scene.backgroundColor = Cesium.Color.BLACK;
      if (viewer.scene.skyBox) viewer.scene.skyBox.show = true; // starfield

      // Freeze the sun (sub-solar point on the prime meridian) → stable terminator.
      viewer.clock.currentTime = Cesium.JulianDate.fromIso8601("2025-03-20T12:00:00Z");
      viewer.clock.shouldAnimate = false;
      viewer.clock.multiplier = 0;

      // Easy zoom: get right down to street level.
      const cc = viewer.scene.screenSpaceCameraController;
      cc.minimumZoomDistance = 250;          // ~250 m — street level
      cc.maximumZoomDistance = 30000000;
      cc.enableCollisionDetection = true;
      cc.inertiaZoom = 0.3;                  // slight inertia feels natural
      // Disable default Cesium wheel zoom so our custom handler does not conflict.
      // Keep Cesium's touch screen pinch-zoom intact.
      cc.zoomEventTypes = [
        Cesium.CameraEventType.PINCH,
      ];

      // Framing: whole globe from space, camera on the lit hemisphere so the
      // terminator falls toward the left edge (like the reference).
      if (mapMode === "flat") {
        // Will be overridden by morphTo2D(0) + flyHome below
      } else {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-45, 15, 24000000),
        });
      }

      // ── Auto-rotation: rotate globe slowly when user is idle ─────────────
      let isUserInteracting = false;
      let interactTimer = null;
      const ROTATE_SPEED = 0.04; // degrees per frame

      // Detect user interaction (mouse/touch down → pause, release → resume)
      const canvas2 = viewer.scene.canvas;
      function onInteractStart() {
        isUserInteracting = true;
        clearTimeout(interactTimer);
      }
      function onInteractEnd() {
        // Resume auto-rotate 1.5s after user releases
        clearTimeout(interactTimer);
        interactTimer = setTimeout(() => { isUserInteracting = false; }, 1500);
      }
      
      // Custom trackpad precision zoom & pinch handler
      function onWheel(e) {
        e.preventDefault(); // prevent browser from scrolling the webpage!
        onInteractStart();
        
        const camera = viewer.camera;
        const h = camera.positionCartographic.height;
        
        let delta = e.deltaY;
        if (e.ctrlKey) {
          // Boost pinch-to-zoom speed
          delta = e.deltaY * 5;
        }
        
        const zoomSens = 0.0015;
        const factor = Math.exp(delta * zoomSens);
        const clampedFactor = Math.max(0.7, Math.min(1.4, factor));
        const targetHeight = h * clampedFactor;
        
        if (clampedFactor > 1) {
          // Zooming out
          const amount = Math.min(30000000 - h, targetHeight - h);
          if (amount > 0) camera.zoomOut(amount);
        } else {
          // Zooming in
          const amount = Math.min(h - 250, h - targetHeight);
          if (amount > 0) camera.zoomIn(amount);
        }
        
        viewer.scene.requestRender();
      }

      canvas2.addEventListener("mousedown", onInteractStart);
      canvas2.addEventListener("touchstart", onInteractStart, { passive: true });
      canvas2.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("mouseup", onInteractEnd);
      window.addEventListener("touchend", onInteractEnd);
      viewer._autoRotateListeners = { canvas2, onInteractStart, onInteractEnd, onWheel };

      // Use postRender to rotate camera every frame
      viewer._autoRotateHandler = viewer.scene.postRender.addEventListener(() => {
        if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) return;
        if (!isUserInteracting && !viewer._forceStopRotate && viewer && !viewer.isDestroyed()) {
          viewer.scene.camera.rotate(
            Cesium.Cartesian3.UNIT_Z,
            Cesium.Math.toRadians(-ROTATE_SPEED)
          );
        }
      });
      viewer._stopAutoRotate = () => {
        clearTimeout(interactTimer);
        if (viewer._autoRotateHandler) { viewer._autoRotateHandler(); viewer._autoRotateHandler = null; }
        if (viewer._autoRotateListeners) {
          const { canvas2, onInteractStart, onInteractEnd, onWheel } = viewer._autoRotateListeners;
          canvas2.removeEventListener("mousedown", onInteractStart);
          canvas2.removeEventListener("touchstart", onInteractStart);
          canvas2.removeEventListener("wheel", onWheel);
          window.removeEventListener("mouseup", onInteractEnd);
          window.removeEventListener("touchend", onInteractEnd);
        }
      };

      // Click a point → open the existing incident card via onSelect(_id).
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        const picked = viewer.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id && picked.id.id != null) {
          onSelectRef.current && onSelectRef.current(picked.id.id);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      viewer._clickHandler = handler;

      // Handle initial mapMode
      if (mapMode === "flat") {
        viewer.scene.morphTo2D(0);
        viewer.camera.flyHome(0);
        if (viewer.camera.frustum && typeof viewer.camera.frustum.width === "number") {
          viewer.camera.frustum.width *= 1.7;
        }
      }

      buildEntities(viewer, incidentsRef.current);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Cesium init error:", e);
      setFailed(true);
      return;
    }

    return () => {
      try {
        if (viewer._stopAutoRotate) viewer._stopAutoRotate();
        viewer._clickHandler && viewer._clickHandler.destroy();
      } catch (_) {}
      try { viewer.destroy(); } catch (_) {}
      viewerRef.current = null;
    };
  }, [ready]);

  // ── Rebuild points when the incident set changes ────────────────────────
  useEffect(() => {
    incidentsRef.current = visibleIncidents;
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    buildEntities(viewer, visibleIncidents);
  }, [visibleIncidents]);

  // ── Fly to / highlight the externally-selected incident ─────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    // Stop rotation when an incident is selected, resume when deselected
    viewer._forceStopRotate = !!selectedId;
    if (!selectedId) return;
    const ent = viewer.entities.getById(String(selectedId));
    if (ent && ent.position) {
      const Cesium = window.Cesium;
      const carto = Cesium.Cartographic.fromCartesian(ent.position.getValue(Cesium.JulianDate.now()));
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 3500000),
        duration: 1.2,
      });
    }
  }, [selectedId]);

  // ── Blast-radius arcs for selected incident ──────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    const Cesium = window.Cesium;

    // Clear previous blast arcs always
    const toRemove = [];
    const allEnts = viewer.entities.values;
    for (let i = 0; i < allEnts.length; i++) {
      if (allEnts[i]._isBlastArc) toRemove.push(allEnts[i]);
    }
    toRemove.forEach(e => viewer.entities.remove(e));

    // Only draw if BLAST toggle is ON
    if (!selectedId || !showBlastRadius) return;
    const inc = incidentsRef.current.find(i => String(i._id) === String(selectedId));
    if (!inc || !inc.blast_radius || typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return;

    const channelDefs = {
      internal:              { color: "#F5B800", width: 3, opacity: 0.75 },
      supply_chain:          { color: "#FF8C5A", width: 3, opacity: 0.75 },
      customer_counterparty: { color: "#4FC3D7", width: 3, opacity: 0.75 },
      competitive_peer:      { color: "#9D7BEC", width: 2.5, opacity: 0.65 },
      regulatory:            { color: "#A8A8A8", width: 2.5, opacity: 0.65 },
      financial_market:      { color: "#7BD693", width: 2.5, opacity: 0.65 },
    };

    Object.entries(inc.blast_radius).forEach(([channel, entities]) => {
      const def = channelDefs[channel] || { color: "#888888", width: 2, opacity: 0.55 };
      if (!Array.isArray(entities)) return;
      entities.forEach(ent => {
        if (typeof ent.latitude !== "number" || typeof ent.longitude !== "number") return;

        // Great-circle polyline
        const geodesic = new Cesium.EllipsoidGeodesic(
          Cesium.Cartographic.fromDegrees(inc.longitude, inc.latitude),
          Cesium.Cartographic.fromDegrees(ent.longitude, ent.latitude)
        );
        const positions = [];
        const N = 80;
        for (let k = 0; k <= N; k++) {
          const c = geodesic.interpolateUsingFraction(k / N);
          positions.push(Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, 20000));
        }
        const arcEnt = viewer.entities.add({
          polyline: {
            positions,
            width: def.width,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.25,
              color: Cesium.Color.fromCssColorString(def.color).withAlpha(def.opacity),
            }),
            arcType: Cesium.ArcType.NONE,
            clampToGround: false,
          },
        });
        arcEnt._isBlastArc = true;

        // Destination dot
        const channelLabels = {
          internal: "Internal", supply_chain: "Supply Chain",
          customer_counterparty: "Customer", competitive_peer: "Peer",
          regulatory: "Regulator", financial_market: "Capital",
        };
        const dotEnt = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(ent.longitude, ent.latitude, 20000),
          point: {
            pixelSize: 18,
            color: Cesium.Color.fromCssColorString(def.color).withAlpha(0.9),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.NONE,
          },
        });
        dotEnt._isBlastArc = true;
        dotEnt._blastMeta = {
          name: ent.name || ent.entity_name || ent.company || "Unknown Entity",
          channel: channelLabels[channel] || channel,
          color: def.color,
          country: ent.country || "",
          entityType: ent.type || "",
          incidentName: inc.title || inc.name || inc.headline || "",
        };

        // Pulsing concentric rings — 2 rings, offset phase so they ripple outward
        const dotColor = Cesium.Color.fromCssColorString(def.color);
        const ringPos = Cesium.Cartesian3.fromDegrees(ent.longitude, ent.latitude, 20000);
        [0, 0.5].forEach((phaseOffset) => {
          const ring = viewer.entities.add({
            position: ringPos,
            ellipse: {
              semiMajorAxis: new Cesium.CallbackProperty(() => {
                const t = ((Date.now() / 2200) + phaseOffset) % 1;
                return 30000 + t * 120000; // 30km → 150km expanding
              }, false),
              semiMinorAxis: new Cesium.CallbackProperty(() => {
                const t = ((Date.now() / 2200) + phaseOffset) % 1;
                return 30000 + t * 120000;
              }, false),
              material: new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(() => {
                  const t = ((Date.now() / 2200) + phaseOffset) % 1;
                  return dotColor.withAlpha(Math.max(0, 0.55 * (1 - t)));
                }, false)
              ),
              outline: true,
              outlineColor: new Cesium.CallbackProperty(() => {
                const t = ((Date.now() / 2200) + phaseOffset) % 1;
                return dotColor.withAlpha(Math.max(0, 0.9 * (1 - t)));
              }, false),
              outlineWidth: 2,
              fill: true,
              height: 20000,
            },
          });
          ring._isBlastArc = true;
        });
      });
    });

    viewer.scene.requestRender();

    // ── Hover tooltip on blast dots ──────────────────────────────────────
    const hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    hoverHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.endPosition);
      if (Cesium.defined(picked) && picked.id) {
        if (picked.id._blastMeta) {
          const meta = picked.id._blastMeta;
          setTooltip({
            type: "blast",
            x: movement.endPosition.x,
            y: movement.endPosition.y,
            name: meta.name,
            channel: meta.channel,
            color: meta.color,
            country: meta.country,
            entityType: meta.entityType,
            incidentName: meta.incidentName,
          });
          onHover(null);
        } else if (picked.id._incident) {
          const inc = picked.id._incident;
          const sevColor = SEV_COLOR[inc.severity] || SEV_COLOR[3];
          setTooltip({
            type: "incident",
            x: movement.endPosition.x,
            y: movement.endPosition.y,
            name: inc.headline,
            color: sevColor,
            category: inc.primary_category || "Classification",
            locationName: inc.location_name || inc.country || "",
            severity: inc.severity,
          });
          onHover(inc._id);
        } else {
          setTooltip(null);
          onHover(null);
        }
      } else {
        setTooltip(null);
        onHover(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    viewer._blastHoverHandler = hoverHandler;

    return () => {
      try { hoverHandler.destroy(); } catch (_) {}
      viewer._blastHoverHandler = null;
    };
  }, [selectedId, showBlastRadius]);


  // ── Zoom / reset controls (reliable, cursor-independent) ────────────────
  const zoomStep = (factor) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const h = viewer.camera.positionCartographic.height;
    if (factor < 1) viewer.camera.zoomIn(h * (1 - factor));
    else viewer.camera.zoomOut(h * (factor - 1));
    viewer.scene.requestRender();
  };
  const resetView = () => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    viewer.camera.flyTo({
      destination: window.Cesium.Cartesian3.fromDegrees(-45, 15, 24000000),
      duration: 1.1,
    });
  };

  const zBtn = {
    width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(26,26,26,0.85)", backdropFilter: "blur(10px)",
    border: "1px solid #333", color: "#F5B800", fontSize: 20, fontWeight: 700,
    cursor: "pointer", lineHeight: 1, userSelect: "none",
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Hover tooltip — handles both blast nodes and incident pins */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: Math.min(tooltip.x + 14, window.innerWidth - 720),
          top: Math.max(10, tooltip.y - 10),
          zIndex: 50,
          pointerEvents: "none",
          background: "rgba(10,10,14,0.92)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${tooltip.color}55`,
          borderLeft: `3px solid ${tooltip.color}`,
          borderRadius: 8,
          padding: "8px 12px",
          minWidth: 200,
          maxWidth: 280,
          boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 12px ${tooltip.color}22`,
          fontFamily: "Inter, sans-serif",
        }}>
          {tooltip.type === "incident" ? (
            <>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: tooltip.color, marginBottom: 4 }}>
                {tooltip.category} · SEV {tooltip.severity}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3 }}>
                {tooltip.name}
              </div>
              {tooltip.locationName && (
                <div style={{ fontSize: 11, color: "#C0C0C8", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12 }}>📍</span> {tooltip.locationName}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: tooltip.color, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: tooltip.color, flexShrink: 0 }} />
                {tooltip.channel}{tooltip.entityType ? ` · ${tooltip.entityType}` : ""}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3 }}>
                {tooltip.name}
              </div>
              {tooltip.country && (
                <div style={{ fontSize: 11, color: "#C0C0C8", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12 }}>📍</span> {tooltip.country}
                </div>
              )}
              {tooltip.incidentName && (
                <div style={{ fontSize: 10, color: "#808088", lineHeight: 1.4, borderTop: "1px solid #2a2a30", paddingTop: 5, marginTop: 5 }}>
                  ↳ {tooltip.incidentName}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Zoom controls — big, obvious, always work (wheel zoom optional). */}
      {ready && !failed && (
        <div style={{ position: "absolute", right: 24, bottom: 170, zIndex: 25, display: "flex", flexDirection: "column", gap: 1, borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
          <button title="Zoom in" onClick={() => zoomStep(0.5)} style={{ ...zBtn, borderRadius: "8px 8px 0 0" }}>＋</button>
          <button title="Zoom out" onClick={() => zoomStep(2)} style={zBtn}>−</button>
          <button title="Reset view" onClick={resetView} style={{ ...zBtn, fontSize: 15, borderRadius: "0 0 8px 8px" }}>⌂</button>
        </div>
      )}
      {!ready && !failed && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#F5B800", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Initializing satellite link…
        </div>
      )}
      {failed && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#A8A8A8", fontFamily: "Inter, sans-serif", fontSize: 13, textAlign: "center", padding: 24 }}>
          Couldn’t load the satellite globe engine.<br />Switch to Flat view.
        </div>
      )}
    </div>
  );
}
