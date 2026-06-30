// Generates "Attacked.ai Demo Script.docx" — a comprehensive reading
// script for explaining the Global Attack Map to clients.
const path = require("path");
const fs = require("fs");

// Resolve the globally-installed docx package
const globalModules = "C:\\Users\\mohin\\AppData\\Roaming\\npm\\node_modules";
const docx = require(path.join(globalModules, "docx"));

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  ExternalHyperlink, TabStopType, TabStopPosition,
} = docx;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const GOLD = "B8860B";          // refined gold (darker for print readability)
const OBSIDIAN = "1A1A1A";
const MUTED = "606060";

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, ...opts.spacing },
    alignment: opts.alignment,
    children: [new TextRun({ text, font: "Calibri", size: 22, ...opts.run })],
  });

const lead = text =>
  new Paragraph({
    spacing: { after: 180 },
    children: [new TextRun({ text, font: "Calibri", size: 24, italics: true, color: MUTED })],
  });

const h1 = text =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "Calibri", size: 36, bold: true, color: OBSIDIAN })],
  });

const h2 = text =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, font: "Calibri", size: 28, bold: true, color: GOLD })],
  });

const h3 = text =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: "Calibri", size: 24, bold: true, color: OBSIDIAN })],
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Calibri", size: 22 })],
  });

const quote = text =>
  new Paragraph({
    spacing: { before: 100, after: 200 },
    indent: { left: 360 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 12 },
    },
    children: [new TextRun({ text, font: "Calibri", size: 24, italics: true, color: OBSIDIAN })],
  });

const stage = text =>
  new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: "STAGE DIRECTION  ", font: "Consolas", size: 18, bold: true, color: GOLD }),
      new TextRun({ text, font: "Calibri", size: 22, italics: true, color: MUTED }),
    ],
  });

const pageBreak = () =>
  new Paragraph({ children: [new PageBreak()] });

const divider = () =>
  new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 8 } },
    children: [new TextRun({ text: "" })],
  });

// Two-column table for term + meaning
const termTable = (rows) => {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2880, 6480],
    rows: [
      // header
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            borders,
            width: { size: 2880, type: WidthType.DXA },
            shading: { fill: "F7E8B5", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "Element", bold: true, font: "Calibri", size: 22 })] })],
          }),
          new TableCell({
            borders,
            width: { size: 6480, type: WidthType.DXA },
            shading: { fill: "F7E8B5", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "What to say", bold: true, font: "Calibri", size: 22 })] })],
          }),
        ],
      }),
      ...rows.map(([term, meaning]) =>
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 2880, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: term, font: "Calibri", size: 22, bold: true })] })],
            }),
            new TableCell({
              borders,
              width: { size: 6480, type: WidthType.DXA },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [new Paragraph({ children: [new TextRun({ text: meaning, font: "Calibri", size: 22 })] })],
            }),
          ],
        })
      ),
    ],
  });
};

// ─────────────────────────────────────────────────────────────────────
// Build content
// ─────────────────────────────────────────────────────────────────────
const children = [];

// COVER
children.push(
  new Paragraph({
    spacing: { before: 2400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "ATTACKED.AI", font: "Calibri", size: 28, bold: true, color: GOLD })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "Global Attack Map", font: "Calibri", size: 56, bold: true, color: OBSIDIAN })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ text: "Client Demo Script · Full Reading Guide", font: "Calibri", size: 28, italics: true, color: MUTED })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "Live demo:  https://attackedmap.vercel.app", font: "Calibri", size: 22, color: OBSIDIAN })],
  }),
  pageBreak(),
);

// CONTENTS
children.push(
  h1("Contents"),
  bullet("1.  60-Second Elevator Pitch"),
  bullet("2.  What is the Global Attack Map?"),
  bullet("3.  The Screen — Every Element Explained"),
  bullet("4.  The Detail Panel — When You Click a Pin"),
  bullet("5.  The Blast Radius — Six Rings of Exposure"),
  bullet("6.  Adaptive Controls — The GUARD Hierarchy"),
  bullet("7.  The Vendor Marketplace Card — Line by Line"),
  bullet("8.  Modes, Filters, and the Archive"),
  bullet("9.  Full Demo Walkthrough Script"),
  bullet("10. Q&A — What Clients Ask"),
  bullet("11. Demo Pro-Tips"),
  pageBreak(),
);

