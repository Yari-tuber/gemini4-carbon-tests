# 04 · 反重力宣传片 · 第一版（一句话）

提示词和用时见 [PROMPT.md](PROMPT.md)。前两轮合计约 45 分。用户只说了「随便，你找一个你喜欢的」，模型自己选了开源风格库 opuscar 里的「暗色科技发布（dark-keynote）」风格。交付的是 1920×1080、24 帧、48 秒的片子。

同一个会话的后两轮见 [`04b_antigravity-promo_apple`](../04b_antigravity-promo_apple/)。

## 怎么运行

这个项目靠 opuscar（Lemo-Opuscar，作者 Lemomo / LemoLab，https://github.com/lemomo-ai/lemo-opuscar ，代码 MIT 许可） 的渲染、配音、混音工具来出片，单独打不开。

1. 按 opuscar 仓库的说明把库装好（Node、Python、ffmpeg）；
2. 设环境变量 `LIB` 指向库的文件夹（不设的话默认找 `~/lemo-opuscar`）；
3. 在本文件夹执行 `sh build.sh`。

## 文件

`TREATMENT.md`（导演阐述和分镜）、`film.js` / `engine.js` / `timeline.js`（画面）、`music/score.py`（配乐）、`mix.py`（混音）、`lines.json`（旁白稿）、`CREDITS`（素材出处）、`tools/`（检查脚本）。

## 没放进来的

| 文件 | 为什么 | 怎么拿 |
|---|---|---|
| `antigravity-promo.mp4`、`out/`、`poster.jpg` | 渲染出来的成片和中间文件 | `sh build.sh` |
| `fonts/` 里的字体文件（Inter、Inter Tight、JetBrains Mono、Noto Sans SC） | 字体是别人的（SIL OFL 1.1） | `python tools/fetch_fonts.py` |
| `music/score.wav`、`voices/*.wav`、`voices/.cache/` | 生成的配乐和配音（配音是微软 Edge TTS） | `build.sh` 会重新生成 |

## 改动

为了公开，本机路径和密钥读取方式改过，其余是模型原样输出。具体是三处，都是 opuscar 库的位置：

- `build.sh`：`LIB` 原来是本机路径，改成 `${LIB:-$HOME/lemo-opuscar}`；
- `mix.py`、`music/score.py`：`LIB` 的默认值原来是本机路径，改成 `~/lemo-opuscar`。
