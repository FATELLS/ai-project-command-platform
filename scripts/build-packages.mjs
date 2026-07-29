#!/usr/bin/env node
// ============================================================
// 三平台安装包构建器
//
// 用法:
//   node scripts/build-packages.mjs all                    # SQLite 版全平台
//   node scripts/build-packages.mjs all --with-xugu        # 虚谷版全平台
//   node scripts/build-packages.mjs deb                    # 只构建 Linux .deb
//   node scripts/build-packages.mjs rpm --with-xugu        # 虚谷版 .rpm
//   node scripts/build-packages.mjs macos                  # 只构建 macOS .pkg
//   node scripts/build-packages.mjs win                    # 只构建 Windows .msi
//
// 前提: 先运行 npm run build:pkg 生成原生二进制
// 虚谷版前提: xugu-pkg/ 目录下有虚谷安装包解压内容
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(root, "dist");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const VERSION = pkg.version;
const NAME = "ai-platform";

// 是否构建虚谷版
const WITH_XUGU = process.argv.includes("--with-xugu");
const VARIANT = WITH_XUGU ? "xugu" : "sqlite";

const stage = join(distDir, "staging");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const target = process.argv[2] || "all";

// 虚谷安装包路径
const xuguPkgDir = join(root, "xugu-pkg");
const xuguEmbeddedIni = join(root, "xugu-config", "xugu.ini.embedded");

// ---- 检查虚谷安装包 ----
function checkXuguPkg() {
  if (!WITH_XUGU) return false;
  if (!existsSync(xuguPkgDir)) {
    console.error("错误: --with-xugu 需要先准备 xugu-pkg/ 目录");
    console.error("  请将虚谷安装包解压到 xugu-pkg/");
    console.error("  确保存在: xugu-pkg/BIN/, xugu-pkg/SETUP/, xugu-pkg/ODBC/");
    process.exit(1);
  }
  return true;
}

const hasXugu = checkXuguPkg();

// ---- 公共：准备应用文件 ----
function prepareAppFiles() {
  const appDir = join(stage, "app");
  mkdirSync(appDir, { recursive: true });
  cpSync(join(root, "public"), join(appDir, "public"), { recursive: true });
  cpSync(join(root, "src", "db", "migrations"), join(appDir, "migrations"), { recursive: true });
  if (existsSync(join(root, "fixtures"))) {
    cpSync(join(root, "fixtures"), join(appDir, "fixtures"), { recursive: true });
  }

  // 虚谷版：打包虚谷二进制 + 最小配置 + ODBC 驱动
  if (hasXugu) {
    const xuguDir = join(appDir, "xugu");
    mkdirSync(xuguDir, { recursive: true });

    // 虚谷数据库二进制
    cpSync(join(xuguPkgDir, "BIN"), join(xuguDir, "BIN"), { recursive: true });

    // 嵌入式 xugu.ini（最小内存配置）
    mkdirSync(join(xuguDir, "SETUP"), { recursive: true });
    cpSync(xuguEmbeddedIni, join(xuguDir, "SETUP", "xugu.ini"));

    // 虚谷初始化相关文件
    if (existsSync(join(xuguPkgDir, "SETUP", "types.ini"))) {
      cpSync(join(xuguPkgDir, "SETUP", "types.ini"), join(xuguDir, "SETUP", "types.ini"));
    }
    if (existsSync(join(xuguPkgDir, "SETUP", "mount.ini"))) {
      cpSync(join(xuguPkgDir, "SETUP", "mount.ini"), join(xuguDir, "SETUP", "mount.ini"));
    }

    // ODBC 驱动
    const odbcSrc = join(xuguPkgDir, "ODBC");
    if (existsSync(odbcSrc)) {
      const odbcDest = join(appDir, "odbc");
      mkdirSync(odbcDest, { recursive: true });
      cpSync(odbcSrc, odbcDest, { recursive: true });
    }

    console.log(`  已打包虚谷数据库 (嵌入式配置: ${join(xuguDir, "SETUP", "xugu.ini")})`);
  }

  return appDir;
}

