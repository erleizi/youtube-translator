/**
 * YouTube 字幕翻译（独立版）
 *
 * 只干一件事：把 YouTube 字幕翻译成目标语言（默认简中双语）。
 * 不依赖任何第三方插件/模块，脚本托管在你自己的仓库。
 *
 * 用法（Egern / Loon / Surge 通用，经典脚本 API）：
 *   [MITM]
 *   hostname = %APPEND% www.youtube.com, m.youtube.com
 *
 *   [Script]
 *   http-response ^https://(www|m)\.youtube\.com/api/timedtext script-path=<本文件 raw 链接>, requires-body=true, timeout=30, tag=YT-Translator
 *
 * 配置（优先级从高到低）：
 *   1. 脚本 argument：target_lang=zh-CN&bilingual=true
 *   2. $persistentStore：yt_translator_target / yt_translator_bilingual（BoxJs 可改）
 *   3. 默认值：目标简中，双语显示
 *
 * 说明：
 * - 只翻译视频自带的字幕；没有字幕的视频变不出字幕。
 * - 请求里带 tlang（YouTube 自己已翻译）时直接放行，不二次翻译。
 * - 原字幕已是中文时直接放行。
 * - 翻译失败（接口被墙/限流/超时）时静默放行原文，不报错。
 */

const TRANSLATE_API = "https://translate.googleapis.com/translate_a/single";
const STORE_TARGET = "yt_translator_target";
const STORE_BILINGUAL = "yt_translator_bilingual";

const $ = {
  request: typeof $request !== "undefined" ? $request : {},
  response: typeof $response !== "undefined" ? $response : {},
  argument: typeof $argument !== "undefined" ? $argument : "",
  done: (o) => $done(o),
};

if (!$response || !$response.body) {
  $.done({});
} else {
  main().catch((e) => {
    console.log("[YT-Translator] " + e);
    $.done({});
  });
}

async function main() {
  const cfg = loadConfig();

  const reqUrl = $.request.url || "";
  const sourceLang = normalizeLang(queryParam(reqUrl, "lang"), "auto");
  const targetLang = normalizeLang(cfg.target, "zh-CN");

  // YouTube 自己已经翻译过的（带 tlang），不碰
  if (queryParam(reqUrl, "tlang")) {
    $.done({});
    return;
  }

  // 原文已是中文，或与目标语言相同，不翻
  if (/^zh(?:-|$)/i.test(sourceLang) || sameBaseLang(sourceLang, targetLang)) {
    $.done({});
    return;
  }

  let body = $.response.body;
  if (typeof body !== "string") body = String(body || "");
  if (!body) {
    $.done({});
    return;
  }

  // 命中缓存直接返回
  const cacheKey = cacheKeyFor(body, sourceLang, targetLang, cfg.bilingual, reqUrl);
  const cached = storeGet(cacheKey);
  if (cached) {
    $.done({ body: cached });
    return;
  }

  const headers = $.response.headers || {};
  const contentType = String(headers["Content-Type"] || headers["content-type"] || "").split(";")[0].toLowerCase();
  const fmt = (queryParam(reqUrl, "fmt") || queryParam(reqUrl, "format") || "").toLowerCase();
  const trimmed = body.trim();

  let out = "";
  if (contentType.indexOf("json") >= 0 || fmt.indexOf("json") >= 0 || trimmed.charAt(0) === "{") {
    out = await translateJson(body, sourceLang, targetLang, cfg.bilingual);
  } else if (contentType.indexOf("vtt") >= 0 || fmt.indexOf("vtt") >= 0 || /^WEBVTT/i.test(trimmed)) {
    out = await translateVtt(body, sourceLang, targetLang, cfg.bilingual);
  } else if (contentType.indexOf("xml") >= 0 || fmt === "srv3" || fmt === "ttml" || trimmed.charAt(0) === "<") {
    out = await translateXml(body, sourceLang, targetLang, cfg.bilingual);
  }

  // 翻译失败就放行原文
  if (!out) {
    $.done({});
    return;
  }

  storeSet(cacheKey, out);
  $.done({ body: out });
}

/* ---------------- 配置 ---------------- */

function loadConfig() {
  const args = parseArgument($.argument);
  let target = args.target_lang || args.target || storeGet(STORE_TARGET) || "zh-CN";
  let bilingualRaw = args.bilingual !== undefined ? args.bilingual : storeGet(STORE_BILINGUAL);
  return {
    target: String(target).trim() || "zh-CN",
    bilingual: toBool(bilingualRaw, true),
  };
}