// 1. ELEVATOR PITCH
children.push(
  h1("1.  60-Second Elevator Pitch"),
  lead("Use this when you have one minute, in a hallway, an elevator, or before a slide deck loads."),
  quote(
    "Attacked.ai is a daily risk intelligence platform. Every morning we scan disclosed corporate incidents — bankruptcies, cyberattacks, outages, regulatory actions, geopolitical events — and we don't just report them. We map each one to the specific controls that failed, the entities exposed downstream, and the vendors who can fix it. " +
    "Think of it as the Bloomberg terminal for operational risk. Instead of a news feed, the board gets a daily map showing what broke, who else is in the blast radius, and a scored vendor shortlist they can act on today. " +
    "We're showing thirteen days of live data right now — pick any incident and you'll see the entire stack: the headline, the blast radius across six rings of exposure, the GUARD control hierarchy, and the vendor marketplace with AI-scored fit ratings. That's the product."
  ),
  pageBreak(),
);

// 2. WHAT IS IT
children.push(
  h1("2.  What is the Global Attack Map?"),
  lead("Open with this if the client asks 'what am I looking at?'"),
  h2("In one sentence"),
  p("It is the operational front-end of Attacked.ai — a world map where every pin is a real, disclosed corporate incident from the last two weeks, enriched with the control failures, the downstream exposure network, and the vendors who can close the gap."),
  h2("The problem it solves"),
  p("Boards and risk teams already drown in news feeds. None of those feeds answer the three questions that actually matter:"),
  bullet("Who else, that I care about, is exposed because of this incident?"),
  bullet("Which of my controls would have prevented or detected it?"),
  bullet("If I want to close the gap today, which vendor do I call — and is it actually a fit?"),
  p("The Global Attack Map answers all three on every incident, every day."),
  h2("The methodology behind it"),
  p("This is built on Attacked.ai's GUARD framework and the FDRI methodology — Filing-Derived Risk Intelligence. Every incident is sourced from primary disclosures (SEC filings, court documents, regulator statements, company press releases), scored against a 19-field data schema, mapped to a canonical risk taxonomy of thirteen categories, and rated for severity on a five-tier scale."),
  pageBreak(),
);

