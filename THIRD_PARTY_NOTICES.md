# 第三方代码声明

## Lemo-Opuscar

- 仓库：https://github.com/lemomo-ai/lemo-opuscar
- 作者：Lemomo（LemoLab）
- 许可：MIT

`11_rabies-briefing` 里下面这些文件来自 opuscar 库的 `styles/briefing-board/demo/`（「工程简报板」风格的样片工程）。模型做片子时把它们复制进了项目，做了少量到部分改动（改得最多的是 `tools/subcheck.mjs`、`tools/rescheck.mjs` 和 `kit/board.js`）：

- `11_rabies-briefing/kit/board.js`
- `11_rabies-briefing/kit/batch.mjs`
- `11_rabies-briefing/kit/tools/prep_object.py`
- `11_rabies-briefing/kit/tools/fetch_fonts.py`
- `11_rabies-briefing/kit/tools/make_print.py`
- `11_rabies-briefing/kit/tools/clean_lettering.py`
- `11_rabies-briefing/tools/camcheck.mjs`
- `11_rabies-briefing/tools/cuecheck.py`
- `11_rabies-briefing/tools/rescheck.mjs`
- `11_rabies-briefing/tools/subcheck.mjs`
- `11_rabies-briefing/index.html`

`04_antigravity-promo_v1`、`04b_antigravity-promo_apple`、`13_paper-files-india-city` 是照 opuscar 的工程约定写的（`build.sh`、`mix.py`、`timeline.js`、`engine.js` 这套结构），运行时调用库里的工具，但文件内容是模型为各自的片子重写的。

为了公开，这些文件里 opuscar 库的本机路径改成了读环境变量 `LIB`（见各项目 README）。

许可证原文：

```
MIT License

Copyright (c) 2026 LemoLab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
