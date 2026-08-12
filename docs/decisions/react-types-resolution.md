# Why `package.json` extends Next's peer dependencies

The mobile app runs Expo SDK 52, which is built on React 18.3.1, so
`apps/mobile` correctly depends on `@types/react@~18.3.12`. The web app runs
React 19 and depends on `@types/react@19.0.2`. Both are right for their target.

`next@15.5.4` does not declare `@types/react` as a peer dependency, but its
shipped type definitions (`next/dist/styled-jsx/types/*.d.ts`) do
`import ... from 'react'`. With nothing to pin them to, those imports resolved
through pnpm's hoisted fallback in `node_modules/.pnpm/node_modules`, which held
the React 18 copy that only exists for the mobile app.

That put two versions of `@types/react` into one TypeScript program. React 18's
types declare `JSX` as a **global** namespace; React 19's moved it under
`React.JSX` and declare no global. The global from 18 therefore won, so JSX
children were typed by React 18 while components typed their props with
`ReactNode` imported from React 19, and the compiler reported:

```
Type 'ReactNode' is not assignable to type 'React.ReactNode'.
```

— the same name from two packages.

The fix declares the peer relationship that Next omits, via
`pnpm.packageExtensions`. pnpm then resolves Next's `@types/react` from the
importer, so under `apps/web` it gets 19.0.2 and there is a single copy in the
program. `apps/mobile` is untouched and keeps the React 18 types Expo needs.

Alternatives rejected:

- A workspace-wide `pnpm.overrides` for `@types/react` would force React 19
  types onto Expo SDK 52, which expects React 18.
- A `paths` mapping in `apps/web/tsconfig.json` would also be honoured by the
  Next bundler, pointing runtime imports of `react` at a types-only package.
