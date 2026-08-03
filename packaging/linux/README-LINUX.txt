AI Project Command Platform · Linux portable

启动：
  ./start.sh

停止：
  ./stop.sh

默认地址：http://127.0.0.1:4173
首次管理员凭据会显示在终端，并写入 first-run-credentials.txt。

安装包内含虚谷 Docker 镜像与原生驱动，不含任何项目数据、上传材料或 API Key。

== 容器运行时 ==

首次运行 start.sh 时会自动检测并安装容器运行时：
  - 如果已安装 podman 或 docker，直接使用。
  - 如果没有，自动通过系统包管理器安装 podman（无需 Docker Desktop）。
  - 选定的 CLI 会写入 .env.local 的 CONTAINER_CLI 变量。

如需手动指定，在 .env.local 中设置：
  CONTAINER_CLI=podman   （或 docker）

虚谷数据保存在专用容器 volume 中，材料保存在当前目录的 data 文件夹中。
