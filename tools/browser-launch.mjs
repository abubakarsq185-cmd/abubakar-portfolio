// Shared Chromium launch options for the tools that drive the real interface.
//
// Chromium reads http_proxy / https_proxy / all_proxy from its own environment
// and routes everything through them — including requests to localhost. NO_PROXY
// does not reliably rescue this: a long list containing CIDR ranges and `::` is
// enough for the bypass rules to stop applying, and then every local page load
// makes a round trip through a proxy that has no business being involved.
//
// Measured against a server curl was answering in 4ms, loading one page:
//
//   default launch                 13051ms  status 200
//   proxy: { server: 'direct://' }    10ms  ERR_PROXY_CONNECTION_FAILED
//   proxy with a bypass list          42ms  status 405   (the proxy refuses)
//   proxy variables removed          184ms  status 200
//
// Only the last one is both fast and correct. `direct://` is worth calling out:
// it fails so quickly that a check measuring only elapsed time reads it as a
// spectacular success, which is exactly the trap it looks like.
//
// A remote CHECK_BASE_URL keeps the environment's proxy, because there it may
// be the only route out.

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i;
const PROXY_VAR = /^(https?_proxy|all_proxy)$/i;

export function launchOptions(base) {
  if (!LOOPBACK.test(base)) return {};
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (PROXY_VAR.test(key)) delete env[key];
  return { env };
}
