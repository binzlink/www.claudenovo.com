import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SITE = "https://www.claudenovo.com";

const CATEGORY_ORDER = [
  "social",
  "messaging",
  "search_tech",
  "ecommerce",
  "streaming",
  "news",
  "finance",
  "productivity",
  "travel",
  "ai_dev",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function filenameFor(code) {
  if (code === "en") return "index.html";
  return `${code.toLowerCase()}.html`;
}

function urlFor(code) {
  if (code === "en") return `${SITE}/`;
  return `${SITE}/${filenameFor(code)}`;
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return vars[key];
  });
}

function buildCategoriesHtml(sites, locale) {
  return sites
    .slice()
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id))
    .map((category) => {
      const title = locale.categories[category.id];
      if (!title) {
        throw new Error(`Missing category "${category.id}" in locale ${locale.code}`);
      }
      const links = category.links
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(link.name)}</a></li>`,
        )
        .join("\n                    ");
      return `            <div class="footer-cat">
                <h3>${escapeHtml(title)}</h3>
                <ul>
                    ${links}
                </ul>
            </div>`;
    })
    .join("\n\n");
}

function buildHreflangLinks(locales) {
  const lines = locales.map(
    (locale) =>
      `    <link rel="alternate" hreflang="${escapeHtml(locale.hreflang)}" href="${escapeHtml(urlFor(locale.code))}">`,
  );
  lines.push(
    `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(urlFor("en"))}">`,
  );
  return lines.join("\n");
}

function buildLanguageLinks(locales, currentCode) {
  return locales
    .map((locale) => {
      const href = locale.code === "en" ? "/" : `/${filenameFor(locale.code)}`;
      const current =
        locale.code === currentCode ? ' aria-current="page"' : "";
      return `<li><a href="${href}"${current} hreflang="${escapeHtml(locale.hreflang)}">${escapeHtml(locale.name)}</a></li>`;
    })
    .join("\n                ");
}

function buildSitemap(locales) {
  const urls = locales
    .map((locale) => {
      const loc = urlFor(locale.code);
      return `  <url>
    <loc>${escapeHtml(loc)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${locale.code === "en" ? "1.0" : "0.8"}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function main() {
  const template = fs.readFileSync(path.join(root, "templates", "page.html"), "utf8");
  const sites = JSON.parse(fs.readFileSync(path.join(root, "data", "sites.json"), "utf8"));
  const localeDir = path.join(root, "locales");
  const localeFiles = fs
    .readdirSync(localeDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const locales = localeFiles.map((file) => {
    const locale = JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
    if (!locale.code) {
      throw new Error(`Locale file ${file} is missing "code"`);
    }
    return locale;
  });

  locales.sort((a, b) => {
    if (a.code === "en") return -1;
    if (b.code === "en") return 1;
    return a.code.localeCompare(b.code);
  });

  const hreflangLinks = buildHreflangLinks(locales);
  const generatedFiles = [];

  for (const locale of locales) {
    const html = render(template, {
      lang: escapeHtml(locale.lang),
      dir: escapeHtml(locale.dir || "ltr"),
      title: escapeHtml(locale.title),
      description: escapeHtml(locale.description),
      keywords: escapeHtml(locale.keywords),
      canonical: escapeHtml(urlFor(locale.code)),
      hreflang_links: hreflangLinks,
      footer_heading: escapeHtml(locale.footer_heading),
      footer_intro: escapeHtml(locale.footer_intro),
      footer_nav_label: escapeHtml(locale.footer_nav_label),
      footer_tagline: escapeHtml(locale.footer_tagline),
      languages_label: escapeHtml(locale.languages_label),
      footer_categories: buildCategoriesHtml(sites, locale),
      language_links: buildLanguageLinks(locales, locale.code),
    });

    const outName = filenameFor(locale.code);
    const outPath = path.join(root, outName);
    fs.writeFileSync(outPath, html, "utf8");
    generatedFiles.push(outName);
    console.log(`Wrote ${outName}`);
  }

  fs.writeFileSync(path.join(root, "sitemap.xml"), buildSitemap(locales), "utf8");
  console.log("Wrote sitemap.xml");

  fs.writeFileSync(
    path.join(root, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
    "utf8",
  );
  console.log("Wrote robots.txt");
  console.log(`Built ${generatedFiles.length} pages.`);
}

main();
