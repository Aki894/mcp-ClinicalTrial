# ClinicalTrials.gov 不良事件对照 MCP 服务器

一个用于分析临床试验不良事件数据的MCP（Model Context Protocol）服务器，专为药物安全性评估和不良事件对照分析设计。通过ClinicalTrials.gov API v2提供临床试验数据的智能分析功能。

## 功能特性

- **临床试验搜索**: 使用ClinicalTrials.gov API v2搜索临床试验数据
- **不良事件对照分析**: 对比分析特定药物与安慰剂/阳性对照药的不良事件风险
- **安全性特征分析**: 提供药物安全性的基线参考和证据补强
- **剂量-反应关系**: 分析不同剂量下的风险差异验证
- **研究详情获取**: 获取特定NCT ID的详细临床试验信息

## 可用工具

### 1. search_clinical_trials
搜索临床试验，支持多种查询条件。

**参数:**
- `condition` (string): 医疗条件或疾病，如 "lung cancer", "diabetes"
- `intervention` (string): 药物或干预措施名称，如 "Vemurafenib", "chemotherapy"
- `outcome` (string): 结果指标，如 "overall survival", "adverse events"
- `sponsor` (string): 研究赞助方，如 "National Cancer Institute"
- `status` (string): 研究状态，如 "RECRUITING", "COMPLETED"
- `location` (string): 研究地点，如 "New York", "United States"
- `nct_id` (string): 特定NCT ID，如 "NCT04267848"
- `pageSize` (number): 返回记录数限制 (1-1000)
- `countTotal` (boolean): 是否统计总数

### 2. get_study_details
获取特定临床试验的详细信息。

**参数:**
- `nct_id` (string, 必需): 研究的NCT ID，如 "NCT04267848"

### 3. compare_adverse_events
**核心功能**: 对比分析特定药物的不良事件数据，提供基线参考和安全性评估。

**参数:**
- `drug_name` (string, 必需): 要分析的药物名称
- `control_type` (string): 对照类型
  - `"placebo"`: 与安慰剂对比（默认）
  - `"active_control"`: 与其他药物对比
  - `"dose_comparison"`: 不同剂量对比
- `condition` (string): 医疗条件，用于聚焦搜索
- `limit` (number): 分析的研究数量限制 (1-50)

### 4. analyze_safety_profile
**核心功能**: 分析药物的安全性特征，提供风险评估和剂量-反应关系。

**参数:**
- `drug_name` (string, 必需): 要分析的药物名称
- `condition` (string): 医疗条件背景
- `include_completed_only` (boolean): 仅包含已完成的研究（默认true）
- `limit` (number): 分析的研究数量限制 (1-100)

## 核心功能说明

### 不良事件对照分析
本服务器的核心功能是通过对比分析特定药物临床试验中的不良事件数据，为药物安全性特征提供科学依据：

1. **基线参考**: 与安慰剂或阳性对照药的风险对比
2. **证据补强**: 不同剂量下的风险差异验证
3. **风险评估**: 基于多项研究的综合安全性分析
4. **统计分析**: 不良事件发生率、严重程度分级等

### API数据源
- **ClinicalTrials.gov API v2**: https://clinicaltrials.gov/api/v2/studies
- **数据覆盖**: 全球临床试验注册数据库
- **更新频率**: 实时同步官方数据

## 安装和运行

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build

# 生产模式运行
npm start
```

### Ubuntu服务器部署

#### 1. 环境准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### 2. 部署MCP服务器

```bash
# 创建项目目录
mkdir -p ~/mcp-servers/clinicaltrials
cd ~/mcp-servers/clinicaltrials

# 上传项目文件（使用scp或git clone）
# 方法1: 使用git
git clone <your-repo-url> .

# 方法2: 使用scp从本地上传
# scp -r /path/to/mcp-openfda/* user@your-server:~/mcp-servers/openfda/

# 安装依赖
npm install

# 构建项目
npm run build

# 测试运行
npm start
```

#### 3. 使用PM2管理进程（推荐）

```bash
# 全局安装PM2
sudo npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'mcp-clinicaltrials',
    script: 'dist/index.js',
    cwd: '/home/ubuntu/mcp-servers/clinicaltrials',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# 启动服务
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs mcp-clinicaltrials
```

#### 4. 配置防火墙（如果需要网络访问）

```bash
# 如果需要通过网络访问，可以配置nginx反向代理
sudo apt install nginx

