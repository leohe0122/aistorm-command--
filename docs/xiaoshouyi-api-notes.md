# 销售易 OpenAPI 关键信息（来源：官方手册 v2011）

## 认证方式（密码模式）

**Token 获取 URL：**
```
POST https://api.xiaoshouyi.com/oauth2/token.action
Content-Type: application/x-www-form-urlencoded
```

**请求参数：**
- `grant_type` = `password`
- `client_id` = 连接器 client_id
- `client_secret` = 连接器 client_secret
- `redirect_uri` = 连接器注册的回调地址
- `username` = 销售易用户名
- `password` = 账号密码 + 8位安全令牌（例如：密码123456，安全令牌ABCDEFGH → `123456ABCDEFGH`）

**返回字段：**
- `access_token`：调用 API 的凭证，有效期 2 小时
- `refresh_token`：刷新令牌，有效期 2 个月
- `token_type`：`Bearer`
- `id`：当前授权用户唯一标识

**刷新 Token URL：**
```
POST https://api.xiaoshouyi.com/oauth2/token.action
grant_type=refresh_token&refresh_token=<token>&client_id=...&client_secret=...
```

## 调用 API 通用规范

- **Base URL：** `https://api.xiaoshouyi.com`
- **认证 Header：** `Authorization: Bearer <access_token>`
- **字符编码：** UTF-8
- **REST API 路径：** `/rest/data/v2.0/xobjects/<object>`

## 销售机会（Opportunity）接口

| 操作 | 方法 | URL |
|------|------|-----|
| 获取描述 | GET | `/rest/data/v2.0/xobjects/opportunity/description` |
| 创建 | POST | `/rest/data/v2.0/xobjects/opportunity` |
| 更新 | PATCH | `/rest/data/v2.0/xobjects/opportunity/{id}` |
| 删除 | DELETE | `/rest/data/v2.0/xobjects/opportunity/{id}` |
| 获取详情 | GET | `/rest/data/v2.0/xobjects/opportunity/{id}` |

## 联系人（Contact）接口

| 操作 | 方法 | URL |
|------|------|-----|
| 获取描述 | GET | `/rest/data/v2.0/xobjects/contact/description` |
| 创建 | POST | `/rest/data/v2.0/xobjects/contact` |
| 更新 | PATCH | `/rest/data/v2.0/xobjects/contact/{id}` |
| 删除 | DELETE | `/rest/data/v2.0/xobjects/contact/{id}` |
| 获取详情 | GET | `/rest/data/v2.0/xobjects/contact/{id}` |

## 注意事项

1. 安全令牌需要从销售易个人设置中获取（8位字符串）
2. password 字段 = 账号密码 + 安全令牌（直接拼接，无分隔符）
3. access_token 有效期 2 小时，需要定期刷新
4. 接口访问有频次限制