// 3. THE SCREEN
children.push(
  h1("3.  The Screen — Every Element Explained"),
  lead("Walk the client around the screen, top to bottom, left to right. This is the section to memorize."),

  h2("3.1  Top header bar"),
  termTable([
    ["Attacked.ai · attackmap.ai", "Brand mark and product surface — confirms this is the live attack map, not a sandbox or static deck."],
    ["VIEWING · 2026-05-23", "The date currently rendered on the map. Every pin you see is from this single day's sweep."],
    ["ARCHIVE 13", "Click to open the date picker. The number is how many days are loaded — in this demo, thirteen days from May 14 to May 28."],
    ["NEW FILE", "Admin upload — lets analysts drop a new daily sweep JSON. In the production version this is automated."],
  ]),

  h2("3.2  Category filter chips (top-left strip)"),
  p("Each chip is one of the thirteen GUARD risk categories. The number next to each chip is how many incidents in this day fall in that category. Click a chip to filter the map down to just that category."),
  termTable([
    ["CYB", "Cyber — breaches, ransomware, zero-days, account compromise."],
    ["DAT", "Data — disclosed data leaks, exposed databases, privacy incidents."],
    ["TEC", "Technology — outages, service availability, platform failures."],
    ["GEO", "Geopolitical — sanctions, state-level disruption, conflict-driven risk."],
    ["PHY", "Physical — fires, accidents, facility incidents, kinetic events."],
    ["OPS", "Operations — process breakdowns, business continuity events."],
    ["TPR", "Third-Party — vendor failures, supplier insolvency, contractor incidents."],
    ["REG", "Regulatory — enforcement actions, fines, new regulatory mandates."],
    ["FIN", "Financial — bankruptcies, defaults, accounting restatements, fraud."],
    ["STR", "Strategic — leadership exits, M&A breakdowns, strategic-pivot risk."],
    ["REP", "Reputation — brand crises, boycotts, public-trust collapse."],
    ["PPL", "People — workforce incidents, fatalities, mass exits, harassment."],
    ["ENV", "Environment — climate, contamination, ESG disclosure failures."],
  ]),
  p("'CRITICAL+' chip at the very left filters to severity 4 and 5 only — the incidents that need a same-day response."),

  h2("3.3  The map canvas"),
  termTable([
    ["Pin (dot)", "One incident, plotted to the affected entity's headquarters or the event location."],
    ["Pin size", "Severity. A 5 (critical) is the biggest; a 1 (minimal) is the smallest."],
    ["Pin colour", "Category — gold for cyber, orange for physical, green for operations, etc. The chip strip at the top uses the same palette."],
    ["Ring around pin", "When you hover or select, the ring expands to show the blast radius — the downstream entities exposed."],
    ["Arcs", "When BLAST is toggled on, arcs connect the incident to each entity in the blast radius. Solid = directly exposed; dashed = indirect."],
  ]),

  h2("3.4  Bottom control bar"),
  termTable([
    ["BUYER / NEWSROOM", "Two modes. BUYER hides analyst-facing chrome and shows the buyer-relevant fields. NEWSROOM adds the assigned analyst desk, vendor marketplace, and reporter attribution."],
    ["LABELS", "Toggles country and city labels on the map. Off by default so the pins breathe."],
    ["HEAT", "Toggles heat halos around dense incident clusters. Useful for showing concentration."],
    ["BLAST", "Toggles the blast-radius arcs. Critical demo moment — turn it on after you've picked an incident."],
  ]),

  h2("3.5  Right-side widgets"),
  termTable([
    ["LIVE · LAST 24H", "Live counter — how many incidents were classified in the last 24 hours."],
    ["incidents classified", "The number itself. Updates with each sweep."],
    ["ENDED [timestamp]", "When the most recent sweep finished. Confirms freshness."],
    ["+ / − / home / zoom", "Standard map controls. The home icon resets the view. Zoom slider on the bottom-right scales the map continuously."],
  ]),
  pageBreak(),
);

// 4. DETAIL PANEL
children.push(
  h1("4.  The Detail Panel — When You Click a Pin"),
  lead("This is where the product earns its keep. The panel slides in from the right and walks the user through the incident in 'scenes' or 'cascades' — one logical chapter at a time."),

  h2("4.1  Header strip"),
  termTable([
    ["INCIDENT · CLASSIFIED", "The tag confirms this incident has been scored and taxonomy-mapped — not raw news."],
    ["Headline", "The single-line story. Real, sourced, no summarisation."],
    ["Summary", "Two to three sentences of analyst prose. Specific numbers, named entities, dates — no fluff."],
    ["Severity chip (HIGH / CRITICAL / MEDIUM)", "Five-tier scale. Critical and High demand same-day attention."],
    ["Category chip (e.g. TPR)", "Same colour as the map pin — visual anchor."],
    ["VICTIM line", "The primary affected entity, sector, and country code."],
  ]),

  h2("4.2  The cascade — three scenes"),
  p("Below the header, the panel cycles through three scenes. The progress indicator at the bottom shows '01 / 03', '02 / 03', '03 / 03'. Arrows let you move forward and back."),

  h3("Scene 1 — Incident & Response"),
  p("The narrative scene. What happened, why severity is what it is, what the immediate response was. Often includes 'If you operate X, then Y' — a tailored operational callout."),

  h3("Scene 2 — Adaptive Controls"),
  p("The control scene. Shows GUARD's three-layer hierarchy: Control Objectives, Master Controls, Recommended Actions. This is what failed — and what to put in place."),

  h3("Scene 3 — Precedent & Vendors"),
  p("The action scene. Historical analogues on the right (has this pattern happened before, what was the outcome). Vendor Marketplace on the left (who can help, scored)."),
  pageBreak(),
);

