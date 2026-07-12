import { createHmac, randomUUID, timingSafeEqual } from "crypto";

type LinkedInOAuthState = {
  userId: string;
  nonce: string;
  exp: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createLinkedInOAuthState(userId: string, secret: string) {
  const payload: LinkedInOAuthState = {
    userId,
    nonce: randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyLinkedInOAuthState(state: string, secret: string) {
  const [encoded, receivedSignature] = state.split(".");
  if (!encoded || !receivedSignature) throw new Error("Invalid LinkedIn authorization state");

  const expectedSignature = sign(encoded, secret);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("Invalid LinkedIn authorization state");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as LinkedInOAuthState;
  if (!payload.userId || payload.exp < Date.now()) {
    throw new Error("LinkedIn authorization expired. Please try connecting again.");
  }
  return payload;
}