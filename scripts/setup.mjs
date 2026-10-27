// Kurulum sihirbazı: eksik ayarları sorar, her birini dener, .env.local'a yazar ve tabloları kurar.
//   npm run setup            eksik olanları sorar (hepsi tamamsa hemen çıkar)
//   npm run setup -- --reset hepsini baştan sorar
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import pg from "pg";

const ENV_FILE = ".env.local";
const TEMPLATE = ".env.example";
const reset = process.argv.includes("--reset");
const { stdin, stdout } = process;

const c = { gold: (s) => `\x1b[33m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
const isSnowflake = (v) => /^\d{17,20}$/.test(v);

function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

function writeEnv(values) {
  const quote = (v) => (/[\s#"]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);
  const lines = readFileSync(TEMPLATE, "utf8")
    .replace("# Copy to .env.local", "# Local settings (never committed). Created by npm run setup from .env.example")
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^([A-Z0-9_]+)=/);
      return m ? `${m[1]}=${quote(values[m[1]] ?? "")}` : line;
    });
  writeFileSync(ENV_FILE, lines.join("\n"));
}

async function ask(question, fallback = "") {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question}${fallback ? c.dim(` [${fallback}]`) : ""}: `)).trim();
  rl.close();
  return answer || fallback;
}

// Typed characters show as *; pasting works.
function askHidden(question) {
  if (!stdin.isTTY) return ask(question);
  return new Promise((resolve) => {
    stdout.write(`${question}: `);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value.trim());
        }
        if (ch === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function discord(path, botToken) {
  try {
    const res = await fetch(`https://discord.com/api/v10${path}`, { headers: { Authorization: `Bot ${botToken}` } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function testDatabase(url) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return null;
  } catch (err) {
    return err.message;
  } finally {
    await client.end().catch(() => {});
  }
}

// Each step: explain where to find it, ask, check. Returns the accepted value ("" when skipped).
const STEPS = [
  {
    key: "DATABASE_URL",
    title: "Veritabanı adresi (Postgres)",
    help: "neon.tech'te ücretsiz proje aç (veya Vercel → Storage → Neon) → Connection string → 'Pooled connection' adresini kopyala.",
    hidden: true,
    async check(v) {
      if (!/^postgres(ql)?:\/\//.test(v)) return "postgresql:// ile başlamalı.";
      stdout.write(c.dim("  Bağlanılıyor… "));
      const err = await testDatabase(v);
      stdout.write(err ? c.red("olmadı\n") : c.green("bağlandı ✓\n"));
      return err ? `Bağlanılamadı: ${err}` : null;
    },
  },
  {
    key: "DISCORD_CLIENT_ID",
    title: "Discord uygulamasının Client ID'si",
    help: "discord.com/developers/applications → uygulaman (yoksa New Application) → OAuth2 → Client ID.",
    check: (v) => (isSnowflake(v) ? null : "17–20 haneli bir sayı olmalı."),
  },
  {
    key: "DISCORD_CLIENT_SECRET",
    title: "Discord uygulamasının Client Secret'ı",
    help: "Aynı sayfa → OAuth2 → Client Secret → Reset Secret → kopyala.",
    hidden: true,
    check: (v) => (v.length >= 20 ? null : "Çok kısa; Client Secret'ı tam kopyaladığından emin ol."),
  },
  {
    key: "DISCORD_BOT_TOKEN",
    title: "Bot token'ı (rollere göre yetki için)",
    help: "Uygulaman → Bot → Reset Token → kopyala. Boş bırakırsan rollere göre yetki çalışmaz (lisans ve ID yetkisi çalışır).",
    hidden: true,
    optional: true,
    async check(v) {
      const me = await discord("/users/@me", v);
      if (!me) return "Discord bu token'ı kabul etmedi.";
      console.log(c.green(`  Bot: ${me.username} ✓`));
      return null;
    },
  },
  {
    key: "DISCORD_GUILD_ID",
    title: "Discord sunucu ID'si",
    help: "Discord → Ayarlar → Gelişmiş → Geliştirici Modu'nu aç → sunucuna sağ tık → Sunucu ID'sini Kopyala.",
    optional: true,
    async check(v, values) {
      if (!isSnowflake(v)) return "17–20 haneli bir sayı olmalı.";
      if (!values.DISCORD_BOT_TOKEN) return null;
      const guild = await discord(`/guilds/${v}`, values.DISCORD_BOT_TOKEN);
      if (guild) console.log(c.green(`  Sunucu: ${guild.name} ✓`));
      else console.log(c.gold("  Bot bu sunucuyu göremiyor. Botu sunucuya davet ettiğinden emin ol (link aşağıda)."));
      return null;
    },
  },
  {
    key: "BETTER_AUTH_URL",
    title: "Sitenin adresi",
    help: "Bilgisayarında çalıştırırken http://localhost:3000 kalsın.",
    fallback: "http://localhost:3000",
    check: (v) => (/^https?:\/\/[^/]+$/.test(v) ? null : "http(s)://alanadi biçiminde olmalı, sonda / olmadan."),
  },
];

async function main() {
  const values = readEnv(ENV_FILE);
  const missing = STEPS.filter((s) => !s.optional && !values[s.key]);
  if (!reset && missing.length === 0) {
    console.log(c.green("✓ Kurulum tamam.") + c.dim(" (Ayarları değiştirmek için: npm run setup -- --reset)"));
    return;
  }
  if (!stdin.isTTY) {
    console.log(c.red(`Eksik ayarlar: ${missing.map((s) => s.key).join(", ")}. Terminalde "npm run setup" çalıştır.`));
    process.exit(1);
  }

  console.log(`\n${c.bold(c.gold("  Kurulum Sihirbazı"))}\n${c.dim("  Site için gereken bilgileri soracağım. Ctrl+C ile çıkabilirsin.")}\n`);

  for (const step of STEPS) {
    if (!reset && values[step.key]) {
      console.log(`${c.green("✓")} ${step.title} ${c.dim("(zaten ayarlı)")}`);
      continue;
    }
    console.log(`\n${c.bold(step.title)}${step.optional ? c.dim(" (isteğe bağlı, Enter ile geç)") : ""}\n${c.dim(`  ${step.help}`)}`);
    for (;;) {
      const fallback = step.fallback ?? (reset && !step.hidden ? values[step.key] : "");
      const input = step.hidden ? await askHidden("  > ") : await ask("  >", fallback);
      const value = input || (reset ? (values[step.key] ?? "") : "");
      if (!value) {
        if (step.optional) break;
        console.log(c.red("  Bu bilgi gerekli."));
        continue;
      }
      const error = await step.check(value, values);
      if (!error) {
        values[step.key] = value;
        break;
      }
      console.log(c.red(`  ${error}`));
    }
  }

  // Secrets nobody needs to type.
  values.BETTER_AUTH_SECRET ||= randomBytes(32).toString("base64");
  values.BOT_API_SECRET ||= randomBytes(32).toString("hex");
  writeEnv(values);
  console.log(`\n${c.green("✓")} Ayarlar ${ENV_FILE} dosyasına kaydedildi.`);

  console.log(c.dim("\nTablolar kuruluyor…"));
  const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit", env: { ...process.env, ...values } });
  if (migrate.status !== 0) {
    console.log(c.red("Tablolar kurulamadı. Veritabanı adresini kontrol edip tekrar dene: npm run setup -- --reset"));
    process.exit(1);
  }

  const redirect = `${values.BETTER_AUTH_URL}/api/auth/callback/discord`;
  console.log(`
${c.bold(c.gold("  Son iki adım (Discord Developer Portal'da):"))}
  1. OAuth2 → Redirects → şu adresi ekle ve kaydet:
     ${c.bold(redirect)}
  2. Botu sunucuna davet et:
     ${c.bold(`https://discord.com/oauth2/authorize?client_id=${values.DISCORD_CLIENT_ID}&scope=bot`)}

  Vercel'de yayınlarken aynı değişkenleri Project → Settings → Environment Variables'a ekle
  (BETTER_AUTH_URL = sitenin adresi) ve redirect adresini o alan adıyla da ekle.
`);
}

main().catch((err) => {
  console.error(c.red(`Kurulum hatası: ${err.message}`));
  process.exit(1);
});
