# Gemini 4 Carbon 实测：提示词和模型写的代码

这是亚里频道第 23 期视频「Gemini 4 Carbon 实测」用到的全部提示词，和模型交出来的代码。

每个文件夹是一道题：`PROMPT.md` 是发给模型的原话（一字没改）和它每一轮干了多久，其余是它写的文件。想自己跑一遍对比别的模型，直接拿提示词去用就行。

## 测试条件

- 工具：Google Antigravity
- 模型：Gemini 4 Carbon，High 档，Turbo 模式；**例外：`01_gta6` 和 `05_minecraft-sunset` 是用上一代 Gemini 4 Argon（High）跑的**（按 Antigravity 会话记录核对过），Carbon 做的同一题是 `01b` 和 `05b`。视频里也都标了「上一代 · Gemini 4 Argon」。
- 时间：2026 年 11 月 9 日到 11 日
- 每个会话只跑一次，做成什么样就是什么样，没有挑结果。`01b`、`05b` 是换成 Carbon、另开新会话重做的那一次。

## 项目

| 文件夹 | 题目 | 提示词类型 | 模型干了多久 | 怎么运行 |
|---|---|---|---|---|
| [`01_gta6`](01_gta6/) | GTA 6（**Gemini 4 Argon**） | 一句话 | 20 分 | `npm install` → `npm run dev` |
| [`01b_gta6_second-try`](01b_gta6_second-try/) | GTA 6，第二次（Carbon） | 一句话（多加了一句要求） | 34 分 | `npm install` → `npm run dev` |
| [`02_cs2-dust2`](02_cs2-dust2/) | CS · Dust2 | 一句话 | 36 分 | `npm install` → `npm run dev` |
| [`03_self-intro-15s`](03_self-intro-15s/) | 15 秒自我介绍动画 | 一句话 | 43 分 | Python 脚本，见文件夹里的 README |
| [`04_antigravity-promo_v1`](04_antigravity-promo_v1/) | 反重力宣传片，第一版 | 一句话（模型自己用了 opuscar 风格库） | 2 轮，约 45 分 | 要装 opuscar，`sh build.sh` |
| [`04b_antigravity-promo_apple`](04b_antigravity-promo_apple/) | 反重力宣传片，苹果风 | 在上一版后面追加两句限定 | 2 轮，约 56 分 | 要装 opuscar 并补官方素材，`sh build.sh` |
| [`05_minecraft-sunset`](05_minecraft-sunset/) | Minecraft 永恒日落（**Gemini 4 Argon**） | 详细要求（后面追问了 5 次） | 6 轮，约 2 小时 18 分 | `npm install` → `npm run dev` |
| [`05b_minecraft-sunset_rerun`](05b_minecraft-sunset_rerun/) | Minecraft 永恒日落，重跑（Carbon） | 详细要求 | 32 分 | `npm install` → `npx vite --port 5188` |
| [`06_course-selection`](06_course-selection/) | 老教务选课系统重设计 | 详细要求 | 22 分 | 浏览器打开 html |
| [`07_tcg-holo-viewer`](07_tcg-holo-viewer/) | 全息镭射卡牌开包器 | 详细要求 | 48 分 | 浏览器打开 html |
| [`08_mini-video-editor`](08_mini-video-editor/) | 迷你多轨剪辑器 | 详细要求 | 1 小时 13 分 | 浏览器打开 html |
| [`10_aether-pro`](10_aether-pro/) | AETHER Pro 耳机官网 | 详细要求 | 1 小时 49 分 | 浏览器打开 html（要联网） |
| [`11_rabies-briefing`](11_rabies-briefing/) | 狂犬病科普视频 | Skill 长任务（opuscar） | 2 轮，约 1 小时 33 分 | 要装 opuscar、配 `GEMINI_API_KEY`、补素材，`sh build.sh` |
| [`12_mosheng`](12_mosheng/) | 墨生 | 看视频复刻 | 约 42 分 | 浏览器打开 `index.html`（要联网） |
| [`13_paper-files-india-city`](13_paper-files-india-city/) | Every Indian could stand inside one city | 看视频复刻 | 2 轮，约 1 小时 10 分 | 要装 opuscar 并补地图素材，`sh build.sh` |

用时是 Antigravity 界面上每一轮显示的「Worked for」，多轮的是加起来的；12、13 两个是按会话记录里的时间戳算的。

编号 09（拍立得相机 + 软木照片墙）没有成品文件，所以这里没有它。

## 仓库里有什么、没有什么

有：模型写的源码和文本（html、js、ts、css、py、sh、json、md、字幕、出处清单）。

没有：

- `node_modules`、`dist`、Python 环境、模型权重、缓存；
- 渲染出来的成片、音频、静帧和中间文件；单个超过 1 MB 的文件一律没放；
- 别人的东西：照着复刻的原视频、Google 的新闻资料包和官方产品截图、卫星影像和地图数据、从网上下载的照片、字体文件。

每个项目少了哪些文件、怎么重新生成或者去哪拿，写在各自的 README 里。各项目的 `CREDITS` 是模型自己写的素材出处清单，原样保留。

为了公开，代码里的本机路径和读密钥的方式改过（每个项目的 README 里列了改的是哪几处），其余是模型原样输出。三个游戏（01、02、05）原来共用一份配置，这里各自补了一份 `package.json` 和 `vite.config.js`，好单独运行。

这些代码是模型一次跑出来的测试结果，有 bug 是正常的，没有人维护。

## 致谢和出处

**opuscar（Lemo-Opuscar）**
`11_rabies-briefing` 和两支宣传片（`04`、`04b`）是用开源的视频风格库 opuscar 做的，`13` 也用了它的渲染和配音工具。

- 作者：Lemomo（LemoLab），[@lemomo_ai](https://x.com/lemomo_ai)
- 仓库：https://github.com/lemomo-ai/lemo-opuscar
- 许可：代码和文档 MIT（Copyright (c) 2026 LemoLab）；库里的样片视频和静帧是 CC BY 4.0（这个仓库没有放它的样片）

`11_rabies-briefing` 里有一部分文件基本是 opuscar 样片的原代码，清单和 MIT 许可证全文见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

**12_mosheng 的原作**
照着 X 上歸藏（[@op7418](https://x.com/op7418)）的一条视频复刻的，原帖：https://x.com/op7418/status/2120085300185833878 。据他的帖子，原作是用 Claude Fable 5.2 做的。这里只有 Carbon 的复刻代码，不含原视频。

**13_paper-files-india-city 的原作**
复刻的是 YouTube Shorts「Every Indian could stand inside one city」：https://www.youtube.com/shorts/5-7YkSe1Rwc ，原作者是 YouTube 频道 Paper Files。这里只有 Carbon 的复刻代码，不含原视频。

**商标**
Grand Theft Auto（Rockstar Games / Take-Two）、Counter-Strike 和 Dust II（Valve）、Minecraft（Mojang / Microsoft）是各自权利方的商标。这里的三个游戏是模型按一句话或一段提示词做的仿制练习，和原作无关，没有用原作的素材。Google Antigravity、Gemini 是 Google 的商标；两支「宣传片」是测试题，不是官方宣传。

**素材**
各项目用到的照片、字体、音色采样、地图数据的作者和许可，见各自文件夹里的 `CREDITS`。

## 许可

这个仓库里模型写的代码和提示词按 [MIT](LICENSE) 放出来，随便用。`11_rabies-briefing` 里来自 opuscar 的那部分文件按它自己的 MIT 许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。上面「致谢和出处」里提到的原作、商标和素材，归各自的权利方。
