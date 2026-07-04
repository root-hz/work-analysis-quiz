# 习题集 · 即测即评

移动端答题页面，支持手机浏览器直接打开。多个习题集合并为同一入口。

## 在线访问（推荐 · 无需同一 WiFi）

**https://root-hz.github.io/work-analysis-quiz/**

### 英语题库直达链接（手机可收藏）

| 题库 | 链接 |
|------|------|
| 英语听力（51 题） | https://root-hz.github.io/work-analysis-quiz/?quiz=english-listening |
| 英语阅读理解（40 题） | https://root-hz.github.io/work-analysis-quiz/?quiz=english-reading |
| 英语词汇题（79 题） | https://root-hz.github.io/work-analysis-quiz/?quiz=english-vocabulary |

打开首页后也可选择其他习题集：

- 工作分析（100 题）
- 马克思主义基本原理（262 题）

旧链接 `.../marxism/` 会自动跳转到马克思主义习题集。

（首次部署后可能需要 1-3 分钟生效）

## 🎮 冲塔跑酷（轻量版）

**https://root-hz.github.io/work-analysis-quiz/game/**

- 竖屏一键跳跃，自动向前奔跑
- 越过石头、躲开飞鸟，跑满 1000m 通关
- 通关显示：**AAA你黄哥最牛**
- 本地记录最高距离（BEST）

## 本地运行（同一 WiFi 内网访问）

```powershell
.\serve.ps1
```

手机与电脑同一 WiFi 下访问 `http://<电脑IP>:8080/`

## 部署到 GitHub Pages

```powershell
.\deploy.ps1
```

需先设置 Token：`$env:GITHUB_TOKEN = "ghp_你的Token"`

## 更新英语题库

修改桌面 PDF 后，重新解析并部署：

```powershell
py parse_english.py
.\deploy.ps1
```

## 功能说明

- 首页选择习题集，点击进入答题
- 答错即时显示正确答案，答对自动进入下一题
- 无时间限制
- 全部完成后显示得分，并汇总全部错题
