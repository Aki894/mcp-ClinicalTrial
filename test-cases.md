# ClinicalTrials.gov 不良事件对照 MCP 服务器测试用例

本文档包含ClinicalTrials MCP服务器的测试用例，展示如何使用各种功能进行临床试验不良事件分析。

## 核心功能测试

### 1. 临床试验搜索测试

#### 测试用例 1.1: 基础药物搜索
```json
{
  "tool": "search_clinical_trials",
  "parameters": {
    "intervention": "pembrolizumab",
    "condition": "lung cancer",
    "status": "COMPLETED",
    "pageSize": 10,
    "countTotal": true
  }
}
```

#### 测试用例 1.2: 特定NCT ID搜索
```json
{
  "tool": "search_clinical_trials",
  "parameters": {
    "nct_id": "NCT04267848",
    "pageSize": 1
  }
}
```

### 2. 研究详情获取测试

#### 测试用例 2.1: 获取特定研究详情
```json
{
  "tool": "get_study_details",
  "parameters": {
    "nct_id": "NCT04267848"
  }
}
```

### 3. 不良事件对照分析测试（核心功能）

#### 测试用例 3.1: 与安慰剂对照分析
```json
{
  "tool": "compare_adverse_events",
  "parameters": {
    "drug_name": "pembrolizumab",
    "control_type": "placebo",
    "condition": "lung cancer",
    "limit": 15
  }
}
```

#### 测试用例 3.2: 与阳性对照药对照分析
```json
{
  "tool": "compare_adverse_events",
  "parameters": {
    "drug_name": "nivolumab",
    "control_type": "active_control",
    "condition": "melanoma",
    "limit": 10
  }
}
```

#### 测试用例 3.3: 剂量对照分析
```json
{
  "tool": "compare_adverse_events",
  "parameters": {
    "drug_name": "atezolizumab",
    "control_type": "dose_comparison",
    "condition": "cancer",
    "limit": 20
  }
}
```

### 4. 安全性特征分析测试（核心功能）

#### 测试用例 4.1: 综合安全性分析
```json
{
  "tool": "analyze_safety_profile",
  "parameters": {
    "drug_name": "pembrolizumab",
    "condition": "cancer",
    "include_completed_only": true,
    "limit": 30
  }
}
```

#### 测试用例 4.2: 包含进行中研究的安全性分析
```json
{
  "tool": "analyze_safety_profile",
  "parameters": {
    "drug_name": "durvalumab",
    "condition": "lung cancer",
    "include_completed_only": false,
    "limit": 25
  }
}
```

## 实际应用场景测试

### 场景 1: 新药安全性评估
**目标**: 评估新上市PD-1抑制剂的安全性特征

1. 搜索相关临床试验
2. 获取详细研究信息
3. 进行不良事件对照分析
4. 生成安全性特征报告

### 场景 2: 竞品药物对比
**目标**: 对比两种同类药物的安全性差异

1. 分别分析两种药物的安全性特征
2. 进行不良事件发生率对比
3. 识别关键安全性差异

### 场景 3: 剂量优化研究
**目标**: 分析不同剂量下的风险-效益关系

1. 搜索包含剂量信息的研究
2. 进行剂量-反应关系分析
3. 识别最优剂量范围

## 预期输出格式

### 不良事件对照分析输出示例
```json
{
  "drug_name": "pembrolizumab",
  "control_type": "placebo",
  "condition": "lung cancer",
  "total_studies_found": 45,
  "studies_with_results": 12,
  "adverse_event_comparisons": [
    {
      "nct_id": "NCT02775435",
      "title": "Study of Pembrolizumab vs Placebo",
      "control_type": "placebo",
      "event_groups": [...],
      "serious_events": [...],
      "other_events": [...]
    }
  ],
  "summary": {
    "studies_analyzed": 12,
    "control_type": "placebo",
    "key_findings": "Adverse event comparison data extracted from clinical trials",
    "recommendation": "Review individual study comparisons for detailed safety assessment"
  }
}
```

### 安全性特征分析输出示例
```json
{
  "drug_name": "pembrolizumab",
  "condition": "cancer",
  "total_studies": 156,
  "analyzed_studies": 45,
  "adverse_events_summary": {
    "total_events": 1250,
    "serious_events": 125,
    "other_events": 1125,
    "by_term": {
      "fatigue": {
        "count": 89,
        "serious_count": 5,
        "study_count": 23
      },
      "nausea": {
        "count": 67,
        "serious_count": 2,
        "study_count": 19
      }
    }
  },
  "risk_assessment": {
    "overall_risk_level": "MODERATE",
    "serious_event_rate": "10.00%",
    "most_common_events": [
      {"term": "fatigue", "count": 89, "study_count": 23},
      {"term": "nausea", "count": 67, "study_count": 19}
    ]
  }
}
```

## 错误处理测试

### 测试用例: 无效NCT ID
```json
{
  "tool": "get_study_details",
  "parameters": {
    "nct_id": "INVALID123"
  }
}
```

### 测试用例: 空搜索结果
```json
{
  "tool": "compare_adverse_events",
  "parameters": {
    "drug_name": "nonexistent_drug_xyz",
    "control_type": "placebo",
    "limit": 10
  }
}
```

## 性能测试

### 大数据量测试
- 搜索结果超过1000条的查询
- 分析超过50项研究的安全性特征
- 并发请求处理能力

### 响应时间测试
- 基础搜索: < 2秒
- 详情获取: < 1秒
- 不良事件分析: < 5秒
- 安全性特征分析: < 10秒

## 数据质量验证

### 验证点
1. 返回数据的完整性
2. NCT ID格式的正确性
3. 不良事件分类的准确性
4. 统计数据的合理性
5. 日期格式的标准化

## 集成测试

### 与Claude Desktop集成
1. MCP服务器正常启动
2. 工具列表正确显示
3. 参数验证正常工作
4. 错误信息正确传递
5. 响应格式符合MCP标准

## 测试成功标准

### 功能性标准
- [ ] 所有4个MCP工具都能正常调用
- [ ] 返回的数据格式正确且完整
- [ ] 错误处理机制工作正常
- [ ] 查询响应时间合理（<30秒）

### 数据质量标准
- [ ] 返回的临床试验信息准确
- [ ] 不良事件数据完整
- [ ] NCT ID和研究信息正确
- [ ] 统计分析结果合理

### 用户体验标准
- [ ] 查询结果易于理解
- [ ] 信息组织结构清晰
- [ ] 提供有价值的洞察
- [ ] 响应用户的具体需求

### 技术稳定性标准
- [ ] 连续查询不会导致连接中断
- [ ] 大量数据查询处理正常
- [ ] 网络异常时有适当的错误处理
- [ ] MCP连接保持稳定

## 快速测试命令

### 简单测试
"请搜索pembrolizumab在肺癌治疗中的临床试验。"

### 中等测试
"请分析pembrolizumab与安慰剂对照的不良事件数据，重点关注严重不良事件。"

### 复杂测试
"作为药物安全评估专家，我需要全面分析nivolumab的安全性特征，包括与不同对照组的比较和剂量-反应关系。"
