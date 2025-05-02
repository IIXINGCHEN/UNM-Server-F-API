# UNM-Server API 使用指南

## 目录
- [简介](#简介)
- [API认证](#api认证)
- [请求格式](#请求格式)
- [响应格式](#响应格式)
- [核心API端点](#核心api端点)
- [错误代码](#错误代码)
- [使用示例](#使用示例)
- [常见问题](#常见问题)

## 简介

UNM-Server API 是一个提供网易云音乐解锁功能的纯RESTful API服务。本文档详细说明了如何正确使用API，包括认证方法、请求/响应格式和使用示例。

## API认证

为了防止API滥用，UNM-Server API采用API密钥认证机制。在生产环境中，所有API请求需要包含有效的API密钥才能访问。

### 获取API密钥

API密钥由服务管理员分配。如需获取密钥，请联系服务提供者或系统管理员。

### 认证方法

API密钥应通过HTTP `Authorization` 头以Bearer令牌的形式提供：

```
Authorization: Bearer your_api_key_here
```

### 认证示例

```bash
# 使用curl发送带认证的请求
curl -H "Authorization: Bearer your_api_key_here" https://your-api-url/v1/api/match?id=1962165898

# 使用axios发送带认证的请求
axios.get('https://your-api-url/v1/api/match?id=1962165898', {
  headers: {
    'Authorization': 'Bearer your_api_key_here'
  }
})
```

## 请求格式

UNM-Server API 仅支持GET请求方法，参数通过URL查询字符串提供。

### API前缀

所有API端点都有两种访问方式：

1. **推荐方式**: 使用 `/v1/api/` 前缀，例如：`/v1/api/match?id=1859245776`
2. **兼容方式**: 直接访问路径，例如：`/match?id=1859245776`

推荐使用带前缀的版本，以便于未来API版本更新时保持兼容性。

## 响应格式

所有API响应均为JSON格式，包含以下标准字段：

```json
{
  "code": 200,         // HTTP状态码
  "message": "成功",   // 响应消息
  "data": { ... },     // 响应数据（只在成功时返回）
  "cached": true       // 是否来自缓存（可选）
}
```

## 核心API端点

### 匹配音乐资源

```
GET /v1/api/match?id={网易云歌曲ID}&server={音源列表}
```

**参数**:
- `id`: 网易云音乐歌曲ID（必需）
- `server`: 音源服务器列表，多个用逗号分隔（可选，默认使用配置中的默认音源）

**响应示例**:
```json
{
  "code": 200,
  "message": "匹配成功",
  "data": {
    "name": "歌曲名",
    "artist": "艺术家名",
    "url": "音乐文件URL",
    "pic": "专辑封面URL",
    "lrc": "歌词URL",
    "source": "kugou"
  }
}
```

### 获取音乐直链

```
GET /v1/api/song?id={网易云歌曲ID}
```

**参数**:
- `id`: 网易云音乐歌曲ID（必需）
- `source`: 指定音源（可选）
- `br`: 指定比特率（可选，如"320"）

**响应示例**:
```json
{
  "code": 200,
  "message": "请求成功",
  "data": {
    "url": "音乐文件URL",
    "br": 320,
    "size": 9876543,
    "md5": "文件MD5",
    "source": "kugou"
  }
}
```

### 获取可用音源列表

```
GET /v1/api/sources
```

**响应示例**:
```json
{
  "code": 200,
  "message": "请求成功",
  "data": [
    {
      "name": "酷狗音乐",
      "code": "kugou",
      "enabled": true
    },
    {
      "name": "酷我音乐",
      "code": "kuwo",
      "enabled": true
    }
  ]
}
```

### 获取服务状态

```
GET /v1/api/health
```

**响应示例**:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "uptime": {
    "seconds": 3650,
    "formatted": "1时0分50秒"
  },
  "timestamp": "2023-06-01T12:34:56.789Z",
  "memory": {
    "rss": "45MB",
    "heapTotal": "35MB",
    "heapUsed": "28MB",
    "external": "12MB",
    "usage_percentage": 80
  },
  "system": {
    "platform": "linux",
    "arch": "x64",
    "node_version": "v18.16.0",
    "cpus": {
      "count": 4,
      "model": "Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz"
    },
    "loadavg": [0.2, 0.3, 0.4],
    "load_status": "green",
    "freemem": "3456MB",
    "totalmem": "8192MB",
    "memory_usage_percentage": 58
  },
  "network": {
    "hostname": "******" // 已脱敏
  },
  "services": {
    "redis": {
      "status": "connected",
      "url": "已配置(已脱敏)",
      "enabled": true
    },
    "music_api": {
      "status": "connected",
      "url": "已配置(已脱敏)",
      "enabled": true
    }
  },
  "sources": {
    "netease": true,
    "kugou": true,
    "kuwo": true,
    "bilibili": true,
    "migu": true
  },
  "cache": {
    "size": 234,
    "hit_ratio": "85%"
  },
  "client": {
    "ip": "******", // 已脱敏
    "user_agent": "******" // 已脱敏
  }
}
```

## 错误代码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 400 | 请求参数错误 | 请检查参数格式和必填项 |
| 401 | 未授权 | 未提供API密钥或密钥无效 |
| 403 | 禁止访问 | IP地址不在白名单中 |
| 404 | 资源未找到 | 请求的端点不存在或资源未找到 |
| 429 | 请求过于频繁 | 超过请求频率限制，请稍后再试 |
| 500 | 服务器内部错误 | 服务器处理请求时发生错误 |
| 504 | 网关超时 | 请求音源服务超时 |

## 使用示例

### JavaScript (Node.js)

```javascript
const axios = require('axios');

// 配置默认的API密钥
axios.defaults.headers.common['Authorization'] = 'Bearer your_api_key_here';

// 匹配音乐资源
async function matchSong(id, sources = 'kugou,kuwo') {
  try {
    const response = await axios.get(`https://your-api-url/v1/api/match?id=${id}&server=${sources}`);
    return response.data;
  } catch (error) {
    console.error('匹配音乐失败:', error.response?.data || error.message);
    throw error;
  }
}

// 使用示例
matchSong('1859245776')
  .then(result => console.log(result))
  .catch(err => console.error(err));
```

### Python

```python
import requests

# API基础URL
API_BASE_URL = "https://your-api-url/v1/api"
API_KEY = "your_api_key_here"

headers = {
    "Authorization": f"Bearer {API_KEY}"
}

def match_song(song_id, sources="kugou,kuwo"):
    """匹配网易云歌曲"""
    url = f"{API_BASE_URL}/match?id={song_id}&server={sources}"
    response = requests.get(url, headers=headers)
    response.raise_for_status()  # 抛出异常如果请求失败
    return response.json()

# 使用示例
try:
    result = match_song("1859245776")
    print(result)
except requests.RequestException as e:
    print(f"请求失败: {e}")
```

### 前端Web页面

```javascript
// 使用fetch API获取音乐数据
function getSongUrl(songId) {
  return fetch(`https://your-api-url/v1/api/song?id=${songId}`, {
    headers: {
      'Authorization': 'Bearer your_api_key_here'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`API错误: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.code === 200 && data.data.url) {
      return data.data.url;
    } else {
      throw new Error('获取音乐URL失败');
    }
  });
}

// 使用获取的URL创建音频播放器
getSongUrl('1859245776')
  .then(url => {
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = url;
    audioPlayer.play();
  })
  .catch(error => {
    console.error('播放失败:', error);
    alert('无法播放此歌曲，请稍后再试');
  });
```

## 常见问题

### 1. 认证失败（401错误）

- 确保API密钥正确无误
- 检查`Authorization`头格式，应为`Bearer your_api_key_here`
- 确认API密钥尚未过期或被禁用

### 2. 请求被拒绝（403错误）

- 如果启用了IP白名单，确认您的IP地址在白名单中
- 检查您的请求是否来自授权的域名（ALLOWED_DOMAIN配置）

### 3. 请求过于频繁（429错误）

- 减少请求频率，遵守API的速率限制
- 考虑在客户端实现缓存以减少重复请求
- 联系服务提供者申请更高的请求配额

### 4. API响应缓慢

- 首次请求特定资源可能较慢，后续请求将使用缓存
- 不同音源的响应时间可能不同，优先选择响应较快的音源
- 尝试使用不同的音源组合以找到最佳性能

### 5. 如何批量处理歌曲

当前API不直接支持批量请求，但您可以:
- 在客户端实现并发请求逻辑
- 确保不超过API频率限制
- 考虑使用更复杂的队列系统进行大规模批处理 