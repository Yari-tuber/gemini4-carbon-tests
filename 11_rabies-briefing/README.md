# 11 · 狂犬病科普视频（借 Skill 的长任务）

提示词和用时见 [PROMPT.md](PROMPT.md)。两轮合计约 1 小时 33 分。模型用开源风格库 opuscar 的「工程简报板（Engineering Briefing Board）」风格，自己写稿、找素材、配音、配乐，交付了 2560×1440、60 帧、1 分 46 秒的片子。

## 哪些是模型写的，哪些是 opuscar 的

这一点要说清楚，免得把别人的代码算成模型的：

- **来自 opuscar 样片的**（库里的 `styles/briefing-board/demo/`，模型复制过来后只做了少量到部分改动）：`kit/board.js`、`kit/batch.mjs`、`kit/tools/prep_object.py`、`kit/tools/fetch_fonts.py`、`kit/tools/make_print.py`、`kit/tools/clean_lettering.py`、`tools/camcheck.mjs`、`tools/cuecheck.py`、`tools/rescheck.mjs`、`tools/subcheck.mjs`、`index.html`。这些文件的版权属于 LemoLab，MIT 许可，许可证全文在仓库根目录的 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
- **模型为这支片子写的**（文件怎么摆是照 opuscar 样片的，内容是重写的）：`TREATMENT.md`（导演阐述）、`FACTS.md`（事实核对）、`CREDITS`（素材出处）、`scenes/_gen_film.py` 和它生成的 `scenes/film.json`（整支片子的画面）、`audio/lines.json`（旁白稿）、`audio/gen_tts_gemini.py`（配音）、`audio/mix.py`（配乐和混音）、`kit/tools/build_all_objects.py`（抠图流程）、`build.sh`。

opuscar：作者 Lemomo（LemoLab），https://github.com/lemomo-ai/lemo-opuscar 。

## 怎么运行

1. 按 opuscar 仓库的说明把库装好，设环境变量 `LIB` 指向它（不设默认找 `~/lemo-opuscar`）；
2. 配音用 Google AI Studio 的 Gemini TTS：设环境变量 `GEMINI_API_KEY`（多把 key 用英文逗号隔开）；
3. 把下面「没放进来的」照片素材放回去；
4. `sh build.sh`。

## 没放进来的

| 文件 | 为什么 | 怎么拿 |
|---|---|---|
| `sources/raw/`（11 张原始照片，约 45 MB）、`sources/cleaned/`、`sources/masks/` | 从 Wikimedia Commons 下载的别人的照片（CC0 / 公有领域 / CC BY / CC BY-SA） | 每张的作者、许可、下载页都在 `CREDITS` 和 `sources/credits/*.json` 里；保存的文件名见 `kit/tools/build_all_objects.py` |
| `kit/objects/*.png`（11 张抠好的图，约 35 MB） | 上面那些照片抠出来的 | 放好原图后 `python kit/tools/build_all_objects.py` |
| `kit/fonts/`（LXGW Marker Gothic、Noto Sans SC、Archivo、IBM Plex Mono） | 字体是别人的（SIL OFL 1.1） | `python kit/tools/fetch_fonts.py` |
| `.models/birefnet-general.onnx`（约 930 MB） | 抠图模型权重 | https://github.com/danielgatis/rembg/releases |
| `audio/vo/*.wav`、`audio/vo_raw/`、`audio/stems/` | 生成的配音和分轨 | `build.sh` 会重新生成 |
| `rabies-briefing.mp4`（约 92 MB）、`out/`、`stills/`、`poster.jpg` | 渲染出来的成片、静帧和中间文件 | `sh build.sh` |
| `.venv/` | Python 环境 | 自己建 |

`kit/objects/*.json`（每个物件的尺寸、锚点、出处）和 `sources/credits/*.json` 留着。

## 改动

为了公开，本机路径和密钥读取方式改过，其余是模型原样输出。具体是：

- `audio/gen_tts_gemini.py`：**读密钥的方式改了**。原来从本机的一个密钥文件里读 key，现在改成读环境变量 `GEMINI_API_KEY`（多把 key 逗号分隔，换 key 重试的逻辑没动）；本机 ffmpeg 的绝对路径改成 `ffmpeg`；
- `build.sh`、`audio/mix.py`、`kit/batch.mjs`、`tools/camcheck.mjs`、`tools/rescheck.mjs`、`tools/subcheck.mjs`：opuscar 库的本机路径改成默认找家目录下的 `lemo-opuscar`；
- `kit/objects/*.json`（11 个）：里面记的素材原图位置原来是本机绝对路径，改成了相对本文件夹的路径（`sources\\raw\\…`）。

## 说明

片子里的医学内容是模型自己查资料写的，出处在 `FACTS.md`。这是一次模型测试，不是医疗建议；被动物咬伤抓伤请按当地疾控和医院的要求处理。
