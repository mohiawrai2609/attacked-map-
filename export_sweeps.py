# Reconstruct raw sweep JSON files from Supabase for last 5 days.
# Output matches the upload schema: results grouped by primary_category,
# each incident carrying its full nested relations.

import json
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

SUPABASE_URL = "https://ovenyjguhkgiceddzwna.supabase.co"
ANON_KEY = "sb_publishable_23l5g7MVvgkKuUIctG-e9w_cWYnAtM5"
OUT_DIR = Path(r"C:\Users\mohin\Downloads\attacked_sweeps_5day")
OUT_DIR.mkdir(parents=True, exist_ok=True)

DAYS = ["2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"]

# Single PostgREST query — incidents + all related tables via embed syntax.
# Field list mirrors the upload-zone schema verbatim so the export is
# immediately re-uploadable round-trip.
SELECT = (
    "*,"
    "sources(*),"
    "blast_radius(*),"
    "peer_watchlist(*),"
    "historical_analogues(*),"
    "vendors(*),"
    "best_practices(*),"
    "adaptive_objectives(*),"
    "adaptive_master_controls(*),"
    "secondary_mappings(*),"
    "secondary_adaptive_mappings(*)"
)

def fetch_day(day):
    qs = urllib.parse.urlencode({
        "select": SELECT,
        "incident_day": f"eq.{day}",
        "order": "id.asc",
    })
    url = f"{SUPABASE_URL}/rest/v1/incidents?{qs}"
    req = urllib.request.Request(url, headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Accept": "application/json",
        "Prefer": "count=exact",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

# Convert flat blast_radius rows back to grouped object the upload format uses.
# DB stores one row per (incident, channel, entity) — reshape to:
# { internal: [{entity, ...}], supply_chain: [...], ... }
def reshape_blast_radius(rows):
    out = {}
    for r in rows or []:
        bucket = r.get("bucket") or r.get("channel") or "internal"
        if bucket not in out:
            out[bucket] = []
        # strip DB-internal fields, keep the editorial shape
        clean = {k: v for k, v in r.items()
                 if k not in ("id", "incident_id", "bucket", "channel")}
        out[bucket].append(clean)
    return out

def reshape_incident(row):
    # Top-level fields go through; nested relations get cleaned of DB IDs.
    inc = {k: v for k, v in row.items()
           if not k.startswith("_") and k != "id"}

    # Sources — strip DB id/incident_id
    inc["sources"] = [
        {k: v for k, v in s.items() if k not in ("id", "incident_id")}
        for s in row.get("sources", []) or []
    ]
    # Blast radius — reshape from flat rows to grouped object
    inc["blast_radius"] = reshape_blast_radius(row.get("blast_radius"))
    # Peer watchlist
    inc["peer_watchlist"] = [
        {k: v for k, v in p.items() if k not in ("id", "incident_id")}
        for p in row.get("peer_watchlist", []) or []
    ]
    # Historical analogues
    inc["historical_analogues"] = [
        {k: v for k, v in h.items() if k not in ("id", "incident_id")}
        for h in row.get("historical_analogues", []) or []
    ]
    # Vendors
    inc["vendors"] = [
        {k: v for k, v in v.items() if k not in ("id", "incident_id")}
        for v in row.get("vendors", []) or []
    ]
    # Best practices
    inc["best_practices"] = [
        {k: v for k, v in bp.items() if k not in ("id", "incident_id")}
        for bp in row.get("best_practices", []) or []
    ]
    # Adaptive objectives — surface objective_id as id (the semantic CO-XXX code)
    inc["adaptive_objectives"] = [
        {**{k: v for k, v in o.items() if k not in ("id", "incident_id")},
         "id": o.get("objective_id")}
        for o in row.get("adaptive_objectives", []) or []
    ]
    # Adaptive master controls — surface control_id as id
    inc["adaptive_master_controls"] = [
        {**{k: v for k, v in c.items() if k not in ("id", "incident_id")},
         "id": c.get("control_id")}
        for c in row.get("adaptive_master_controls", []) or []
    ]
    # Secondary mappings
    inc["secondary_mappings"] = [
        {k: v for k, v in s.items() if k not in ("id", "incident_id")}
        for s in row.get("secondary_mappings", []) or []
    ]
    inc["secondary_adaptive_mappings"] = [
        {k: v for k, v in s.items() if k not in ("id", "incident_id")}
        for s in row.get("secondary_adaptive_mappings", []) or []
    ]
    return inc

def build_sweep(day, incidents):
    # Group by primary_category — same shape the upload format uses
    by_cat = {}
    for r in incidents:
        cat = r.get("primary_category") or "OPS"
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append(reshape_incident(r))

    results = {}
    for cat, incs in by_cat.items():
        results[cat] = {
            "category": cat,
            "incidents": incs,
            "included_count": len(incs),
        }

    return {
        "generated_at": f"{day}T08:00:00.000Z",
        "lookback_hours": 24,
        "model": "claude-sonnet-4-5",
        "schema_version": 2,
        "sweep_date": day,
        "incident_count": len(incidents),
        "results": results,
    }

print("Exporting 5 days...")
manifest = []
for day in DAYS:
    print(f"  {day}...", end=" ", flush=True)
    incidents = fetch_day(day)
    sweep = build_sweep(day, incidents)
    out_path = OUT_DIR / f"{day}.json"
    out_path.write_text(json.dumps(sweep, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OK ({len(incidents)} incidents, {out_path.stat().st_size:,} bytes)")
    manifest.append({"date": day, "incidents": len(incidents), "file": out_path.name})

print()
print("Done. Files:", str(OUT_DIR))
for m in manifest:
    print(f"  {m['file']:20s}  {m['incidents']:3d} incidents")
