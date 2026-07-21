import { expect } from "@playwright/test";

// 共享账号（由 fixtures/server.mjs 创建），统一密码。
export const accounts = {
  admin: { login: "admin", password: "e2e-platform-admin-pw" },
  editor: { login: "e2e-editor", password: "e2e-platform-admin-pw" },
  viewer: { login: "e2e-viewer", password: "e2e-platform-admin-pw" },
  stdViewer: { login: "e2e-std-viewer", password: "e2e-platform-admin-pw" }
};

// 角色对应的 storageState 文件（由 global-setup.mjs 在每轮开始时生成）。
export function storageStatePath(name) {
  return `.e2e-auth/${name}.json`;
}

// storageState 已注入会话 cookie；直接进入受保护路由即可。
// 仅在需要显式走登录 UI 流程时才用 loginViaForm。
export async function login(_page, _account) {
  // 兼容旧调用：默认角色会话已在 use.storageState 注入，无需重复登录。
}

// 走真实登录 UI（仅在专门验证登录流程的 spec 中使用）。
export async function loginViaForm(page, account) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("账号").fill(account.login);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "登录平台" }).click();
  await expect(page).toHaveURL(/\/projects/);
}

// 以 API 方式登录并返回 { cookie, csrf }，用于在 UI 之外直接打接口。
export async function loginApi(baseURL, account) {
  const response = await fetch(`${baseURL}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginName: account.login, password: account.password })
  });
  if (!response.ok) throw new Error(`login failed: ${response.status}`);
  const payload = await response.json();
  const cookie = response.headers.get("set-cookie").split(";")[0];
  return { cookie, csrf: payload.csrfToken };
}

export async function api(baseURL, path, { cookie, csrf, method = "GET", body } = {}) {
  const headers = { cookie };
  if (csrf) headers["x-csrf-token"] = csrf;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: response.status, payload };
}
