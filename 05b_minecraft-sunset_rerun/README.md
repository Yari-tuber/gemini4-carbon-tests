# 05b · Minecraft 永恒日落（同一段提示词，新会话重跑）

提示词和用时见 [PROMPT.md](PROMPT.md)。模型干了 32 分，一轮做完，没有追问。

## 怎么运行

需要 Node.js。

```sh
npm install
npx vite --port 5188
```

然后打开 http://localhost:5188 。`启动永恒日落.bat` 是模型写的 Windows 启动脚本，原样保留。

## 没放进来的

- `node_modules/`、`dist/`：`npm install`、`npm run build` 会重新生成。

## 改动

公开前逐个文件查过，这里没有需要改的本机路径和密钥，代码是模型原样输出。

## 说明

Minecraft 是 Mojang / Microsoft 的商标。这里是模型按提示词做的仿制练习，和原作无关，没有用原作的任何素材。
