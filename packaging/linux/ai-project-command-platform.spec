Name:           ai-project-command-platform
Version:        %{app_version}
Release:        1%{?dist}
Summary:        Multi-project AI-assisted command platform
License:        Proprietary
URL:            https://github.com/FATELLS/ai-project-command-platform
Source0:        ai-project-command-platform-%{version}-linux-x64.tar.gz
Source1:        ai-project-command-platform.service
Source2:        platform.env
BuildArch:      x86_64
Requires(pre):  shadow-utils
Requires(post): systemd
Requires(preun): systemd
Requires(postun): systemd

%description
AI-assisted multi-project command platform with isolated project data,
structured proposals, human review, and controlled publishing.

%prep
%setup -q -n ai-project-command-platform-%{version}-linux-x64

%build

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/ai-project-command-platform
cp -a . %{buildroot}/opt/ai-project-command-platform/
install -D -m 0644 %{SOURCE1} %{buildroot}/usr/lib/systemd/system/ai-project-command-platform.service
install -D -m 0600 %{SOURCE2} %{buildroot}%{_sysconfdir}/ai-project-command-platform/platform.env
install -d -m 0750 %{buildroot}%{_sharedstatedir}/ai-project-command-platform/data

%pre
getent group aipcp >/dev/null || groupadd --system aipcp
getent passwd aipcp >/dev/null || useradd --system --gid aipcp --home-dir /var/lib/ai-project-command-platform --shell /sbin/nologin aipcp

%post
ENV_FILE="%{_sysconfdir}/ai-project-command-platform/platform.env"
CREDENTIAL_FILE="%{_sharedstatedir}/ai-project-command-platform/bootstrap-credentials.txt"
if ! grep -q '^PLATFORM_BOOTSTRAP_PASSWORD=.' "$ENV_FILE"; then
  PASSWORD="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"
  sed -i "s/^PLATFORM_BOOTSTRAP_PASSWORD=.*/PLATFORM_BOOTSTRAP_PASSWORD=$PASSWORD/" "$ENV_FILE"
  umask 077
  printf 'URL: http://127.0.0.1:4173\nUsername: admin\nPassword: %s\n' "$PASSWORD" > "$CREDENTIAL_FILE"
  chown root:root "$CREDENTIAL_FILE"
fi
chown -R aipcp:aipcp %{_sharedstatedir}/ai-project-command-platform
systemctl daemon-reload >/dev/null 2>&1 || true
systemctl enable --now ai-project-command-platform.service >/dev/null 2>&1 || true
if systemctl is-active --quiet ai-project-command-platform.service; then
  sed -i 's/^PLATFORM_BOOTSTRAP_PASSWORD=.*/PLATFORM_BOOTSTRAP_PASSWORD=/' "$ENV_FILE"
fi
echo "AI Project Command Platform: http://127.0.0.1:4173"
echo "首次凭据: sudo cat $CREDENTIAL_FILE"

%preun
if [ "$1" -eq 0 ]; then
  systemctl disable --now ai-project-command-platform.service >/dev/null 2>&1 || true
fi

%postun
systemctl daemon-reload >/dev/null 2>&1 || true

%files
%dir /opt/ai-project-command-platform
/opt/ai-project-command-platform/*
/usr/lib/systemd/system/ai-project-command-platform.service
%config(noreplace) %attr(0600,root,root) %{_sysconfdir}/ai-project-command-platform/platform.env
%dir %attr(0750,aipcp,aipcp) %{_sharedstatedir}/ai-project-command-platform
%dir %attr(0750,aipcp,aipcp) %{_sharedstatedir}/ai-project-command-platform/data

%changelog
* Fri Jul 24 2026 Codex <noreply@example.invalid> - %{app_version}-1
- Initial Windows/Linux packaged release