function parseArgument(arg) {
  const result = {};
  if (!arg) return result;
  String(arg).split("&").forEach((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 0) return;
    const key = decodeURIComponent(pair.slice(0, eq).trim());
    const value = decodeURIComponent(pair.slice(eq + 1).trim());
    if (key) result[key] = value;
  });
  return result;
}

function toBool(v, fb) {
  if (v === undefined || v === null || v === "") return fb;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

/* ---------------- 语言 ---------------- */

function normalizeLang(value, fallback) {
  value = String(value || fallback || "").trim();
  if (!value || value.toLowerCase() === "und") return fallback || "auto";
  const lower = value.toLowerCase();
  if (lower === "zh" || lower === "zh-hans" || lower === "zh-cn") return "zh-CN";
  if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") return "zh-TW";
  return value;
}

function sameBaseLang(a, b) {
  a = String(a || "").toLowerCase().split(/[-_]/)[0];
  b = String(b || "").toLowerCase().split(/[-_]/)[0];
  return !!a && a !== "auto" && a === b;
}

function queryParam(url, name) {
  const query = String(url || "").split("#")[0].split("?")[1] || "";
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    const key = decode(eq >= 0 ? part.slice(0, eq) : part);
    if (key === name) return decode(eq >= 0 ? part.slice(eq + 1) : "");
  }
  return "";
}

function decode(v) {
  v = String(v == null ? "" : v).replace(/\+/g, " ");
  try {
    return decodeURIComponent(v);
  } catch (_) {
    return v;
  }
}

/* ---------------- 存储 ---------------- */

function storeGet(k) {
  try {
    return $persistentStore.read(k) || "";
  } catch (_) {
    return "";
  }
}

// 注意：$persistentStore.write(value, key)，值在前、键在后
function storeSet(k, v) {
  try {
    $persistentStore.write(String(v), k);
  } catch (_) {}
}

function hashText(value) {
  value = String(value == null ? "" : value);
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function cacheKeyFor(text, sl, tl, bilingual, url) {
  return (
    "yt_translator:body:" +
    (queryParam(url, "v") || "-") +
    ":" + (sl || "auto") +
    ":" + (tl || "zh-CN") +
    ":" + bilingual +
    ":" + text.length +
    ":" + hashText(text)
  );
}

/* ---------------- 文本处理 ---------------- */

function htmlDecode(value) {
  const entities = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&apos;": "'" };
  return String(value == null ? "" : value).replace(
    /(&(?:lt|gt|amp|apos|quot|#(?:\d{1,7}|x[0-9a-fA-F]{1,6}));)/g,
    (entity) => {
      if (entity.charAt(1) === "#") {
        const code = entity.charAt(2) === "x" ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
        if (code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) {
          return String.fromCodePoint(code);
        }
      }
      return entities[entity] || entity;
    }
  );
}

function htmlEncode(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanCueText(value) {
  return String(value == null ? "" : value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function combine(source, translated, bilingual, xmlMode) {
  translated = xmlMode
    ? String(translated == null ? "" : translated).replace(/\s+/g, " ").trim()
    : cleanCueText(translated);
  if (!translated) return source;
  source = String(source == null ? "" : source);
  if (!bilingual) return translated || source;
  return source ? source + "\n" + translated : translated;
}

/* ---------------- 翻译核心 ---------------- */

function googleText(data) {
  const out = [];
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (let i = 0; i < data[0].length; i++) {
      if (Array.isArray(data[0][i]) && data[0][i][0]) out.push(data[0][i][0]);
    }
  }
  return out.join("");
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      { url, headers: { Accept: "application/json", "Accept-Encoding": "identity" }, timeout: 10 },
      (err, resp, data) => {
        if (err) reject(err);
        else resolve({ status: resp.status, body: data });
      }
    );
  });
}

async function translateChunk(rows, sourceLang, targetLang, sep) {
  const url =
    TRANSLATE_API +
    "?client=gtx&dt=t" +
    "&sl=" + encodeURIComponent(sourceLang || "auto") +
    "&tl=" + encodeURIComponent(targetLang || "zh-CN") +
    "&q=" + encodeURIComponent(rows.join(sep));

  let res;
  try {
    res = await httpGet(url);
  } catch (_) {
    return null;
  }
  if ((res.status || 0) < 200 || (res.status || 0) >= 300 || !res.body) return null;

  let translated;
  try {
    translated = googleText(JSON.parse(res.body));
  } catch (_) {
    return null;
  }

  let parts = translated.split(/\r\n?|\n/);
  if (parts.length !== rows.length) {
    parts = rows.length === 1 ? [translated] : translated.split(/\n+/);
  }
  return rows.map((_, j) => (parts[j] || "").trim());
}

async function translateRows(rows, sourceLang, targetLang) {
  const out = new Array(rows.length);
  const sep = "\r";
  const sepCost = encodeURIComponent(sep).length;
  const maxChunks = 16;
  const maxEncoded = 14000;

  const costs = rows.map((r) => encodeURIComponent(String(r == null ? "" : r)).length);
  if (costs.some((c) => c > maxEncoded)) return null;

  const chunks = [];
  let current = [];
  let currentEncoded = 0;
  const pushChunk = () => {
    if (!current.length) return;
    chunks.push({ rows: current });
    current = [];
    currentEncoded = 0;
  };

  for (let ri = 0; ri < rows.length; ri++) {
    const cost = costs[ri] + (current.length ? sepCost : 0);
    if (current.length && currentEncoded + cost > maxEncoded) pushChunk();
    current.push(String(rows[ri] == null ? "" : rows[ri]));
    currentEncoded += costs[ri] + (current.length > 1 ? sepCost : 0);
  }
  pushChunk();
  if (chunks.length > maxChunks) return null;

  let offset = 0;
  for (const c of chunks) {
    c.offset = offset;
    offset += c.rows.length;
  }

  // 每次最多 4 个并发
  for (let ci = 0; ci < chunks.length; ci += 4) {
    const batch = chunks.slice(ci, ci + 4);
    const results = await Promise.all(batch.map((c) => translateChunk(c.rows, sourceLang, targetLang, sep)));
    for (let bi = 0; bi < results.length; bi++) {
      if (!results[bi]) return null;
      const chunk = batch[bi];
      for (let rj = 0; rj < chunk.rows.length; rj++) {
        out[chunk.offset + rj] = results[bi][rj] || "";
      }
    }
  }
  return out;
}

/* ---------------- 三种字幕格式 ---------------- */

async function translateJson(text, sl, tl, bilingual) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return "";
  }
  const slots = [];
  (data.events || []).forEach((event) => {
    const segs = Array.isArray(event && event.segs) ? event.segs : [];
    const source = segs.map((s) => (s && s.utf8 ? s.utf8 : "")).join("").trim();
    if (source) slots.push({ event, source });
  });
  if (!slots.length) return "";

  const translated = await translateRows(slots.map((i) => i.source), sl, tl);
  if (!translated) return "";

  slots.forEach((item, i) => {
    item.event.segs = [{ utf8: combine(item.source, translated[i], bilingual, false) }];
    delete item.event.wWinId;
  });
  return JSON.stringify(data);
}

