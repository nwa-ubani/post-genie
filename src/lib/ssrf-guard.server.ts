// Server-only SSRF guard: resolve hostname and reject private/loopback/link-local targets.
import { lookup } from "node:dns/promises";
import net from "node:net";

function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fe80:") || s.startsWith("fc") || s.startsWith("fd")) return true;
  if (s.startsWith("::ffff:")) {
    const v4 = s.slice(7);
    if (net.isIPv4(v4)) return isBlockedIPv4(v4);
  }
  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (url.port && !["", "80", "443"].includes(url.port)) {
    throw new Error("Only default HTTP(S) ports are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host.endsWith(".local") || host === "localhost") {
    throw new Error("Host not allowed");
  }
  const check = (addr: string, family: number) => {
    const blocked = family === 6 ? isBlockedIPv6(addr) : isBlockedIPv4(addr);
    if (blocked) throw new Error("URL resolves to a private or reserved address");
  };
  if (net.isIP(host)) {
    check(host, net.isIPv6(host) ? 6 : 4);
  } else {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length) throw new Error("Host did not resolve");
    for (const a of addrs) check(a.address, a.family);
  }
  return url;
}

// Fetch a user-supplied URL with SSRF guard applied to the initial target AND
// any redirect hops. Returns the final Response.
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = (await assertPublicHttpUrl(raw)).toString();
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      const next = new URL(loc, current).toString();
      await assertPublicHttpUrl(next);
      current = next;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}