// ---- 启动脚本（虚谷版需要先启 DB）----
function generateStartScript(platform) {
  if (!hasXugu) {
    // SQLite 版：直接启动应用
    if (platform === "win") {
      return `@echo off\r\ncd /d "%~dp0"\r\nai-platform.exe server.mjs\r\n`;
    }
    return `#!/bin/bash\ncd "$(dirname "$0")"\nexec ./ai-platform server.mjs\n`;
  }

  // 虚谷版：先启虚谷，等就绪，再启应用
  if (platform === "win") {
    return `@echo off
cd /d "%~dp0"
start /b xugu\\BIN\\xugu_server.exe --child
echo 等待虚谷数据库启动...
ping 127.0.0.1 -n 8 >nul
set XUGU_HOST=127.0.0.1
set XUGU_PORT=5138
ai-platform.exe server.mjs
`;
  }
  return `#!/bin/bash
cd "$(dirname "$0")"
# 启动虚谷数据库（嵌入式模式，~200MB 内存）
./xugu/BIN/xugu_server --child &
XUGU_PID=$!
echo "等待虚谷数据库启动..."
for i in $(seq 1 30); do
  if ./xugu/BIN/xgconsole -h 127.0.0.1 -P 5138 -u SYSDBA -p SYSDBA -c "SELECT 1" >/dev/null 2>&1; then
    echo "虚谷已就绪 (${i}s)"
    break
  fi
  [ "$i" -eq 30 ] && { echo "虚谷启动失败"; exit 1; }
  sleep 1
done
export XUGU_HOST=127.0.0.1
export XUGU_PORT=5138
export XUGU_USER=SYSDBA
export XUGU_PASS=SYSDBA
exec ./ai-platform server.mjs
`;
}

// ============================================================
// Linux: .deb + .rpm
// ============================================================
function buildDeb() {
  console.log(`\n=== 构建 .deb (${VARIANT} 版) ===\n`);
  const appDir = prepareAppFiles();

  const debRoot = join(stage, "deb");
  const installPrefix = join(debRoot, "opt", "ai-platform");
  mkdirSync(installPrefix, { recursive: true });

  // 二进制 + 资源
  const bin = join(distDir, `ai-platform-node22-linux-x64`);
  if (!existsSync(bin)) { console.error("缺少 Linux 二进制，请先运行 npm run build:pkg"); return; }
  cpSync(bin, join(installPrefix, "ai-platform"));
  cpSync(appDir, installPrefix, { recursive: true });

  // 启动脚本（虚谷版会先启 DB）
  writeFileSync(join(installPrefix, "start.sh"), generateStartScript("linux"));
  execSync(`chmod +x ${join(installPrefix, "start.sh")}`);

  // systemd 服务
  const systemdDir = join(debRoot, "etc", "systemd", "system");
  mkdirSync(systemdDir, { recursive: true });
  writeFileSync(join(systemdDir, "ai-platform.service"), `[Unit]
Description=AI Project Command Platform (${VARIANT})
After=network.target

[Service]
Type=simple
ExecStart=/opt/ai-platform/start.sh
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PLATFORM_DATA_DIR=/var/lib/ai-platform

[Install]
WantedBy=multi-user.target
`);

  // 数据目录
  const dataDir = join(debRoot, "var", "lib", "ai-platform");
  mkdirSync(dataDir, { recursive: true });

  // DEBIAN/control
  const debianDir = join(debRoot, "DEBIAN");
  mkdirSync(debianDir, { recursive: true });
  writeFileSync(join(debianDir, "control"), `Package: ai-platform${hasXugu ? "-xugu" : ""}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Depends: libc6${hasXugu ? ", libaio1" : ""}
Maintainer: AI Project Command Platform
Description: AI Project Command Platform (${VARIANT} variant)
 Multi-project, template-driven, AI-assisted project management platform.
`);

  // postinst
  writeFileSync(join(debianDir, "postinst"), `#!/bin/bash
systemctl daemon-reload
systemctl enable ai-platform
systemctl start ai-platform
echo ""
echo "AI Platform (${VARIANT}) 已安装并启动: http://localhost:4173"
echo "数据目录: /var/lib/ai-platform"
${hasXugu ? `echo "数据库: 虚谷 (~200MB 内存, 嵌入式配置)"` : `echo "数据库: SQLite (嵌入式)"`}
echo "管理: systemctl {start|stop|restart|status} ai-platform"
`);
  execSync(`chmod +x ${join(debianDir, "postinst")}`);

  // prerm
  writeFileSync(join(debianDir, "prerm"), `#!/bin/bash
systemctl stop ai-platform || true
systemctl disable ai-platform || true
`);
  execSync(`chmod +x ${join(debianDir, "prerm")}`);

  // 构建 .deb
  const suffix = hasXugu ? "-xugu" : "";
  const debFile = join(distDir, `ai-platform${suffix}_${VERSION}_amd64.deb`);
  execSync(`dpkg-deb --build ${debRoot} ${debFile}`);
  console.log(`  产出: ${debFile}`);
}

