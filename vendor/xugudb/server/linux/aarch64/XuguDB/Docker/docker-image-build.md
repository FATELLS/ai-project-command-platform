# 数据库 Docker 镜像编译说明文档

> **注意**：以下命令假定您的终端工作路径位于 `Dockerfile` 文件同级目录。

## 编译镜像

```sh
# 使用 RedHat 系列发行版 Linux 系统作为运行环境
docker build -t xugu-database:12.9.9-20250714-aarch64 -f Dockerfile.RedHat ..
# 使用 Debian 系列发行版 Linux 系统作为运行环境
docker build -t xugu-database:12.9.9-20250714-aarch64 -f Dockerfile.Debian ..
```

## 保存镜像

```sh
docker save xugu-database:12.9.9-20250714-aarch64 >docker-xugu-database-12.9.9-20250714-aarch64.tar
```

## 加载镜像

```sh
docker load <docker-xugu-database-12.9.9-20250714-aarch64.tar
```

## 运行容器

> **注意**：若需要通过 `docker logs` 命令获取终端打印日志，请指定 `-t` 参数为容器分配 tty。

```sh
# 在运行时配置已命名空间化的内核参数，请参见：
# Configure namespaced kernel parameters (sysctls) at runtime (--sysctl)
# https://docs.docker.com/reference/cli/docker/container/run/#sysctl
# 设置容器中的各项资源限制参数，请参见：
# Set ulimits in container (--ulimit)
# https://docs.docker.com/reference/cli/docker/container/run/#ulimit
docker run --name xugu-database -td -p 5138:5138 xugu-database:12.9.9-20250714-aarch64
```