// 5. BLAST RADIUS
children.push(
  h1("5.  The Blast Radius — Six Rings of Exposure"),
  lead("The single most differentiated feature in the product. Every incident comes with a blast radius — a network of downstream entities affected by the same root cause."),
  p("When the BLAST toggle is on, arcs appear from the incident pin to every entity in the blast radius. Each ring is colour-coded and lives in its own section of the detail panel:"),
  termTable([
    ["Internal", "Other departments, subsidiaries, or business units of the same parent entity that are exposed to the same root cause."],
    ["Supply Chain", "Vendors, suppliers, contractors who are exposed because they sell into the affected entity or depend on its operations."],
    ["Competitive Peer", "Other companies in the same sector facing the same systemic risk — even if they're not directly affected by this incident."],
    ["Regulatory", "Regulators or oversight bodies likely to take action, open inquiries, or issue guidance because of this incident."],
    ["Customer / Counterparty", "Downstream customers and trading counterparties exposed to disruption, default, or contractual harm."],
    ["Financial Market", "Investors, lenders, insurers, rating agencies — the financial counterparties whose positions move on this incident."],
  ]),
  p("Each entity in a ring has its own card: name, country, the reason it's exposed, an impact score, an impact rationale, the transmission mechanism, the impact horizon, and a recommended action."),
  quote("This is the difference between a news article and intelligence. The news tells you what happened. The blast radius tells you who else just got hit and what to do about it."),
  pageBreak(),
);

// 6. ADAPTIVE CONTROLS
children.push(
  h1("6.  Adaptive Controls — The GUARD Hierarchy"),
  lead("Scene 2 of every detail panel. This is the controls layer — how Attacked.ai turns a news event into a risk-register entry."),

  h2("Layer 1 — Control Objectives (CO)"),
  p("The 'what'. A plain-English statement of what the organisation must prevent or achieve. Identified by a CO-XXX-NNN code (CO-FIN-001, CO-TEC-001, etc.). Example: 'Prevent vendor receivable losses from customer insolvency.'"),

  h2("Layer 2 — Master Controls (MC)"),
  p("The 'how'. The implementation mechanism that achieves the objective. Identified by an MC-XXX-NNN code. Each Master Control points to one or more vendors that can deliver it. Example: 'Trade credit insurance with ongoing buyer monitoring.'"),

  h2("Layer 3 — Adaptive / Recommended Actions (AC)"),
  p("The 'do this now'. A specific operational step with an owner, a deadline, and an evidence requirement. Identified by an AC-XXX-NNN-NN code. Example: 'By September 30, 2026, the CFO must obtain written confirmation of trade credit cover for the top 20 customers, with policy limits documented in the credit register.'"),

  p("This three-layer structure means a client doesn't just see 'we should do something about this'. They see exactly what the objective is, exactly what control to put in place, and exactly what action to take this quarter. With named owner and evidence requirements."),

  h2("Where it comes from on the map"),
  p("For the May 23 incident (the merged-format sweep), these come from the file's control_hierarchy object. For all other days, they're embedded directly on each incident as adaptive_objectives, adaptive_master_controls, and adaptive_controls arrays."),
  pageBreak(),
);