function buildRpm() {
  console.log("\n=== 构建 .rpm (RHEL/CentOS/Fedora) ===\n");

  // 检查 rpmbuild
  try { execSync("which rpmbuild"); } catch {
    console.error("缺少 rpmbuild，请安装: yum install rpm-build");
    return;
  }

  const appDir = prepareAppFiles();
  const rpmTop = join(stage, "rpm");
  for (const d of ["BUILD", "RPMS", "SOURCES", "SPECS", "SRPMS"]) {
    mkdirSync(join(rpmTop, d), { recursive: true });
  }

  // 打 tarball
  const tarRoot = join(stage, "rpm-tar", `ai-platform-${VERSION}`);
  const installPrefix = join(tarRoot, "opt", "ai-platform");
  mkdirSync(installPrefix, { recursive: true });

  const bin = join(distDir, `ai-platform-node22-linux-x64`);
  if (!existsSync(bin)) { console.error("缺少 Linux 二进制"); return; }
  cpSync(bin, join(installPrefix, "ai-platform"));
  cpSync(appDir, installPrefix, { recursive: true });

  writeFileSync(join(installPrefix, "start.sh"), generateStartScript("linux"));
  execSync(`chmod +x ${join(installPrefix, "start.sh")}`);

  // systemd
  mkdirSync(join(tarRoot, "etc", "systemd", "system"), { recursive: true });
  writeFileSync(join(tarRoot, "etc", "systemd", "system", "ai-platform.service"),
`[Unit]
Description=AI Project Command Platform
After=network.target

[Service]
Type=simple
ExecStart=/opt/ai-platform/start.sh
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PLATFORM_DATA_DIR=/var/lib/ai-platform

[Install]
WantedBy=multi-user.target
`);

  mkdirSync(join(tarRoot, "var", "lib", "ai-platform"), { recursive: true });

  execSync(`tar -czf ${join(rpmTop, "SOURCES", `ai-platform-${VERSION}.tar.gz`)} -C ${join(stage, "rpm-tar")} .`, { stdio: "pipe" });

  // spec 文件
  writeFileSync(join(rpmTop, "SPECS", "ai-platform.spec"),
`Name:           ai-platform
Version:        ${VERSION}
Release:        1%{?dist}
Summary:        AI Project Command Platform
License:        Proprietary
Source0:        %{name}-%{version}.tar.gz
AutoReqProv:    no

%description
Multi-project, template-driven, AI-assisted project management platform.

%prep
%setup -q -c

%build

%install
mkdir -p %{buildroot}/opt/ai-platform
cp -r opt/ai-platform/* %{buildroot}/opt/ai-platform/
mkdir -p %{buildroot}/etc/systemd/system
cp etc/systemd/system/ai-platform.service %{buildroot}/etc/systemd/system/
mkdir -p %{buildroot}/var/lib/ai-platform

%files
/opt/ai-platform
/etc/systemd/system/ai-platform.service
%dir /var/lib/ai-platform

%post
systemctl daemon-reload
systemctl enable ai-platform
systemctl start ai-platform
echo ""
echo "AI Platform 已安装并启动: http://localhost:4173"

%preun
systemctl stop ai-platform || true
systemctl disable ai-platform || true

%changelog
* $(date '+%a %b %d %Y') AI Platform ${VERSION}
- Initial package
`);

  execSync(`rpmbuild -bb --define "_topdir ${rpmTop}" ${join(rpmTop, "SPECS", "ai-platform.spec")}`, { stdio: "inherit" });

  // 找到生成的 rpm 并复制到 dist
  const rpmArch = join(rpmTop, "RPMS", "x86_64");
  if (existsSync(rpmArch)) {
    for (const f of require("node:fs").readdirSync(rpmArch)) {
      if (f.endsWith(".rpm")) {
        cpSync(join(rpmArch, f), join(distDir, f));
        console.log(`  产出: ${join(distDir, f)}`);
      }
    }
  }
}

