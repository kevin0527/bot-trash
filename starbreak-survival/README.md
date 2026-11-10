# 星环突围

横屏飞机射击游戏。网页版包含七场连续战斗和战机仓库。原生 3D 样机使用 Godot，有独立的战斗配置。

## 网页版

从仓库根目录启动本地静态服务。

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory starbreak-survival/web
```

打开 [本地游戏](http://127.0.0.1:8000/)。电脑用方向键或 WASD 移动，空格释放光束。手机横屏游玩，滑动战场左侧控制战机。

## 原生 3D 样机

用 Godot 4 打开 [native-3d/project.godot](native-3d/project.godot)。可编辑的 Blender 机体在 [native-3d/art](native-3d/art/)。