// 7. VENDOR CARD
children.push(
  h1("7.  The Vendor Marketplace Card — Line by Line"),
  lead("Scene 3 of every detail panel for May 23, and where the demo lands the most concrete win. Each card is one vendor mapped to the incident's controls. Read each section out loud and explain it."),

  h2("Card header"),
  termTable([
    ["Vendor name (large)", "The named company. Real, verifiable, not a marketing persona."],
    ["+ EDITORIAL PICK badge (gold pill)", "An analyst-flagged vendor that's especially relevant for this incident. Not all vendors get this badge."],
    ["XX /100 score", "AI Verdict — how well this vendor's actual product capability maps to the controls this incident exposed. Higher is a better fit."],
    ["AI VERDICT label", "Labels the score below it. Reminds the reader the score is model-generated and source-grounded."],
  ]),

  h2("Product line"),
  p("Below the vendor name, the specific product or service that delivers the coverage — with a click-through link to the product page itself. We don't link to vendor homepages; we link to the page that proves the capability."),

  h2("What they do"),
  p("Two-to-three sentence operational description. Reads like an analyst wrote it, because an analyst did. No marketing language."),

  h2("Covers Controls section"),
  p("A row of gold-bordered chips with diamond bullets — each chip is one Master Control ID this vendor covers (e.g. MC-FIN-029, MC-FIN-030). This is the bridge between the vendor and the GUARD framework. Without this row, a vendor card is just a logo wall. With it, every vendor is mapped to a specific control."),

  h2("Mitigation Mechanism section"),
  p("A paragraph explaining the mechanism — how the vendor's product actually addresses the controls. Not features, mechanism. 'The policy indemnifies the vendor for the covered receivable balance, effectively functioning as the 100% reserve mechanism required by the control.'"),

  h2("Capability Claims section"),
  p("A bulleted list of evidence-grounded capability claims. Each claim has:"),
  bullet("The claim itself — a specific capability."),
  bullet("A control chip — which Master Control the claim addresses."),
  bullet("A 'source' link — direct link to the source page on the vendor's site where the claim is verified."),
  p("This is the integrity layer. If a client asks 'how do you know this vendor actually does this?' — click the source link and show them the live page."),

  h2("Score Rationale section"),
  p("Italic prose explaining why the AI Verdict is the number it is. Notes both the strengths ('directly maps to the exact harm vendors suffered') and the limits ('evidence stops at product descriptions rather than named case studies')."),
  pageBreak(),
);

// 8. MODES + ARCHIVE
children.push(
  h1("8.  Modes, Filters, and the Archive"),

  h2("Buyer mode vs Newsroom mode"),
  p("Two ways of looking at the same data."),
  bullet("BUYER — focuses on what a risk officer or board member needs: blast radius, controls, recommended actions, vendor marketplace. Quiet UI. Less editorial chrome."),
  bullet("NEWSROOM — adds the analyst desk that owns the story, surface reporter attribution, and expands the vendor marketplace section. Useful for showing how the intelligence is produced."),

  h2("Flat map vs Globe view"),
  p("Top-right toggle. Flat is the default — easier to read at a glance. Globe is the drag-to-rotate orthographic view; useful when the client wants to see global concentration or a specific region. Same data on both."),

  h2("Filters"),
  p("Two filter surfaces:"),
  bullet("Top-left CHIP STRIP — toggles individual categories. Click CYB to see only cyber. Click CYB and FIN to see both. Empty = all."),
  bullet("FILTER POPOVER (more button) — gives access to severity tier filters (5 down to 1), confidence filters (High / Medium), and the search box."),
  p("The search box is substring-matched against headline, entity, country, summary, sector, category, and vendor names. Type a name and watch the map filter live."),

  h2("Archive (date picker)"),
  p("Top-right ARCHIVE button opens the date picker. Each row shows the date, the incident count for that day, and a severity histogram (how many incidents at each severity tier). Click any date to render that day on the map."),
  p("In this demo, thirteen dates are loaded — May 14, 15, 16, 18, 19, 20, 21, 22, 23 (the rich-vendor day), 25, 26, 27, 28. Dates with no sweep are simply absent."),
  pageBreak(),
);

