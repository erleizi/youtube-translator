/**
 * YouTube 字幕翻译 v3（tlang 版）
 *
 * 原理：拦截字幕请求，给 URL 加上 tlang 参数，让 YouTube 服务器直接返回翻译好的字幕。
 * 这是 YouTube 官方的自动翻译机制（跟在网页端字幕设置里选"自动翻译"一个原理），
 * DualSubs 等成熟方案也是这么做的。
 *
 * 类型: http-request（只改请求 URL，不碰响应体）
 * 优点：不依赖外部翻译 API，不会被限流；脚本逻辑极简，不容易坏。
 * 代价：只有译文，没有双语（YouTube 服务器只返回翻译结果）。
 *
 * 配合 youtube-translator.yaml 使用，目标语言在模块设置页的「目标语言」下拉里改。
 */

export default async function main(ctx) {
  try {
    const env = (ctx && ctx.env) || {};
    const targetLang = normalizeLang(env.TARGET_LANG || "zh-CN", "zh-CN");

    const req = (ctx && ctx.request) || {};
    let url = req.url || "";
    if (!url) {
      try {
        if (typeof $request !== "undefined" && $request) url = $request.url || "";
      } catch (_) {}
    }
    if (!url) return;

    // 已经有 tlang（用户手动选了 YouTube 自带的翻译），不碰
    if (/[?&]tlang=/.test(url)) return;

    const lang = getParam(url, "lang") || "auto";
    const normLang = normalizeLang(lang, "auto");

    // 原文已是中文，不翻
    if (/^zh(?:-|$)/i.test(normLang)) return;
    // 与目标语言相同，不翻
    if (normLang !== "auto" && baseLang(normLang) === baseLang(targetLang)) return;

    // 加上 tlang，让 YouTube 服务器翻译
    const sep = url.indexOf("?") >= 0 ? "&" : "?";
    const newUrl = url + sep + "tlang=" + encodeURIComponent(targetLang);

    log(ctx, "[字幕翻译] " + normLang + " → " + targetLang);

    // 双通道写回：改 ctx.request.url，也改经典 $request.url，最后再 return
    try {
      if (ctx && ctx.request) ctx.request.url = newUrl;
    } catch (_) {}
    try {
      if (typeof $request !== "undefined" && $request) $request.url = newUrl;
    } catch (_) {}
    return { url: newUrl };
  } catch (_) {
    return; // 出异常也不影响原请求
  }
}

/* ---------------- 基础 ---------------- */

function log(ctx, msg) {
  try {
    if (ctx && typeof ctx.log === "function") ctx.log(msg);
  } catch (_) {}
}

function normalizeLang(value, fallback) {
  value = String(value || fallback || "").trim().replace(/_/g, "-");
  if (!value || value.toLowerCase() === "und") return fallback || "auto";
  const lower = value.toLowerCase();
  if (lower === "zh" || lower === "zh-hans" || lower === "zh-cn") return "zh-CN";
  if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") return "zh-TW";
  return value;
}

function baseLang(lang) {
  return String(lang || "").toLowerCase().split(/[-_]/)[0];
}

function getParam(url, name) {
  const query = String(url || "").split("#")[0].split("?")[1] || "";
  for (const part of query.split("&")) {
    const eq = part.indexOf("=");
    const key = eq >= 0 ? part.slice(0, eq) : part;
    if (decodeParam(key) === name) {
      return decodeParam(eq >= 0 ? part.slice(eq + 1) : "");
    }
  }
  return "";
}

function decodeParam(v) {
  v = String(v == null ? "" : v).replace(/\+/g, " ");
  try {
    return decodeURIComponent(v);
  } catch (_) {
    return v;
  }
}
