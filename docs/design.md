# PDF 分割工具 - 设计文档

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Frontend)                      │
│  ┌──────────┬──────────┬───────────┬──────────────────────┐ │
│  │ Upload   │ Range    │ Preview   │ Download             │ │
│  │ Module   │ Selector │ Module    │ Module               │ │
│  └────┬─────┴────┬─────┴─────┬─────┴──────────┬───────────┘ │
│       │          │           │                │              │
│       └──────────┴───────────┴────────────────┘              │
│                         │ HTTP/REST                          │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                  Flask Server (Backend)                      │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │                   Routes Layer                       │    │
│  │  /api/upload  /api/preview  /api/split  /api/download│    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │                 PDF Service Layer                    │    │
│  │  - read_page_count()                                 │    │
│  │  - render_preview()                                  │    │
│  │  - split_pdf()                                       │    │
│  │  - zip_files()                                       │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │                 File Storage                         │    │
│  │  uploads/           outputs/          temp/          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 2. 技术选型

| 层 | 技术 | 说明 |
|----|------|------|
| 后端框架 | Flask 3.x | 轻量，适合小型工具 |
| PDF 读取/分割 | PyPDF2 / pypdf | 纯 Python，无 C 依赖，适用于页数读取和分割 |
| PDF 渲染预览 | pdf2image + Pillow | 将 PDF 页面渲染为 PNG 图片供前端预览 |
| 文件打包 | Python zipfile | 标准库，将多个 PDF 打包为 ZIP |
| 前端框架 | 无框架，纯 HTML/CSS/JS | 减少依赖，保持简单 |
| PDF 前端预览 | Canvas / img 标签 | 直接展示后端返回的页面图片 |
| 前端拖拽 | 原生 Drag & Drop API | 无需额外库 |
| HTTP 请求 | Fetch API | 原生异步请求 |

## 3. 项目目录结构

```
pdf_splite/
├── app.py                  # Flask 应用入口，创建 app 并注册路由
├── requirements.txt        # Python 依赖
├── docs/
│   ├── requirements.md     # 需求文档
│   └── design.md           # 设计文档（本文件）
├── server/
│   ├── __init__.py         # 包初始化
│   ├── config.py           # 配置常量（路径、文件大小限制等）
│   ├── routes.py           # API 路由定义，请求参数校验
│   ├── pdf_service.py      # PDF 核心处理逻辑
│   └── utils.py            # 工具函数（文件名清理、ID 生成等）
├── static/
│   ├── css/
│   │   └── style.css       # 全局样式
│   └── js/
│       ├── api.js           # API 请求封装
│       ├── upload.js        # 上传模块
│       ├── ranges.js        # 区间选择模块
│       ├── preview.js       # 预览模块
│       └── main.js          # 主入口，事件绑定与流程控制
├── templates/
│   └── index.html           # 单页面模板
├── data/
│   ├── uploads/             # 上传的原始 PDF（按 session 组织）
│   └── outputs/             # 分割后的 PDF 输出
```

## 4. API 设计

### 4.1 上传 PDF

```
POST /api/upload
Content-Type: multipart/form-data

Request:
  file: <binary>          # PDF 文件

Response 200:
{
  "code": 0,
  "data": {
    "file_id": "a1b2c3d4",        # 文件唯一标识
    "original_name": "example.pdf",
    "file_size": 13107200,         # bytes
    "page_count": 50
  }
}

Response 400:
{
  "code": 1,
  "message": "不支持的文件类型，仅接受 PDF 文件"
}
```

### 4.2 预览页面

```
GET /api/preview/<file_id>/<page_number>

Response 200:
  Content-Type: image/png
  <PNG binary data>

Response 404:
{
  "code": 1,
  "message": "文件不存在"
}
```

### 4.3 获取等分区间建议

```
POST /api/suggest-ranges

Request:
{
  "file_id": "a1b2c3d4",
  "parts": 3                      # 等分份数
}

Response 200:
{
  "code": 0,
  "data": {
    "ranges": [
      {"start": 1, "end": 17},
      {"start": 18, "end": 34},
      {"start": 35, "end": 50}
    ]
  }
}
```

### 4.4 执行分割

