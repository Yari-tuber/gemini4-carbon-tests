# 04b · 反重力宣传片 · 苹果风（追加了两句限定）

提示词和用时见 [PROMPT.md](PROMPT.md)。接在 [`04_antigravity-promo_v1`](../04_antigravity-promo_v1/) 同一个会话后面，这两轮合计约 56 分。交付的是 2560×1440、60 帧、60 秒的片子。

## 怎么运行

和 04 一样，靠 opuscar（Lemo-Opuscar，作者 Lemomo / LemoLab，https://github.com/lemomo-ai/lemo-opuscar ，代码 MIT 许可） 的工具出片：装好库、设好 `LIB`，再 `sh build.sh`。

另外这一版用了 Google Antigravity 的官方素材（见下），这些素材不在仓库里，要先自己放回 `assets/` 才能渲染。

## 没放进来的

| 文件 | 为什么 | 怎么拿 |
|---|---|---|
| `assets/brand/`（官方图标、字标、`Press-Kit.zip`） | Google 的新闻资料包，© Google LLC | https://antigravity.google/press |
| `assets/product/`（17 张官方产品截图）、`assets/video/`（7 段从官网取的视频） | Google 的官方素材，© Google LLC | Google Antigravity 官网，文件名见 `CREDITS` 和 `film.js` |
| `assets/seq/`（800 张序列帧，约 56 MB） | 从上面的官方视频里抽出来的帧 | 放好 `assets/video/` 后执行 `python tools/prepare_assets.py` |
| `antigravity-apple-promo.mp4`、`out/`、`poster.jpg` | 渲染出来的成片和中间文件 | `sh build.sh` |
| `fonts/` 里的字体文件 | 字体是别人的（SIL OFL 1.1） | `python tools/fetch_fonts.py` |
| `music/score.wav`、`voices/*.wav`、`voices/.cache/` | 生成的配乐和配音（配音是微软 Edge TTS） | `build.sh` 会重新生成 |

`CREDITS` 原样保留，里面记着所有素材的出处。

## 改动

为了公开，本机路径和密钥读取方式改过，其余是模型原样输出。具体是四处：

- `build.sh`：`LIB` 的默认值原来是本机路径，改成 `$HOME/lemo-opuscar`；往 PATH 里加的本机 ffmpeg 目录去掉了（ffmpeg 要自己放进 PATH）；
- `mix.py`、`music/score.py`：`LIB` 的默认值原来是本机路径，改成 `~/lemo-opuscar`。
