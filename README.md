# Outline AI API 文档

基于 Outline 知识库的 AI 对话 API 服务。

## 基础信息

- **基础 URL**: `http://localhost:3001`
- **端口**: 默认 3001，可通过环境变量 `AI_API_PORT` 修改
- **数据源**: 使用 Outline 项目的 `DATABASE_URL` 环境变量连接数据库

## 认证

当前版本无需认证。RAG 配置从数据库 `integrations` 表中自动读取（`service = 'rag'` 的第一条记录）。

## 接口列表

### 1. AI 对话（非流式）

同步返回 AI 回答内容。

**端点**: `POST /chat`

**请求头**:

```
Content-Type: application/json
```

**请求体**:

```json
{
  "question": "什么是 Outline?",
  "k": 10,
  "history": [
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "你好，有什么可以帮助你的吗?" }
  ]
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 用户问题 |
| k | number | 否 | 检索文档数量，默认 10 |
| history | array | 否 | 对话历史，用于多轮对话 |

**响应**:

```json
{
  "answer": "Outline 是一个...",
  "sources": [
    {
      "content": "文档内容...",
      "metadata": {},
      "score": 0.1
    }
  ]
}
```

**示例 - cURL**:

```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "什么是 Outline?"}'
```

---

### 2. 流式 AI 对话

流式返回 AI 回答内容。

**端点**: `POST /chat/stream`

**请求头**:

```
Content-Type: application/json
```

**请求体**:

```json
{
  "question": "什么是 Outline?",
  "k": 10,
  "history": [
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "你好，有什么可以帮助你的吗?" }
  ]
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 用户问题 |
| k | number | 否 | 检索文档数量，默认 10 |
| history | array | 否 | 对话历史，用于多轮对话 |

**响应类型**: `text/event-stream` (SSE 流式响应)

**响应数据格式**:

```json
// 来源文档
{"type": "sources", "data": [{"content": "...", "metadata": {}, "score": 0.1}]}

// 回答内容片段
{"type": "chunk", "data": "Outline 是一个..."}

// 完成信号
{"type": "done"}

// 错误
{"type": "error", "data": "错误信息"}
```

**示例 - cURL**:

```bash
curl -X POST http://localhost:3001/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "什么是 Outline?"}' \
  -N
```

**示例 - JavaScript**:

```javascript
const response = await fetch("http://localhost:3001/chat/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    question: "什么是 Outline?",
    k: 10,
    history: [],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

---

### 3. 健康检查

检查服务是否正常运行。

**端点**: `GET /health`

**响应**:

```json
{ "status": "ok" }
```

---

## RAG 配置

RAG 配置存储在 Outline 数据库的 `integrations` 表中：

| 字段     | 说明      |
| -------- | --------- |
| service  | `rag`     |
| type     | `post`    |
| settings | JSON 配置 |

**settings 字段说明**:
| 字段 | 说明 | 默认值 |
|------|------|--------|
| RAG_OPENAI_API_KEY | Embedding 模型 API Key | - |
| RAG_OPENAI_BASE_URL | Embedding 模型 Base URL | OpenAI |
| RAG_EMBEDDING_MODEL | Embedding 模型名称 | text-embedding-3-small |
| RAG_CHAT_API_KEY | Chat 模型 API Key | - |
| RAG_CHAT_BASE_URL | Chat 模型 Base URL | OpenAI |
| RAG_CHAT_MODEL | Chat 模型名称 | gpt-4o-mini |
| RAG_RETRIEVAL_K | 检索文档数量 | 10 |
| RAG_SCORE_THRESHOLD | 相似度阈值 (0-100) | 40 |
| RAG_CHUNK_SIZE | 文档分块大小 | 1000 |
| RAG_CHUNK_OVERLAP | 分块重叠大小 | 200 |
| RAG_TEMPERATURE | 模型温度 (0-100) | 40 |

---

## 启动服务

```bash
# 进入项目目录
cd ai-api

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build && npm start
```

---

## 响应码

| 码  | 说明           |
| --- | -------------- |
| 200 | 成功           |
| 400 | 请求参数错误   |
| 500 | 服务器内部错误 |
