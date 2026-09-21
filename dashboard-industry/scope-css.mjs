// scope-css.mjs — lift the prototype's <style> out of template.html and scope
// every selector under `.dash` so it can ship inside the React app without
// touching the map, the landing page or the admin screens.
//   node dashboard-industry/scope-css.mjs  → src/dashboard/dashboard.css
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(resolve(HERE, "template.html"), "utf8");
// Strip comments first: a comment containing a comma would otherwise be read
// as part of the next selector list.
const css = tpl.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, "");

// Minimal brace-aware walker: rules at depth 0, @media blocks recursed.
function scope(block) {
  let out = "", i = 0;
  while (i < block.length) {
    const open = block.indexOf("{", i);
    if (open < 0) { out += block.slice(i); break; }
    const selector = block.slice(i, open).trim();
    // find matching close brace
    let depth = 1, j = open + 1;
    while (j < block.length && depth) { if (block[j] === "{") depth++; else if (block[j] === "}") depth--; j++; }
    const body = block.slice(open + 1, j - 1);
    if (!selector) { i = j; continue; }
    if (selector.startsWith("@media")) {
      out += `${selector}{${scope(body)}}\n`;
    } else if (selector.startsWith("@")) {
      out += `${selector}{${body}}\n`;              // @keyframes etc — leave alone
    } else {
      const scoped = selector.split(",").map((s) => {
        s = s.trim();
        if (s === ":root") return ".dash";
        if (s === "html,body" || s === "html" || s === "body") return ".dash";
        if (s === "*") return ".dash *";
        if (s.startsWith(".dash")) return s;
        return `.dash ${s}`;
      }).join(",");
      out += `${scoped}{${body}}\n`;
    }
    i = j;
  }
  return out;
}

let scoped = scope(css)
  // the prototype sized html/body to 100%; inside the app the dashboard is a
  // normal block that fills the viewport width and grows with content.
  .replace(".dash{height:100%}\n", "")
  .replace(/\.dash\{margin:0;font-family/, ".dash{margin:0;min-height:100vh;font-family");
const header = `/* dashboard.css — generated from dashboard-industry/template.html by
   dashboard-industry/scope-css.mjs. Every selector is scoped under .dash.
   Edit the template and re-run the script rather than editing this file. */\n`;
writeFileSync(resolve(HERE, "../src/dashboard/dashboard.css"), header + scoped);
console.log(`wrote src/dashboard/dashboard.css (${(scoped.length / 1024).toFixed(0)} KB)`);
