import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shouldPublish = process.argv.includes("--publish");

const rules = [
  {
    name: "MW Block declared AI and SEO crawlers",
    description: "Deny known AI training, AI answer, and bulk SEO crawler user agents.",
    active: true,
    conditionGroup: [
      {
        conditions: [
          {
            type: "user_agent",
            op: "re",
            value:
              "(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|anthropic-ai|Google-Extended|CCBot|PerplexityBot|Bytespider|Amazonbot|Applebot-Extended|facebookexternalhit|meta-externalagent|Diffbot|PetalBot|SemrushBot|AhrefsBot|MJ12bot|DotBot|DataForSeoBot|BLEXBot|serpstatbot|YandexBot|Baiduspider)",
          },
        ],
      },
    ],
    action: { mitigate: { action: "deny" } },
  },
  {
    name: "MW Challenge scraper tooling and direct data",
    description: "Challenge common scraping clients plus direct API/dataset pulls without browser fetch metadata.",
    active: true,
    conditionGroup: [
      {
        conditions: [
          {
            type: "user_agent",
            op: "re",
            value:
              "(curl|Wget|python-requests|aiohttp|httpx|Scrapy|Go-http-client|Java/|okhttp|PostmanRuntime|Insomnia|libwww-perl|node-fetch|undici|axios|HeadlessChrome|PhantomJS|Selenium|Playwright|Puppeteer)",
          },
        ],
      },
      {
        conditions: [
          { type: "path", op: "pre", value: "/assets/data/temples-thailand" },
          { type: "header", op: "ex", key: "sec-fetch-site", neg: true },
        ],
      },
      {
        conditions: [
          { type: "path", op: "pre", value: "/api/admin/" },
          { type: "header", op: "ex", key: "sec-fetch-site", neg: true },
        ],
      },
    ],
    action: { mitigate: { action: "challenge" } },
  },
  {
    name: "MW Rate limit public API surface",
    description: "Throttle repeated API probing while leaving normal browser usage unaffected.",
    active: true,
    conditionGroup: [{ conditions: [{ type: "path", op: "pre", value: "/api/" }] }],
    action: {
      mitigate: {
        action: "rate_limit",
        rateLimit: {
          algo: "fixed_window",
          window: 60,
          limit: 120,
          keys: ["ip"],
          action: "deny",
        },
      },
    },
  },
];

const existing = readExistingRuleNames();
let changed = false;

for (const rule of rules) {
  if (existing.has(rule.name)) {
    console.log(`Firewall rule already exists: ${rule.name}`);
    continue;
  }

  runVercel(["firewall", "rules", "add", "--cwd", rootDir, "--yes", "--json", JSON.stringify(rule)]);
  changed = true;
}

if (shouldPublish && changed) {
  runVercel(["firewall", "publish", "--cwd", rootDir, "--yes"]);
} else if (changed) {
  console.log("Firewall changes are staged. Run npm run security:firewall:publish to publish them.");
} else {
  console.log("No firewall rule changes needed.");
}

function readExistingRuleNames() {
  const output = runVercel(["firewall", "rules", "list", "--cwd", rootDir, "--json"], { stdio: "pipe" });
  const jsonStart = output.indexOf("{");
  if (jsonStart === -1) return new Set();
  const payload = JSON.parse(output.slice(jsonStart));
  return new Set((payload.rules || []).map((rule) => rule.name).filter(Boolean));
}

function runVercel(args, options = {}) {
  return execFileSync("vercel", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.stdio || "inherit",
  });
}