```
POST /api/split

Request:
{
  "file_id": "a1b2c3d4",
  "ranges": [
    {"start": 1, "end": 10, "filename": "chapter1.pdf"},
    {"start": 11, "end": 25, "filename": "chapter2.pdf"},
    {"start": 26, "end": 50, "filename": "chapter3.pdf"}
  ]
}

Response 200:
{
  "code": 0,
  "data": {
    "files": [
      {"index": 0, "filename": "chapter1.pdf", "download_url": "/api/download/a1b2c3d4/0", "pages": 10, "size": 2048000},
      {"index": 1, "filename": "chapter2.pdf", "download_url": "/api/download/a1b2c3d4/1", "pages": 15, "size": 3072000},
      {"index": 2, "filename": "chapter3.pdf", "download_url": "/api/download/a1b2c3d4/2", "pages": 25, "size": 5120000}
    ],
    "zip_url": "/api/download/a1b2c3d4/zip"
  }
}
```

### 4.5 下载文件

```
GET /api/download/<file_id>/<index>         # 下载单个分割文件
GET /api/download/<file_id>/zip             # 下载全部打包 ZIP
```

## 5. 前端模块设计

### 5.1 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| API 层 | `api.js` | 封装所有后端请求，统一错误处理 |
| 上传 | `upload.js` | 拖拽/点击上传、文件校验、进度显示 |
| 区间选择 | `ranges.js` | 等分模式、自定义模式、区间增删改、校验 |
| 预览 | `preview.js` | 预览弹窗、缩略图加载、翻页 |
| 主流程 | `main.js` | DOM 初始化、事件绑定、模块间协调、状态管理 |

### 5.2 全局状态

```javascript
const AppState = {
  file: null,           // { file_id, original_name, file_size, page_count }
  ranges: [],           // [{ start, end, filename }]
  results: [],          // [{ index, filename, download_url, pages, size }]
  mode: 'custom',       // 'equal' | 'custom'
};
```

### 5.3 关键交互流程

```
用户选择文件
    │
    ▼
前端校验(.pdf, ≤600MB) → POST /api/upload → 返回 file_id + page_count
    │
    ▼
选择分割模式 ──→ 等分：输入份数 → POST /api/suggest-ranges → 自动填充区间
    │         │
    │         └─→ 自定义：手动添加区间行
    │
    ▼
可选：点击预览 → GET /api/preview/:id/:page → 展示页面图片
    │
    ▼
编辑输出文件名
    │
    ▼
点击"执行分割" → POST /api/split → 返回下载链接列表
    │
    ▼
单个下载 / 打包下载
```

## 6. 后端 PDF 处理设计

### 6.1 核心函数签名

```python
# server/pdf_service.py

def read_page_count(file_path: str) -> int:
    """读取 PDF 页数，文件损坏时抛出 PdfReadError"""

def render_page_image(file_path: str, page_num: int, dpi: int = 150) -> bytes:
    """将指定页渲染为 PNG 图片字节，用于预览"""

def split_pdf(file_path: str, ranges: list[dict], output_dir: str) -> list[dict]:
    """
    按区间分割 PDF
    ranges: [{"start": 1, "end": 10, "filename": "ch1.pdf"}, ...]
    返回: [{"index": 0, "path": "xxx.pdf", "filename": "ch1.pdf", "pages": 10, "size": 2048}, ...]
    """

def zip_files(file_paths: list[str], output_path: str) -> str:
    """将多个文件打包为 ZIP"""
```

### 6.2 文件生命周期

```
上传 → data/uploads/{file_id}.pdf    (保留至 session 结束)
预览 → 实时渲染，不缓存
分割 → data/outputs/{file_id}/       (输出目录)
下载 → 直接读取 outputs 目录文件
清理 → 定时清理或手动重置时删除
```

## 7. 错误处理策略

| 层级 | 策略 |
|------|------|
| 前端 | 文件类型/大小即时校验；API 错误统一 toast 提示 |
| 后端路由层 | 参数校验 → 400；文件不存在 → 404；处理异常 → 500 |
| 后端服务层 | 抛出明确的业务异常，由路由层捕获转换 |
| 全局 | Flask errorhandler 兜底，返回统一 JSON 格式 |

统一错误响应格式：
```json
{
  "code": 1,
  "message": "人类可读的错误描述"
}
```

## 8. 关键设计决策

1. **不引入数据库** — 工具型应用，无持久化需求，文件系统 + 内存即可
2. **file_id 使用 UUID** — 避免文件名冲突和路径穿越
3. **预览渲染在后端** — pdf2image 比纯前端 PDF.js 渲染更稳定，且支持更多 PDF 特性
4. **单页面应用** — 所有操作在一个页面完成，无页面跳转
5. **分页预览而非全量** — 预览只加载当前查看的页面，避免大 PDF 导致浏览器卡顿
6. **ZIP 打包在后端** — 减少前端 JSZip 等依赖，简化逻辑