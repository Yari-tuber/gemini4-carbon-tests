# 02 · CS · Dust2（一句话）

提示词和每轮用时见 [PROMPT.md](PROMPT.md)。模型干了 36 分。

## 怎么运行

需要 Node.js。

```sh
npm install
npm run dev
```

然后打开 http://localhost:5173 。

`启动游戏.bat` 是模型自己写的 Windows 启动脚本（双击后开浏览器、跑 `npx vite`），原样保留。

## 和模型交付时不一样的地方

模型当时把三个游戏（GTA 6、CS、Minecraft）做在同一个文件夹里，共用一份 `package.json` 和 `vite.config.js`，入口分别是 `gta6.html`、`cs2.html`、`minecraft.html`。为了让这个文件夹能单独运行，这里做了三处改动：

- `cs2.html` 改名成了 `index.html`（内容没动，里面引用的 `/src_cs2/main.js` 路径在这个文件夹里是对的）；
- `package.json` 是照原来共用的那份重写的（依赖版本一样：three ^0.183.2、vite ^8.0.0）；
- `vite.config.js` 是照原来共用的那份重写的（去掉了对局域网开放的 `host: true`）。

`src_cs2/` 里的源码是模型原样输出，公开前逐个文件查过，这里没有需要改的本机路径和密钥，没有改动。

## 说明

Counter-Strike、Dust II 是 Valve 的商标。这里是模型按提示词做的仿制练习，和原作无关，没有用原作的任何素材。
