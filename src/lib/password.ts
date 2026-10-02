import { pbkdf2, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `${ITERATIONS}.${salt}.${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [iterationsRaw, salt, hash] = storedHash.split(".");
  const iterations = Number(iterationsRaw);

  if (!iterations || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = await pbkdf2Async(password, salt, iterations, expected.length, DIGEST);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
