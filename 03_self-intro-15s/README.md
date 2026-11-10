# 03 · 15 秒自我介绍动画（一句话）

提示词和用时见 [PROMPT.md](PROMPT.md)。模型干了 43 分，交付了一支 1920×1080、60 帧、15 秒的短片，画面是 WebGL（Three.js）逐帧渲染的，配乐和音效是 Python 合成的。

## 文件

- `index.html`、`film_engine.js`：画面；
- `synthesize_audio.py`：合成配乐，输出 `audio_master.wav`；
- `fetch_fonts.py`：从 Google Fonts 下载字体到 `fonts/`，并生成 `fonts/fonts.css`；
- `render_film.py`：用无头 Chrome 逐帧截图，再用 ffmpeg 合成 mp4；
- `serve_interactive.py`、`启动互动导演版播放器.bat`：在浏览器里直接看。

## 怎么运行

需要 Python（`playwright`、`opencv-python`、`numpy`，以及 `synthesize_audio.py` 里 import 的包）、Chrome、ffmpeg（放进 PATH）。

页面里的 Three.js 是从**上一级目录**的 `node_modules/three` 读的（模型当时把它做在一个已经装了 three 的文件夹下面）。所以先在这个文件夹的上一级执行 `npm install three`，然后：

```sh
python fetch_fonts.py          # 下载字体
python synthesize_audio.py     # 生成 audio_master.wav
python serve_interactive.py    # 浏览器里看，http://127.0.0.1:8799
python render_film.py --full   # 渲染成片
```

`render_film.py --full` 除了在本文件夹输出 `antigravity_15s_master.mp4`，还会往上一级目录写一份 `antigravity_self_intro_15s.mp4`。

## 没放进来的

| 文件 | 为什么 | 怎么拿 |
|---|---|---|
| `antigravity_15s_master.mp4`（约 96 MB） | 渲染出来的成片 | `python render_film.py --full` |
| `audio_master.wav` | 生成的音频 | `python synthesize_audio.py` |
| `fonts/` 里的字体文件（24 个） | 字体是别人的（Cormorant Garamond、Noto Serif SC、Inter、JetBrains Mono） | `python fetch_fonts.py` |
| `still_act1–4.png`、`preview_16frames.jpg` | 渲染出来的静帧和预览图 | `python render_film.py --preview` |

## 改动

为了公开，本机路径和密钥读取方式改过，其余是模型原样输出。具体是两处：

- `render_film.py`：`FFMPEG_BIN`、`FFPROBE_BIN` 原来是本机 ffmpeg 的绝对路径，改成了 `ffmpeg`、`ffprobe`；
- `启动互动导演版播放器.bat`：原来写的是本机 python.exe 的绝对路径，改成了 `python`。