// 9. DEMO WALKTHROUGH
children.push(
  h1("9.  Full Demo Walkthrough Script"),
  lead("The exact sequence to run a 3-4 minute live demo. Stage directions are in gold."),
  h2("Step 1 — Hook (15 seconds)"),
  stage("Open https://attackedmap.vercel.app. Let the map render fully before speaking."),
  quote("What you're looking at is two weeks of global risk intelligence — every disclosed corporate incident across cyber, supply chain, financial, geopolitical, and physical risk, plotted to the entity that got hit. This isn't a headline feed. It's operational intelligence — what happened, who's exposed downstream, and what to do about it."),

  h2("Step 2 — The data surface (30 seconds)"),
  stage("Point to the top-right ARCHIVE 13 chip."),
  quote("Thirteen days of sweeps, May 14 through 28. Each day is a full pass across thirteen risk categories — cyber, data, technology, geopolitical, operations, third-party, regulatory, financial, strategic, reputational, people, environmental, physical."),
  stage("Click ARCHIVE → select 2026-05-23."),
  quote("Each pin is a real incident, geolocated to the affected entity. Pin size shows severity. Pin colour shows category. Hover over any pin to preview the headline."),
  stage("Hover one or two pins before moving on."),

  h2("Step 3 — One incident, full stack (90 seconds)"),
  stage("Click the Saks Global pin on the US east coast."),
  quote("Saks Global filed Chapter 11. Looks like a retail story. Watch what it actually is."),
  stage("Read the headline and the first two lines of the summary aloud."),
  quote("$1.2 billion in remaining debt. Hundreds of fashion vendors unpaid. Chanel owed $136 million. Kering $59 million. Capri $33 million."),
  stage("Click the BLAST toggle. Arcs appear from the Saks pin."),
  quote("This is the blast radius — not a list, a network. Every dot is a downstream entity exposed across six rings: internal operations, supply chain, competitive peers, regulators, customers, financial markets. One bankruptcy, six rings of exposure. That's the difference between a news article and intelligence."),
  stage("Switch BUYER to NEWSROOM at the bottom."),
  quote("Newsroom view adds the analyst desk that owns this story. Every category has a named reporter the buyer can talk to."),
  stage("Advance the cascade to Scene 2."),
  quote("This is GUARD's three-layer control hierarchy. Control Objective — protect vendor receivables from customer insolvency. Master Control — trade credit insurance plus ongoing buyer monitoring. Recommended Actions — concrete next steps with owner, evidence requirement, and deadline."),
  stage("Advance to Scene 3."),
  quote("And here is where it becomes actionable. Who can help. Allianz Trade — AI verdict 72 out of 100, covers controls MC-FIN-029 and MC-FIN-030, with the exact capability claim source-grounded to their product page, and a score rationale that explains why it's a fit. HighRadius — editorial pick, 67 out of 100, with their credit-management workflow mapped to the same controls. Real vendors, real coverage mapping, real source links. No vapor."),

  h2("Step 4 — Why it's different (30 seconds)"),
  quote("Three things no one else does. One — every incident is mapped to specific controls, not vague themes. Two — every control gets a vendor shortlist, AI-scored against the actual incident, with sources you can click. Three — it's daily. Your board doesn't need a quarterly report. They need to know today what broke and who's exposed."),

  h2("Step 5 — Quick feature tour (30 seconds)"),
  stage("Pick any two."),
  bullet("Globe toggle: 'Same data, drag to rotate. Useful when the board wants to see global concentration.'"),
  bullet("Search box: type a name. 'Type a vendor or country and the map filters live.'"),
  bullet("Category chips: click CYB then FIN. 'Filter to the categories your team owns.'"),
  bullet("Archive: 'Scroll back through every prior day. Compare yesterday to today.'"),

  h2("Step 6 — Close (15 seconds)"),
  quote("This is the public demo, running on two weeks of data. The production version updates every morning, plugs into your risk register, and routes alerts to the controls you actually own. Want to see your sector?"),
  pageBreak(),
);

