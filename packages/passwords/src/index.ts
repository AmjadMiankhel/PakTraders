/**
 * Argon2id password hashing.
 *
 * `argon2` (the native Node binding) compiles C++ at install time. Managed hosts
 * such as Hostinger ship Python 3.6, which node-gyp refuses to run, so every
 * deployment failed at `pnpm install`. `hash-wasm` implements the same Argon2id
 * algorithm in WebAssembly: identical `$argon2id$...` hashes, no compiler, no
 * Python, no platform-specific binary.
 *
 * Parameters follow the OWASP minimum (19 MiB, 2 iterations, 1 lane). Existing
 * hashes created with other parameters still verify because the encoded hash
 * carries its own cost factors.
 */
import { argon2Verify, argon2id } from "hash-wasm";

export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19_456,
  hashLength: 32,
} as const;

/** Hashes a plaintext password into a PHC-encoded Argon2id string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  return argon2id({
    password,
    salt,
    ...ARGON2_PARAMS,
    outputType: "encoded",
  });
}

/** Constant-time verification of a password against a stored PHC hash. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}
