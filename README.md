# 习题集 · 即测即评

移动端答题页面，支持手机浏览器直接打开。

## 在线访问

| 习题集 | 链接 |
|--------|------|
| 工作分析（100 题） | https://root-hz.github.io/work-analysis-quiz/ |
| 马克思主义基本原理（262 题） | https://root-hz.github.io/work-analysis-quiz/marxism/ |

（首次部署后可能需要 1-3 分钟生效）

## 本地运行

```powershell
python -m http.server 8080 --bind 0.0.0.0
```

手机与电脑同一 WiFi 下访问：

- 工作分析：`http://<电脑IP>:8080/`
- 马克思主义：`http://<电脑IP>:8080/marxism/`

## 功能说明

- 点击选项作答，答错即时显示正确答案，答对自动进入下一题
- 无时间限制
- 全部完成后显示得分，并汇总全部错题