// 10. Q&A
children.push(
  h1("10.  Q&A — What Clients Ask"),
  lead("Anticipated questions with crisp answers. Memorise the first line of each."),

  h3("Is this real data?"),
  p("Yes. Every incident is sourced from primary disclosures — SEC filings, court documents, regulator statements, official company press releases. Click any source link in the detail panel and the page will open in a new tab."),

  h3("How often does it update?"),
  p("The production version runs a daily sweep. This demo has thirteen days of historical data loaded so you can see the consistency across days. In production, every morning's sweep is the new day's map."),

  h3("Where does the data actually come from?"),
  p("Primary disclosures only. We don't ingest tweets, blogs, or aggregator feeds. Each incident is sourced from SEC filings (10-K, 10-Q, 8-K), court documents, regulator releases, and official company statements. This is the Filing-Derived Risk Intelligence — FDRI — methodology."),

  h3("What is the AI Verdict score?"),
  p("A zero-to-one-hundred score that measures how well a vendor's actual, documented capability maps to the controls this specific incident exposed. It is not a generic vendor rating. It's a per-incident, per-control fit score. Every score has a source-grounded rationale you can read."),

  h3("How do you pick which vendors appear?"),
  p("Two layers. First, every Master Control has a vendor coverage list maintained by our intelligence team. Second, our model scores each candidate vendor against the specific incident's controls and surfaces the best fits. Editorial picks are an additional layer where an analyst flags a particularly strong fit."),

  h3("Can we see our sector / our country / our portfolio?"),
  p("Yes. The production deployment can be filtered to any sector, country, or named entity portfolio. We can also overlay your risk register so each incident maps to the controls you already own."),

  h3("Is this a SaaS product or a service?"),
  p("Both surfaces exist. The map itself is a SaaS product. The advisory layer — bespoke briefings, integration with your risk register, custom watchlists — is a managed service. Most clients start with one and add the other."),

  h3("Pricing?"),
  p("It depends on the deployment surface and the watchlist scope. Tell us your sector and roughly how many entities you want covered, and we'll send a tailored proposal within a week."),

  h3("How is this different from a threat-intelligence feed?"),
  p("Threat intelligence tells you what to be afraid of. We tell you what's currently happening, who else is in the blast radius, what controls would have helped, and which vendor can close the gap. It is operational, not informational."),

  h3("Can I export this to a board pack?"),
  p("Yes. Every panel exports to PDF, every chart to PNG, every list to CSV. The production version also has a one-click 'board brief' that compiles the day's critical incidents into a single executive summary."),
  pageBreak(),
);

// 11. PRO TIPS
children.push(
  h1("11.  Demo Pro-Tips"),
  lead("Read these before every demo. They are the difference between a good demo and a closed one."),
  bullet("Don't read every field. Let the panel scroll while you point to the dense sections — the density itself is the pitch."),
  bullet("Hover before you click. The hover preview earns attention before the panel opens."),
  bullet("Use the globe view once for the 'wow' moment, then go straight back to flat. Flat is more readable."),
  bullet("Always end on a vendor card. It is the most concrete, most monetisable surface in the product."),
  bullet("If they ask 'is this real?' — open a source link live. Don't argue. Show."),
  bullet("If they go quiet, pick a pin in their sector. Make it personal."),
  bullet("Never apologise for a missing date or a skinny day. Say 'this is the public demo' and move on."),
  bullet("End every demo with one question: 'Want to see your sector?' That's the close. Don't ad-lib past it."),
  divider(),
  lead("End of script. Live link: https://attackedmap.vercel.app"),
);

// ─────────────────────────────────────────────────────────────────────
// Build document
// ─────────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: "Attacked.ai",
  title: "Global Attack Map — Client Demo Script",
  description: "Comprehensive reading script for client demos of the Attacked.ai Global Attack Map",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Calibri", color: OBSIDIAN },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: GOLD },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri", color: OBSIDIAN },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Attacked.ai · Global Attack Map · Client Demo Script", font: "Calibri", size: 18, color: MUTED })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", font: "Calibri", size: 18, color: MUTED }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: MUTED }),
              new TextRun({ text: "  ·  attackedmap.vercel.app", font: "Calibri", size: 18, color: MUTED }),
            ],
          })],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, "Attacked.ai Demo Script.docx");
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, "(" + buf.length + " bytes)");
});