# 创建nginx配置
sudo tee /etc/nginx/sites-available/mcp-clinicaltrials << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP
    
    location / {
        proxy_pass http://localhost:3000;  # 如果MCP服务器监听3000端口
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用站点
sudo ln -s /etc/nginx/sites-available/mcp-clinicaltrials /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 远程调用配置

### 方法1: 通过SSH隧道

在客户端机器上创建SSH隧道：

```bash
# 创建SSH隧道，将本地端口转发到服务器
ssh -L 3000:localhost:3000 user@your-server-ip

# 然后在MCP客户端配置中使用 localhost:3000
```

### 方法2: 网络MCP服务器

如果需要通过网络直接访问，需要修改MCP服务器以支持网络传输：

```typescript
// 在src/index.ts中添加网络传输支持
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// 替换stdio传输为网络传输
const transport = new SSEServerTransport("/message", response);
```

### 方法3: 使用Docker部署

```bash
# 创建Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY src/ ./src/

EXPOSE 3000

CMD ["npm", "start"]
EOF

# 构建和运行
docker build -t mcp-clinicaltrials .
docker run -d -p 3000:3000 --name mcp-clinicaltrials-server mcp-clinicaltrials
```

## 使用示例

### 在Claude Desktop中配置

在Claude Desktop的配置文件中添加：

```json
{
  "mcpServers": {
    "clinicaltrials": {
      "command": "node",
      "args": ["/path/to/mcp-clinicaltrials/dist/index.js"],
      "env": {}
    }
  }
}
```

### 远程服务器配置

```json
{
  "mcpServers": {
    "clinicaltrials": {
      "command": "ssh",
      "args": [
        "user@your-server-ip",
        "cd ~/mcp-servers/clinicaltrials && node dist/index.js"
      ],
      "env": {}
    }
  }
}
```

## API使用示例

```javascript
// 搜索肺癌相关的临床试验
await searchClinicalTrials({
  condition: "lung cancer",
  intervention: "pembrolizumab",
  status: "COMPLETED",
  pageSize: 10
});

// 获取特定研究的详细信息
await getStudyDetails("NCT04267848");

// 对比分析药物不良事件（核心功能）
await compareAdverseEvents({
  drug_name: "pembrolizumab",
  control_type: "placebo",
  condition: "lung cancer",
  limit: 20
});

// 分析药物安全性特征（核心功能）
await analyzeSafetyProfile({
  drug_name: "pembrolizumab",
  condition: "cancer",
  include_completed_only: true,
  limit: 50
});
```

## 使用场景

### 药物安全性评估
- 新药上市前的安全性数据收集
- 已上市药物的安全性监测
- 药物不良反应的对照分析

### 临床研究支持
- 临床试验设计中的安全性参考
- 竞品药物的安全性对比
- 监管申报的支持数据

### 学术研究
- 药物流行病学研究
- 安全性Meta分析
- 药物警戒研究

## 注意事项

1. **API限制**: ClinicalTrials.gov API有速率限制，建议合理控制请求频率
2. **数据准确性**: 返回的数据仅供参考，不应作为最终医疗决策依据
3. **数据完整性**: 并非所有临床试验都有完整的不良事件数据
4. **统计意义**: 建议结合专业统计分析工具进行深入分析
5. **监管合规**: 使用数据时请遵守相关法规要求

## 故障排除

### 常见问题

1. **连接失败**: 检查网络连接和防火墙设置
2. **权限错误**: 确保Node.js进程有适当的文件权限
3. **端口冲突**: 检查端口是否被其他服务占用

### 日志查看

```bash
# PM2日志
pm2 logs mcp-clinicaltrials

# 系统日志
sudo journalctl -u nginx -f
```

## 技术架构

- **API版本**: ClinicalTrials.gov API v2
- **数据格式**: JSON (符合OpenAPI 3.0规范)
- **认证方式**: 无需认证（公开API）
- **响应格式**: 标准化JSON响应
- **错误处理**: 完整的错误捕获和处理机制

## 许可证

GPL-3.0 License
