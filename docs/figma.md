# Figma 设计系统集成

本项目支持从 Figma 同步设计 Token（颜色、字体、阴影）和图标资源到项目中，确保前端样式与设计稿保持一致。

## 前置条件

- Node.js 18+
- Figma 账号（需要对设计文件有编辑权限）

## 首次配置

### 1. 获取 Figma Personal Access Token

访问 [Figma Settings](https://www.figma.com/settings)，在 Personal Access Tokens 中生成一个 Token。

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，将 Token 填入：

```
FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxx
```

### 3. 配置 Figma 文件 Key

编辑 `figma.config.json`，将 `fileKey` 改为你的 Figma 文件 Key。Figma URL 格式为 `https://www.figma.com/file/{fileKey}/...`，从中提取 Key。

## Figma 设计稿组织规范

为了最佳效果，请按以下方式组织设计稿：

**颜色 Token：** 使用 FILL 样式存储颜色，命名如 `primary/blue`、`neutral/100`。同步后生成 `--figma-color-primary-blue` 等 CSS 变量。

**字体 Token：** 使用 TEXT 样式存储字体，命名如 `heading/h1`、`body/default`。同步后生成 `--figma-typography-heading-h1-fontFamily` 等 CSS 变量。

**阴影 Token：** 使用 EFFECT 样式存储阴影，命名如 `shadow/card`。同步后生成 `--figma-effect-shadow-card` 等 CSS 变量。

**图标：** 将图标组件放到名为 "Icons" 的 Page 中，命名以 `icon/` 开头（如 `icon/upload`、`icon/close`），然后在 `figma.config.json` 中设置 `namePrefix: "icon/"`。

## 同步命令

```bash
npm install                     # 安装依赖
npm run sync:figma              # 完整同步（Token + 图标）
npm run sync:figma:tokens       # 仅同步设计 Token
npm run sync:figma:icons        # 仅导出图标
```

## 开发说明

所有 CSS 自定义属性引用都带有 fallback 值，即使不运行同步，页面也会以默认样式正常渲染。布局和组件逻辑不受影响。

当你需要从 Figma 拉取最新的设计更新时，运行 `npm run sync:figma` 即可自动更新颜色、字体、阴影和图标资源。
