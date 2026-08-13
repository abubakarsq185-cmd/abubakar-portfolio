// Shared Chromium launch options for the tools that drive the real interface.
//
// Playwright picks up HTTP_PROXY / HTTPS_PROXY from the environment and applies
// it to every request the browser makes — including requests to localhost, and
// regardless of what NO_PROXY says. On a machine with a corporate or sandbox
// proxy that turns a 13ms page load into a 12.8 second one, which is not a
// hang but is indistinguishable from one: a 184-combination sweep goes from
// forty seconds to forty minutes.
//
// When the target is loopback there is nothing for a proxy to do, so we ask for
// a direct connection explicitly. A remote CHECK_BASE_URL keeps the
// environment's proxy, because there it may be the only route out.

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i;

export function launchOptions(base) {
  return LOOPBACK.test(base) ? { proxy: { server: 'direct://' } } : {};
}
