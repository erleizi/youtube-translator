# YouTube 字幕翻译（独立版）

只干一件事：把 YouTube 字幕翻译成目标语言。不依赖任何第三方插件，脚本托管在自己的仓库。

## 文件

- `youtube-translator.yaml` — Egern 原生模块（推荐，粘一个 URL 即装好，设置页自带「目标语言」下拉和「双语显示」开关）
- `youtube-translate-v2.js` — v2 翻译脚本（Egern 原生 API：`export default main(ctx)`）
- `youtube-translator.sgmodule` — 旧版经典格式模块（已被 yaml 版取代，留着备用）
- `youtube-translate.js` — 旧版经典脚本（已被 v2 取代，留着备用）
- `youtube-translator.boxjs.json` — BoxJs 订阅（兼容保留）
- `README.md` — 本说明

## 安装（Egern）

Egern → 模块 → 添加 → 从 URL 导入，填：

```
https://raw.githubusercontent.com/erleizi/youtube-translator/main/youtube-translator.yaml
```

装好后在模块设置页里直接改「目标语言」和「双语显示」，改完即时生效。

> 如果之前装过旧版（youtube-translator.sgmodule），先删掉旧模块再装 yaml 版。

## 行为说明

- 只翻译视频自带的字幕；没有字幕的视频变不出字幕。
- 请求里带 `tlang`（YouTube 自己已翻译）时直接放行，不二次翻译。
- 原字幕已是中文（或与目标语言相同）时直接放行。
- 翻译失败（接口被墙 / 限流 / 超时）时静默放行原文，不弹窗不报错。
- 翻译结果按视频 + 语言缓存，重看 / 回放不重复请求。

## 已知的单点

翻译调的是 Google 免费接口（`translate.googleapis.com`）。如果某天字幕突然不翻译了，先查这个接口通不通（浏览器打开下面的链接，能返回 JSON 就是通的）：

```
https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=hello
```

不通 = 网络问题或该代理 IP 被 Google 限流（429），换个干净节点再试。接口本身挂了谁都翻不了，跟脚本无关——这也是不装大而全插件的原因：出问题只用查这一个环节。
