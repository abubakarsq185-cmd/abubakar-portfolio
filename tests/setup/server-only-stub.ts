/**
 * `server-only` throws by design when it is imported outside a React Server
 * Component. Integration tests import server services directly on purpose, so
 * the marker is aliased to this no-op. The guard still applies in the app build.
 */
export {};
