const puppeteer = require("puppeteer-core");
(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new", args: ["--no-sandbox", "--window-size=1440,2000"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto("http://localhost:4173/?preview=free", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(r => setTimeout(r, 12000));  // wait for Supabase fetch + render
  const stats = await page.evaluate(() => ({
    paths: document.querySelectorAll("svg path").length,
    circles: document.querySelectorAll("svg circle").length,
    awaiting: !!document.body.textContent.match(/loading latest|awaiting/i),
    upload: !!document.body.textContent.match(/drop a daily|select file/i),
  }));
  console.log("STATS", JSON.stringify(stats));
  await page.screenshot({ path: "C:/Users/mohin/OneDrive/Documents/Desktop/ATTACKEDMAP/map_data.png", fullPage: false });
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
