# StarRing 灯光与登场实验

67.js 使用 StarRing 模型渲染同机位的冷暖光对照和 6 秒登场样片。渲染产物保存在本地的 `artifacts/`。

需要 Node.js 20.19 或更新版本、Python 3、Chrome 和 FFmpeg。从本目录安装依赖并启动预览。

```sh
npm ci
npm run preview
```

在同一目录的新终端里生成静帧和视频。

```sh
npm run review
npm run film
```

打开 [本地预览](http://127.0.0.1:8817/)。渲染器默认使用 macOS 上的 Chrome。Chrome 在其他位置时，用环境变量 `STAR_RING_CHROME` 指定可执行文件路径。
