---
description: 一键上传代码到 GitHub (Add, Commit, Push)
---

// turbo-all
1. 检查当前修改的状态
```bash
git status
```

2. 暂存所有已修改的文件
```bash
git add .
```

3. 提交记录到本地仓库 (自动携带时间戳)
```bash
git commit -m "Auto-upload from AntiGravity $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
```

4. 推送至远程仓库 origin master
```bash
git push origin master
```
