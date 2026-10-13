# YouTube 字幕翻译（独立版）

只干一件事：把 YouTube 字幕翻译成目标语言。不依赖任何第三方插件，脚本托管在自己的仓库。

## 文件

- `youtube-translate.js` — 翻译脚本本体
- `youtube-translator.boxjs.json` — BoxJs 订阅（改目标语言/双语开关）

## 安装（Egern，不装插件）

1. 在 GitHub 新建公开仓库 `youtube-translator`，把上面两个文件传上去。
2. 往 Egern 配置里加三行：

```
[MITM]
hostname = %APPEND% www.youtube.com, m.youtube.com

[Script]
http-response ^https://(www|m)\.youtube\.com/api/timedtext script-path=https://raw.githubusercontent.com/erleizi/youtube-translator/main/youtube-translate.js, requires-body=true, timeout=30, tag=YT-Translator
```

3. BoxJs 里添加订阅（改目标语言/双语显示，不用动脚本）：

```
https://raw.githubusercontent.com/erleizi/youtube-translator/main/youtube-translator.boxjs.json
```

## 配置

| 方式 | 目标语言 | 双语/仅译文 |
|---|---|---|
| BoxJs | `yt_translator_target`（默认 zh-CN） | `yt_translator_bilingual`（默认开） |
| 脚本 argument | `target_lang=zh-CN` | `bilingual=true/false` |

脚本 argument 优先级高于 BoxJs。BoxJs 里改完下次请求自动生效，不用重启。

## 行为说明

- 只翻译视频自带的字幕；没有字幕的视频变不出字幕。
- 请求里带 `tlang`（YouTube 自己已翻译）时直接放行，不二次翻译。
- 原字幕已是中文（或与目标语言相同）时直接放行。
- 翻译失败（接口被墙/限流/超时）时静默放行原文，不弹窗不报错。
- 翻译结果按视频+语言缓存，重看/回放不重复请求。

## 已知的单点

翻译调的是 Google 免费接口（`translate.googleapis.com`）。如果某天字幕突然不翻译了，
先查这个接口通不通（浏览器打开下面的链接，能返回 JSON 就是通的）：

```
https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=hello
```

不通=网络问题或该代理 IP 被 Google 限流（429），换个干净节点再试。接口本身挂了谁都翻不了，
跟脚本无关——这也是不装大而全插件的原因：出问题只用查这一个环节。
