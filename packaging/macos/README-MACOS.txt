AI Project Command Platform · macOS Apple Silicon portable

启动：
  ./start.sh

停止：
  ./stop.sh

默认地址：http://127.0.0.1:4173
首次管理员凭据会显示在终端，并写入 first-run-credentials.txt。

安装包内含虚谷 ARM64 镜像与原生驱动，不含任何项目数据、上传材料或 API Key。
运行要求 Docker Desktop 可用；虚谷数据保存在专用 Docker volume，材料保存在当前目录的 data 文件夹中。
