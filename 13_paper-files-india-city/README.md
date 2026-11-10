# 13 · Every Indian could stand inside one city（看视频复刻）

提示词见 [PROMPT.md](PROMPT.md)，一共两轮，这个会话没有留下用时记录。

复刻的是 YouTube Shorts「Every Indian could stand inside one city」：https://www.youtube.com/shorts/5-7YkSe1Rwc ，原作者是 YouTube 频道 Paper Files。这里**只有 Gemini 4 Carbon 照着视频复刻出来的代码**（Three.js 场景、地图数据脚本、配乐和混音），不含原视频。创意和文案结构属于原作者。

（模型写的 `CREDITS`、`TREATMENT.md` 里没有写原作者；「Paper Files」取自下载原视频时留下的视频信息，代码注释里也这么称呼。）

## 怎么运行

出片靠开源库 opuscar（Lemo-Opuscar，作者 Lemomo / LemoLab，https://github.com/lemomo-ai/lemo-opuscar ）的渲染和配音工具：

1. 装好 opuscar，设环境变量 `LIB` 指向它（不设默认找 `~/lemo-opuscar`）；
2. 准备 `assets/`（见下）；
3. `sh build.sh`。`build.sh` 里 Python 的位置按 Windows 写的（`$LIB/.venv/Scripts/python.exe`），别的系统要自己改。

## 没放进来的

| 文件 | 为什么 | 怎么拿 |
|---|---|---|
| `assets/earth_day_4k.jpg`、`earth_night_4k.jpg`、`region_himalaya_2k.jpg`、`region_himalaya_graded.jpg`、`region_terrain_4k.jpg` | NASA 的卫星影像（公有领域）和用它调色合成的图 | NASA GIBS，图层名见 `CREDITS`；仓库里的脚本**不会**下载底图，要自己取，`region_terrain_4k.jpg` 由 `scripts/build_gis_assets.py` 合成 |
| `assets/gis_raw/`（约 23 MB） | Natural Earth、OpenStreetMap 的原始边界数据 | `python scripts/fetch_gis.py` |
| `assets/geo_data.json`、`assets/scene_geo.json`、`assets/crowd_targets.bin`、`assets/india_mask_4k.png` | 从上面的地图数据算出来的（含 © OpenStreetMap contributors 的边界，ODbL） | `python scripts/build_gis_assets.py` |
| `fonts/`（Inter） | 字体是别人的（SIL OFL 1.1） | https://rsms.me/inter/ |
| `voices/*.wav` | 生成的配音（Kokoro） | `build.sh` 会重新生成 |
| `paper-files-india-city.mp4`（约 50 MB）、`out/`、`stills/`、`stills_v2/`、`poster.jpg` | 渲染出来的成片、静帧和中间文件 | `sh build.sh` |

`assets/word_cues.json`（逐词字幕时间）留着。`CREDITS` 原样保留。

## 改动

为了公开，本机路径和密钥读取方式改过，其余是模型原样输出。具体是：

- `scripts/fetch_gis.py`、`scripts/build_gis_assets.py`：原来写死了一个本机代理地址当默认值，改成只读环境变量 `HTTPS_PROXY`，没设就直连。

- `build.sh`、`mix.py`：opuscar 库的本机路径改成读环境变量 `LIB`，默认 `~/lemo-opuscar`；
- `scripts/fetch_gis.py`、`scripts/build_gis_assets.py`：`ROOT` 原来是本机的项目绝对路径，改成按脚本所在位置算。