async function translateVtt(text, sl, tl, bilingual) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/);
  const cueSlots = [];
  blocks.forEach((block, blockIndex) => {
    const lines = block.split("\n");
    let timeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("-->") >= 0) {
        timeIndex = i;
        break;
      }
    }
    if (timeIndex < 0) return;
    const cueText = cleanCueText(lines.slice(timeIndex + 1).join(" "));
    if (cueText) cueSlots.push({ blockIndex, lines, timeIndex, source: cueText });
  });
  if (!cueSlots.length) return "";

  const translated = await translateRows(cueSlots.map((i) => i.source), sl, tl);
  if (!translated) return "";

  cueSlots.forEach((item, i) => {
    item.lines.splice(
      item.timeIndex + 1,
      item.lines.length - item.timeIndex - 1,
      combine(item.source, translated[i], bilingual, false)
    );
    blocks[item.blockIndex] = item.lines.join("\n");
  });
  return blocks.join("\n\n");
}

async function translateXml(text, sl, tl, bilingual) {
  const re = /<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  const matches = [];
  let match;
  while ((match = re.exec(text))) {
    const cleanSource = htmlDecode(cleanCueText(match[3]));
    if (cleanSource) matches.push({ tag: match[1], attrs: match[2], source: cleanSource });
  }
  if (!matches.length) return "";

  const translated = await translateRows(matches.map((i) => i.source), sl, tl);
  if (!translated) return "";

  let idx = 0;
  return text.replace(re, (full, tag, attrs, body) => {
    const displaySource = htmlDecode(cleanCueText(body));
    if (!displaySource) return full;
    const translatedText = String(translated[idx++] || "").replace(/\s+/g, " ").trim();
    const newline = tag === "text" ? "&#10;" : "<br/>";
    return (
      "<" + tag + attrs + ">" +
      htmlEncode(combine(displaySource, translatedText, bilingual, true)).replace(/\n/g, newline) +
      "</" + tag + ">"
    );
  });
}
