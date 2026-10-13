# YouTube 字幕翻译（独立版）

只干一件事：把 YouTube 字幕翻译成目标语言。不依赖任何第三方插件，脚本托管在自己的仓库。

## 原理（v3）

拦截字幕请求（`timedtext`），给 URL 加上 `tlang` 参数，让 **YouTube 服务器**直接返回翻译好的字幕。这是 YouTube 官方的自动翻译机制（跟在网页端字幕设置里选"自动翻译"一个原理），DualSubs 等成熟方案也是这么做的。

- 类型是 `http-request`：只改请求 URL，不碰响应体，不调外部翻译接口，不会被限流。
- 代价：只有译文，没有双语（YouTube 服务器只返回翻译结果）。

## 文件

- `youtube-translator.yaml` — Egern 原生模块（推荐，粘一个 URL 即装好，设置页自带「目标语言」下拉）
- `youtube-translate-v3.js` — v3 脚本（Egern 原生 API：`export default main(ctx)`，http-request）
- `youtube-translate-v2.js` / `youtube-translate.js` — 旧版（http-response 改响应体，在 Egern 里跑不通，留着备用）
- `youtube-translator.sgmodule` — 旧版经典格式模块（留着备用）
- `youtube-translator.boxjs.json` — BoxJs 订阅（兼容保留）
- `README.md` — 本说明

## 安装（Egern）

Egern → 模块 → 添加 → 从 URL 导入，填：

```
https://raw.githubusercontent.com/erleizi/youtube-translator/main/youtube-translator.yaml
```

装好后在模块设置页里改「目标语言」，改完下次播放即时生效。

> 如果之前装过旧版，先删掉旧模块再装新版。

## 行为说明

- 只翻译视频自带的字幕；没有字幕的视频变不出字幕。
- 请求里已有 `tlang`（用户手动选了 YouTube 自带的翻译）时不碰。
- 原字幕已是中文（或与目标语言相同）时不加 tlang。
- 出异常也不影响原请求，静默放行。

## 排查

如果装完没翻译，按顺序查：

1. Egern → 模块，确认 🌐 YouTube 字幕翻译 是启用状态。
2. 播放视频时去「分析」里搜 `timedtext`，点进去看「请求修改器」有没有 🌐 字幕翻译。
   - 没有 = 脚本没跑起来（match 没命中或模块没生效），截图发我。
   - 有但字幕还是英文 = tlang 没生效，把那条请求的完整 URL 发我。
