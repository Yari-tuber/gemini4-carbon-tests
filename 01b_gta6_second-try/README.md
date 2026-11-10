# 01b · GTA 6 第二次（另开会话，多加一句要求）

提示词和用时见 [PROMPT.md](PROMPT.md)。模型干了 34 分。这一次它自己建了独立项目（TypeScript + Vite）。

## 怎么运行

需要 Node.js。

```sh
npm install
npm run dev
```

然后打开 http://localhost:5176 。`启动GTA6罪恶城.bat` 是模型写的 Windows 启动脚本，原样保留。

## 没放进来的

- `node_modules/`、`dist/`：`npm install`、`npm run build` 会重新生成。

## 改动

公开前逐个文件查过，这里没有需要改的本机路径和密钥，代码是模型原样输出。

## 说明

Grand Theft Auto 是 Rockstar Games / Take-Two 的商标。这里是模型按提示词做的仿制练习，和原作无关，没有用原作的任何素材。页面用到的字体从 Google Fonts 在线加载。
