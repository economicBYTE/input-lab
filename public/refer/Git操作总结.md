Git操作总结
	新电脑访问远程仓库需要权限
		检查 SSH 密钥是否已生成
			ls -al ~/.ssh
		生成新的 SSH 密钥
			ssh-keygen -t rsa -b 4096 -C "2830776783@qq.com"
		 添加 SSH 密钥到 SSH 代理
			eval "$(ssh-agent -s)"
			ssh-add ~/.ssh/id_rsa
		将 SSH 公钥添加到 GitHub
			cat ~/.ssh/id_rsa.pub
			登录到 GitHub，进入 Settings > SSH and GPG keys，点击 New SSH key，粘贴公钥内容，并保存。
		测试 SSH 连接
			ssh -T git@github.com
			成功返回
				Hi economicBYTE! You've successfully authenticated, but GitHub does not provide shell access.
	基础操作
		配置账号邮箱
			git config --global user.name “your_username” #设置用户名
			git config --global user.email “your_registered_Email” #设置邮箱地址
		新建本地仓库（初始化）
			git init
		将文件添加到缓存队列
			git add filename
		查看当前状况
			git status
		绑定仓库地址并上传文件
			git remote add origin  https://github.com/NebulaTheus/myapp.git 
			git push -u origin master
		 更换绑定的远程仓库地址
			git remote set-url origin https://new-url.com/username/repo.git
			验证
				git remote -v
		将仓库文件下载到本地
			git clone 
		追加提交
			git commit --amend
	分支操作
		新建分支，切换到分支
			git branch
			git checkout
			touch 创建文件
		分支合并
			假如 AB 两个分支，A 需要仅合并 B 分支上的某个 commit，使用 git 命令应该怎么操作
			切换到分支 A：
				git checkout A
			找到 B 分支上需要合并的 commit 的哈希值： 查看 B 分支的提交历史，找到你想要的那个 commit 的哈希值（例如 abc1234）。
				git log B
			使用 git cherry-pick 将该 commit 合并到 A 分支：
				git cherry-pick abc1234
	Git Action
	Pre_Commit / Pre_Push
		Husky
			npm install husky
		npx husky install
		在创建的husky目录下对于的提交检查下编写检查代码。
	问题大全
		把当前未提交/未暂存的修改先保存起来（stash）切到干净代码状态运行编译/执行 怎么做？
			# 1. 将当前代码修改保存并回到干净状态
				git stash push -m "temp build"
			# 2. 执行你想运行的编译/测试等逻辑
				npm run build   # 或 yarn build、pnpm build...
			# 3. 恢复之前的修改（不会删除 stash）
				git stash pop
			# 4. （可选）恢复后重新编译一次
				npm run build
			安全使用
				git stash push -u -m "temp build"
				npm run build
				git stash apply  # 只恢复，不删除 stash