// ============================================================
// macOS: .pkg
// ============================================================
function buildMacOS() {
  console.log("\n=== 构建 macOS .pkg ===\n");

  try { execSync("which pkgbuild"); } catch {
    console.error("缺少 pkgbuild，请在 macOS 上构建");
    return;
  }

  const appDir = prepareAppFiles();

  for (const arch of ["arm64", "x64"]) {
    const bin = join(distDir, `ai-platform-node22-macos-${arch}`);
    if (!existsSync(bin)) { console.log(`跳过 macos-${arch}（无二进制）`); continue; }

    const pkgRoot = join(stage, `macos-${arch}`);
    const installPrefix = join(pkgRoot, "opt", "ai-platform");
    mkdirSync(installPrefix, { recursive: true });

    cpSync(bin, join(installPrefix, "ai-platform"));
    execSync(`chmod +x ${join(installPrefix, "ai-platform")}`);
    cpSync(appDir, installPrefix, { recursive: true });

    // launchd plist
    const launchAgents = join(pkgRoot, "Library", "LaunchAgents");
    mkdirSync(launchAgents, { recursive: true });
    writeFileSync(join(launchAgents, "com.ai-platform.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ai-platform</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/ai-platform/ai-platform</string>
    <string>server.mjs</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PLATFORM_DATA_DIR</key>
    <string>/var/lib/ai-platform</string>
  </dict>
</dict>
</plist>
`);

    // scripts
    const scriptsDir = join(stage, `macos-${arch}-scripts`);
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(join(scriptsDir, "postinstall"), `#!/bin/bash
launchctl load /Library/LaunchAgents/com.ai-platform.plist 2>/dev/null || true
echo ""
echo "AI Platform 已安装并启动: http://localhost:4173"
`);
    execSync(`chmod +x ${join(scriptsDir, "postinstall")}`);

    const outFile = join(distDir, `ai-platform_${VERSION}_macos_${arch}.pkg`);
    execSync(`pkgbuild \
      --root ${pkgRoot} \
      --scripts ${scriptsDir} \
      --identifier com.ai-platform \
      --version ${VERSION} \
      ${outFile}`);
    console.log(`  产出: ${outFile}`);
  }
}

// ============================================================
// Windows: .msi (用 WiX)
// ============================================================
function buildWindows() {
  console.log("\n=== 构建 Windows .msi ===\n");

  // 检查工具链
  let hasWix = false;
  try { execSync("where candle.exe"); hasWix = true; } catch {}
  if (!hasWix) {
    try { execSync("where dotnet"); hasWix = "dotnet"; } catch {}
  }
  if (!hasWix) {
    console.error("缺少 WiX Toolset，请安装: dotnet tool install --global wix");
    console.error("  或下载: https://wixtoolset.org/releases/");
    return;
  }

  const appDir = prepareAppFiles();
  const winRoot = join(stage, "win");
  const installDir = join(winRoot, "opt", "ai-platform");
  mkdirSync(installDir, { recursive: true });

  const bin = join(distDir, `ai-platform-node22-win-x64.exe`);
  if (!existsSync(bin)) { console.error("缺少 Windows 二进制"); return; }
  cpSync(bin, join(installDir, "ai-platform.exe"));
  cpSync(appDir, installDir, { recursive: true });

  // 启动脚本 (bat)
  writeFileSync(join(installDir, "start.bat"), generateStartScript("win"));

  // WiX 配置文件
  const wixDir = join(stage, "wix");
  mkdirSync(wixDir, { recursive: true });
  const wxs = join(wixDir, "ai-platform.wxs");
  writeFileSync(wxs, `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Package Name="AI Project Command Platform" Manufacturer="AI Platform" Version="${VERSION}" Language="1033" Codepage="1252">
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />

    <Property Id="INSTALLDIR" Value="C:\\Program Files\\AI Platform" />

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="AI Platform">
          <Component Id="MainApp" Guid="*" Win64="yes">
            <File Id="MainExe" Source="${join(installDir, "ai-platform.exe").replace(/\\/g, "\\\\")}" KeyPath="yes" />
            <File Id="StartBat" Source="${join(installDir, "start.bat").replace(/\\/g, "\\\\")}" />
          </Component>
          <Directory Id="PublicDir" Name="public">
            <Component Id="PublicFiles" Guid="*" Win64="yes">
              <File Source="${join(installDir, "public", "index.html").replace(/\\/g, "\\\\")}" />
            </Component>
          </Directory>
        </Directory>
      </Directory>
    </Directory>

    <Feature Id="Complete" Level="1">
      <ComponentRef Id="MainApp" />
      <ComponentRef Id="PublicFiles" />
    </Feature>

    <UI>
      <UIRef Id="WixUI_InstallDir" />
      <Property Id="WIXUI_INSTALLDIR" Value="INSTALLDIR" />
    </UI>

    <CustomAction Id="StartApp" Directory="INSTALLDIR" ExeCommand="ai-platform.exe server.mjs" Execute="deferred" Impersonate="no" Return="asyncNoWait" />
    <InstallExecuteSequence>
      <Custom Action="StartApp" After="InstallFiles" Condition="NOT Installed" />
    </InstallExecuteSequence>
  </Package>
</Wix>
`);

  const outFile = join(distDir, `ai-platform_${VERSION}_windows_x64.msi`);

  if (hasWix === "dotnet") {
    execSync(`dotnet wix build -o "${outFile}" "${wxs}"`, { stdio: "inherit" });
  } else {
    execSync(`candle -o ${join(wixDir, "ai-platform.wixobj")} ${wxs}`, { stdio: "inherit" });
    execSync(`light -o "${outFile}" ${join(wixDir, "ai-platform.wixobj")}`, { stdio: "inherit" });
  }
  console.log(`  产出: ${outFile}`);
}

// ============================================================
// 主入口
// ============================================================
switch (target) {
  case "deb":   buildDeb(); break;
  case "rpm":   buildRpm(); break;
  case "macos": buildMacOS(); break;
  case "win":   buildWindows(); break;
  case "all":
    buildDeb();
    buildRpm();
    buildMacOS();
    buildWindows();
    break;
  default:
    console.log(`用法: node build-packages.mjs [deb|rpm|macos|win|all]`);
    process.exit(1);
}

console.log("\n=== 全部完成 ===");
console.log(`输出目录: ${distDir}`);
