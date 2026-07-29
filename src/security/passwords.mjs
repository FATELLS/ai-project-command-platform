import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const PASSWORD_PARAMS = Object.freeze({
  algorithm: "scrypt",
  N: 2 ** 15,
  r: 8,
  p: 3,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024
});

export function normalizeLoginName(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function validatePassword(password) {
  const value = String(password ?? "");
  const length = [...value].length;
  if (length < 12 || length > 128) throw new Error("密码长度必须为 12 至 128 个字符");
  return value;
}

function derive(password, salt, params = PASSWORD_PARAMS) {
  return scryptSync(String(password ?? ""), salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: params.maxmem
  });
}

export function hashPassword(password, options = {}) {
  const value = options.skipValidate ? String(password ?? "") : validatePassword(password);
  const salt = options.salt ?? randomBytes(16);
  const derived = derive(value, salt);
  return {
    passwordSalt: Buffer.from(salt).toString("base64"),
    passwordHash: derived.toString("base64"),
    passwordParamsJson: JSON.stringify(PASSWORD_PARAMS)
  };
}

export function verifyPassword(password, record) {
  try {
    const params = JSON.parse(record.passwordParamsJson);
    if (params.algorithm !== "scrypt") return false;
    const salt = Buffer.from(record.passwordSalt, "base64");
    const expected = Buffer.from(record.passwordHash, "base64");
    const actual = derive(String(password ?? ""), salt, params);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const dummySalt = Buffer.alloc(16, 0x5a);
export const DUMMY_PASSWORD_RECORD = Object.freeze(hashPassword("not-a-real-password", { salt: dummySalt }));
