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

export default function Globe3D({ visibleIncidents = [], selectedId, onSelect }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const incidentsRef = useRef(visibleIncidents);
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.Cesium);
  const [failed, setFailed] = useState(false);

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

  // ── Build / rebuild incident points ─────────────────────────────────────
  function buildEntities(viewer, incidents) {
    const Cesium = window.Cesium;
    viewer.entities.removeAll();
    incidents.forEach((inc) => {
      if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return;
      const c = Cesium.Color.fromCssColorString(SEV_COLOR[inc.severity] || SEV_COLOR[3]);
      viewer.entities.add({
        id: String(inc._id),
        position: Cesium.Cartesian3.fromDegrees(inc.longitude, inc.latitude),
        point: {
          pixelSize: 11,
          color: c.withAlpha(0.95),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.5, 4.0e7, 0.5),
        },
      });
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

      // Easy zoom: get right down to street level, no auto-spin fighting the wheel.
      const cc = viewer.scene.screenSpaceCameraController;
      cc.minimumZoomDistance = 250;          // ~250 m — street level
      cc.maximumZoomDistance = 30000000;
      cc.enableCollisionDetection = true;

      // Framing: whole globe from space, camera on the lit hemisphere so the
      // terminator falls toward the left edge (like the reference).
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-45, 15, 24000000),
      });

      // Click a point → open the existing incident card via onSelect(_id).
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        const picked = viewer.scene.pick(movement.position);
        if (Cesium.defined(picked) && picked.id && picked.id.id != null) {
          onSelectRef.current && onSelectRef.current(picked.id.id);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      viewer._clickHandler = handler;

      buildEntities(viewer, incidentsRef.current);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Cesium init error:", e);
      setFailed(true);
      return;
    }

    return () => {
      try { viewer._clickHandler && viewer._clickHandler.destroy(); } catch (_) {}
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
    if (!viewer || !window.Cesium || !selectedId) return;
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

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
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
