# PDF 分割工具

基于 Flask + 原生 JavaScript 的 Web 端 PDF 分割工具，支持按页码区间划分、页面预览和自定义重命名。

## 功能

- **PDF 上传** — 支持拖拽或点击上传，最大 600MB
- **页数读取** — 自动解析 PDF 总页数
- **两种分割模式** — 自定义区间 / 等分模式
- **页面预览** — 点击预览按钮查看区间内任意页面
- **重命名** — 支持自定义每个输出文件名
- **下载** — 支持单个下载和 ZIP 打包下载

## 技术栈

| 层       | 技术                                      |
| -------- | ----------------------------------------- |
| 后端     | Python 3.9+ / Flask 3.x                   |
| PDF 处理 | PyMuPDF                                   |
| 前端     | 原生 HTML / CSS / JavaScript (ES Modules) |
| 设计系统 | Figma Token 同步（可选）                  |

## 快速开始

### 1. 安装 Python 依赖、

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务默认运行在 `http://127.0.0.1:5000`。

### 3. 使用

1. 打开浏览器访问 `http://127.0.0.1:5000`
2. 拖拽或点击上传 PDF 文件
3. 选择分割模式（自定义区间或等分）
4. 可选：点击"预览"查看区间页面
5. 可选：编辑输出文件名
6. 点击"执行分割"
7. 下载单个文件或打包下载全部

## 项目结构

```
pdf_splite/
├── app.py                  # Flask 入口
├── requirements.txt        # Python 依赖
├── server/
│   ├── config.py           # 配置常量
│   ├── routes.py           # API 路由
│   ├── pdf_service.py      # PDF 处理逻辑
│   └── utils.py            # 工具函数
├── static/
│   ├── css/
│   │   ├── tokens.css      # Figma 设计 Token
│   │   └── style.css       # 样式
│   └── js/
│       ├── api.js           # API 请求封装
│       ├── upload.js        # 上传模块
│       ├── ranges.js        # 区间管理
│       ├── preview.js       # 预览模块
│       ├── toast.js         # 通知组件
│       └── main.js          # 主入口
├── templates/
│   └── index.html           # 页面模板
├── data/
│   ├── uploads/             # 上传文件（自动创建）
│   └── outputs/             # 输出文件（自动创建）
└── docs/
    ├── requirements.md      # 需求文档
    ├── design.md            # 设计文档
    └── figma.md             # Figma 集成说明
```

## API 接口

| 方法 | 路径                           | 说明                         |
| ---- | ------------------------------ | ---------------------------- |
| POST | `/api/upload`                | 上传 PDF，返回文件信息和页数 |
| GET  | `/api/preview/<id>/<page>`   | 获取指定页的预览图片         |
| POST | `/api/suggest-ranges`        | 计算等分区间建议             |
| POST | `/api/split`                 | 执行 PDF 分割                |
| GET  | `/api/download/<id>/<index>` | 下载单个分割文件             |
| GET  | `/api/download/<id>/zip`     | 打包下载全部文件             |

## Figma 设计系统（可选）

本项目支持从 Figma 同步设计 Token 到 CSS 变量。详见 [docs/figma.md](docs/figma.md)。
