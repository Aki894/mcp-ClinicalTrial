# ClinicalTrials.gov MCP Server

让 AI 助手检索注册临床研究、获取完整方案与结果、比较研究内不良事件，并整理带来源的安全性数据。

[English](README.en.md) · [API](https://clinicaltrials.gov/data-api/api) · [GitHub Issues](https://github.com/Aki894/mcp-ClinicalTrial/issues)

## 功能特性

- **`search_clinical_trials`**：按疾病、干预、结局、申办方、状态、地点或 NCT 编号检索；支持分页与可选总数，返回完整研究记录。
- **`get_study_details`**：按 NCT 编号获取完整方案、结果、文档及派生信息，不截断正文。
- **`compare_adverse_events`**：提取研究内各组事件人数、分母与比例；根据组标签和方案识别对照候选，计算组间风险差与比值，保留识别依据供复核。
- **`analyze_safety_profile`**：汇总事件术语及研究覆盖情况，保留各组统计与干预剂量描述，提供可追溯的描述性安全数据。
- **`get_complete_study_details`**：按 NCT 编号获取完整研究，或选择顶层章节，保留未截断的原始信息。
- **`search_trials`**：按干预名称和可选全文关键词检索，返回协议与结果证据记录。

## 快速开始

需要 Git、Node.js 22 或更高版本及 npm，并能访问 `clinicaltrials.gov`。

```bash
git clone https://github.com/Aki894/mcp-ClinicalTrial.git
cd mcp-ClinicalTrial
npm ci
npm run build
```

### 配置 MCP 客户端

在支持 `mcpServers` 配置格式的客户端中加入以下条目，将入口替换为构建后的**绝对路径**：

```json
{
  "mcpServers": {
    "clinicaltrials": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-ClinicalTrial/dist/index.js"
      ]
    }
  }
}
```

Windows 可使用 `D:/mcp/mcp-ClinicalTrial/dist/index.js`，避免 JSON 反斜杠转义。若客户端找不到 `node`，将 `command` 改为 Node.js 可执行文件的绝对路径。保存后重新加载 MCP 连接，检查工具列表。其他客户端请按其格式填写相同的命令与参数。

服务器使用 **stdio**，由 MCP 客户端启动，无需端口或 HTTP 地址。直接在终端启动后等待标准输入属于正常行为。

无需 API 密钥或必填环境变量。

## 可用工具

当前提供 **6 个工具**。参数使用严格校验，拒绝未声明字段；字符串会去除首尾空格并拒绝控制字符。数字参数使用 JSON 数字，布尔参数使用 JSON 布尔值。下表的默认值、必填项和边界与服务实际公布的 schema 一致。

### `search_clinical_trials`

按疾病、干预、结局、申办方、状态、地点或 NCT 编号检索；支持分页与可选总数，返回完整研究记录。

| 参数 | 类型 | 必填 | 默认值 | 描述与范围 |
| --- | --- | --- | --- | --- |
| `condition` | string | 否 | `—` | 疾病或医学状况，映射到 query.cond。 长度为 1–200 个字符 |
| `intervention` | string | 否 | `—` | 药物或干预名称，映射到 query.intr。 长度为 1–200 个字符 |
| `outcome` | string | 否 | `—` | 结局指标搜索词，映射到 query.outc。 长度为 1–200 个字符 |
| `sponsor` | string | 否 | `—` | 研究申办方，映射到 query.spons。 长度为 1–200 个字符 |
| `status` | string | 否 | `—` | 研究整体状态筛选，可选值见下方。 |
| `location` | string | 否 | `—` | 研究地点搜索词，映射到 query.locn。 长度为 1–200 个字符 |
| `nct_id` | string | 否 | `—` | NCT 后跟八位数字的研究标识符。 |
| `pageToken` | string | 否 | `—` | 上次相同查询返回的 next_page_token，翻页时保持其他条件一致。 长度为 1–4000 个字符 |
| `pageSize` | integer | 否 | `50` | 每页最多返回的研究数量。 ≥1; ≤1000 |
| `countTotal` | boolean | 否 | `false` | 是否请求匹配研究总数；关闭时总数字段可能为 null。 |

`status` 可选值：

- `ACTIVE_NOT_RECRUITING`
- `AVAILABLE`
- `COMPLETED`
- `ENROLLING_BY_INVITATION`
- `NOT_YET_RECRUITING`
- `NO_LONGER_AVAILABLE`
- `RECRUITING`
- `SUSPENDED`
- `TEMPORARILY_NOT_AVAILABLE`
- `TERMINATED`
- `UNKNOWN`
- `WITHDRAWN`
- `WITHHELD`


调用示例（MCP `tools/call` 的参数）：

```json
{
  "name": "search_clinical_trials",
  "arguments": {
    "intervention": "pembrolizumab",
    "status": "COMPLETED",
    "pageSize": 3,
    "countTotal": true
  }
}
```

### `get_study_details`

按 NCT 编号获取完整方案、结果、文档及派生信息，不截断正文。

| 参数 | 类型 | 必填 | 默认值 | 描述与范围 |
| --- | --- | --- | --- | --- |
| `nct_id` | string | 是 | `—` | NCT 后跟八位数字的研究标识符。 |

调用示例（MCP `tools/call` 的参数）：

```json
{
  "name": "get_study_details",
  "arguments": {
    "nct_id": "NCT01866319"
  }
}
```

### `compare_adverse_events`

提取研究内各组事件人数、分母与比例；根据组标签和方案识别对照候选，计算组间风险差与比值，保留识别依据供复核。

| 参数 | 类型 | 必填 | 默认值 | 描述与范围 |
| --- | --- | --- | --- | --- |
| `drug_name` | string | 是 | `—` | 英文药物通用名、商品名或成分名。 长度为 1–200 个字符 |
| `condition` | string | 否 | `—` | 疾病或医学状况，映射到 query.cond。 长度为 1–200 个字符 |
| `control_type` | string | 否 | `"placebo"` | 期望的对照类型：安慰剂、活性对照或不同剂量；返回候选配对及识别依据。 placebo / active_control / dose_comparison |
| `limit` | integer | 否 | `10` | 本次最多返回的记录或统计桶数量。 ≥1; ≤50 |

调用示例（MCP `tools/call` 的参数）：

```json
{
  "name": "compare_adverse_events",
  "arguments": {
    "drug_name": "pembrolizumab",
    "control_type": "active_control",
    "limit": 5
  }
}
```

### `analyze_safety_profile`

汇总事件术语及研究覆盖情况，保留各组统计与干预剂量描述，提供可追溯的描述性安全数据。

| 参数 | 类型 | 必填 | 默认值 | 描述与范围 |
| --- | --- | --- | --- | --- |
| `drug_name` | string | 是 | `—` | 英文药物通用名、商品名或成分名。 长度为 1–200 个字符 |
| `condition` | string | 否 | `—` | 疾病或医学状况，映射到 query.cond。 长度为 1–200 个字符 |
| `include_completed_only` | boolean | 否 | `true` | 仅检索已完成且已发布结果的研究。 |
| `limit` | integer | 否 | `20` | 本次最多返回的记录或统计桶数量。 ≥1; ≤100 |

调用示例（MCP `tools/call` 的参数）：

```json
{
  "name": "analyze_safety_profile",
  "arguments": {
    "drug_name": "pembrolizumab",
    "include_completed_only": true,
    "limit": 5
  }
}
```

### `get_complete_study_details`

按 NCT 编号获取完整研究，或选择顶层章节，保留未截断的原始信息。

| 参数 | 类型 | 必填 | 默认值 | 描述与范围 |
| --- | --- | --- | --- | --- |
| `nct_id` | string | 是 | `—` | NCT 后跟八位数字的研究标识符。 |
| `fields` | string[] | 否 | `—` | 返回章节列表；省略或为空时返回全部，可选值见下方。 |

`fields` 可选值：

- `protocolSection`
- `resultsSection`
- `documentSection`
- `derivedSection`
- `hasResults`


调用示例（MCP `tools/call` 的参数）：

```json
{
  "name": "get_complete_study_details",
  "arguments": {
    "nct_id": "NCT01866319",
    "fields": [
      "protocolSection",
      "resultsSection"
    ]
  }
}
```

### `search_trials`

按干预名称和可选全文关键词检索，返回协议与结果证据记录。

| 参数 | 类型 | 必填 | 默认值 | 描述与范围 |
| --- | --- | --- | --- | --- |
| `drug` | string | 是 | `—` | 英文药物名称。 长度为 1–200 个字符 |
| `adr` | string | 否 | `—` | 可选不良反应搜索词。 长度为 1–200 个字符 |
| `limit` | integer | 否 | `5` | 本次最多返回的记录或统计桶数量。 ≥1; ≤20 |

调用示例（MCP `tools/call` 的参数）：

```json
{
  "name": "search_trials",
  "arguments": {
    "drug": "metformin",
    "adr": "hypoglycemia",
    "limit": 3
  }
}
```

## 返回结果与查询行为

MCP 响应的 `content` 中包含一个 `type: "text"` 项，其 `text` 是 JSON 字符串。所有成功结果均包含 `source` 和 `query_url`，分别标明数据源和主查询 URL。复合工具的其他请求链接在结果内保留。

| 工具 | 数据字段与行为 |
| --- | --- |
| `search_clinical_trials` | `studies` 为完整上游研究记录并附 `url`；`meta` 含 `total_count`、`returned_count`、`next_page_token`。未请求总数时 `total_count` 为 `null`；无下一页时令牌为 `null`。 |
| `get_study_details` | `nct_id` 和 `study`；研究对象保留所有上游字段并附来源 `url`。 |
| `get_complete_study_details` | `nct_id` 和 `complete_study_details`；可按 `fields` 选择顶层章节，省略或空数组表示整个研究，附来源 `url`。 |
| `compare_adverse_events` | `total_studies_found`、`inspected_studies`、`studies_with_adverse_events`、`next_page_token` 和 `adverse_event_comparisons`。每个研究含 `event_groups`、`events`、`arm_groups`、`interventions`、原始 `adverse_events_module` 和 `comparison_candidates`。 |
| `analyze_safety_profile` | `total_studies`、`inspected_studies`、`studies_with_results`、`studies_with_adverse_events`、`next_page_token`、`adverse_events_summary`、`studies`。术语汇总含事件类型、条目数 `records`、研究 ID 及 `study_count`，原始统计在各研究中保留。 |
| `search_trials` | `records[].id/url/content/metadata`；`content` 是包含 `protocolSection`、`resultsSection` 的 JSON 字符串，需再次解析；无结果章节时为 `null`。元数据含标题和 `has_results`。 |

所有工具的数据源标记为 `clinical_trials`。搜索无匹配时数组为空；详情编号不存在时返回上游 404 错误。分页使用上次返回的令牌及相同条件。`search_trials.adr` 映射到 `query.term`，是全文查询，不是已报告不良事件专属筛选。

比较与安全概览的 `limit` 是最多检查的匹配研究数，结果明确区分全量匹配数和本次检查数，并返回剩余页令牌。比较工具限定已发布结果的研究；安全概览的 `include_completed_only=true` 同时限定已完成和已发布结果。缺失不良事件的研究仍计入检查覆盖情况。

### 比较规则和统计口径

- 安慰剂候选：事件组标题或描述中恰有一组包含 placebo。
- 活性对照候选：事件组标题与方案组标签精确规范化匹配，分别为 EXPERIMENTAL 和 ACTIVE_COMPARATOR。
- 剂量候选：匹配到两个 EXPERIMENTAL 组，且其标题或描述含不同剂量字符串；具体药物、联合方案和时间窗需核对。
- 候选均带 `reason` 和 `requires_review: true`；无法匹配时返回空候选，仍保留原始分组与事件。
- `events[].stats[].proportion` 使用 `numAffected / numAtRisk`。分母缺失或为 0、人数无效时为 `null`。`contrasts` 保留两组统计并给出 `risk_difference` 和 `risk_ratio`；对照比例为 0 时比值为 `null`。
- 各研究和人群不混合计算总体风险；术语条目数及研究覆盖数单独呈现。剂量说明保留在 `interventions` 和组描述中，不将文本关联转换为剂量因果结论。

## 使用示例

连接后可以向助手提出：

> 检索 pembrolizumab 的已完成研究，列出 NCT 编号和来源；获取一项研究的完整结果，再整理各组严重不良事件的人数、分母及比例。

返回信息用于检索与研究辅助；临床判断需结合具体产品、研究设计和个人情况，本项目不提供个人诊疗建议。

## 数据来源

每次调用访问 [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api) 的 `/api/v2/studies` 或 `/api/v2/studies/{nct_id}`。研究详情完整度取决于注册和结果发布情况。没有本地研究数据库或结果缓存。使用数据请遵循 [ClinicalTrials.gov 条款](https://clinicaltrials.gov/about-site/terms-conditions)。

## 错误处理与故障排查

工具执行失败时返回 `isError: true`，文本 JSON 结构如下：

```json
{"error":{"code":"invalid_arguments","message":"…","retryable":false}}
```

每次上游请求默认超时 30 秒，不自动重试；复合工具可能执行多次请求。`retryable` 提示调用方稍后是否适合重试。

| 情况 / 错误码 | 处理方法 |
| --- | --- |
| 工具缺失或连接关闭 | 确认 Node.js ≥22，执行构建，检查绝对路径，并重新加载客户端。 |
| `invalid_arguments` | 检查必填项、类型、范围及枚举，删除额外参数。 |
| `unknown_tool` | 重新加载工具列表并使用上文工具名。 |
| `network / timeout` | 检查服务器能否访问 clinicaltrials.gov，稍后重试。 |
| `http_429 / http_5xx` | 降低请求频率，等待上游恢复。 |
| `http_400 / http_401 / http_403` | 检查查询表达式、凭据及上游访问条件。 |
| `http_404` | 检查记录标识；搜索无匹配按各工具的空结果规则处理。 |
| `invalid_json / invalid_response` | 上游响应格式异常，持续出现时附错误码提交 Issue。 |
| `cancelled` | 客户端取消了请求，需要时重新发起。 |
| `internal / configuration` | 检查安装与本地改动，附运行环境和错误信息反馈。 |

## 从源码运行

```bash
npm run build
npm start
npm run dev
```

上述命令分别用于构建、启动构建产物和直接运行 TypeScript 源码。

## 反馈与许可证

通过 [GitHub Issues](https://github.com/Aki894/mcp-ClinicalTrial/issues) 反馈问题，请提供 Node.js 版本、MCP 客户端、工具参数及错误码，移除密钥和个人信息。

代码采用 [GPL-3.0](LICENSE)。数据来源条款单独适用。
