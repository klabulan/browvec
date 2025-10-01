# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript SDK; submodules include `database/` for sql.js wrappers, `embedding/` for provider logic, `pipeline/` for vector workflows, and `search/` for retrieval helpers.
- Browser assets and demo harnesses sit in `public/` and `examples/`; long-running worker scripts live under `scripts/`.
- Generated build output lands in `dist/`, wasm artifacts and toolchain assets in `emsdk/`, while Playwright traces collect in `playwright-report/`.
- Tests are split across `tests/unit`, `tests/embedding`, `tests/environment`, and `tests/e2e`; mirror this layout when adding suites.

## Build, Test, and Development Commands
- `npm run build:wasm` - rebuilds sqlite-vec wasm using `scripts/build-wasm.sh`; required after tweaking `ext/` or upgrading emsdk.
- `npm run build:sdk` - bundles the library with Vite into `dist/`.
- `npm run dev` - boots the local worker demo (`scripts/dev-server.sh`); use for manual workflows.
- `npm run dev:vite` and `npm run preview` - start the Vite dev server or serve compiled assets over HTTPS.
- `npm run test`, `npm run test:e2e`, `npm run test:all` - run Vitest units, Playwright scenarios, or both; append `--coverage` to Vitest for V8 reports.

## Coding Style & Naming Conventions
- TypeScript is authored with strict compiler settings and ES2020 modules; keep 2-space indentation and trailing commas on multiline literals.
- Export surface flows through `src/index.ts`; expose shared types from `src/types` to avoid deep imports.
- Use PascalCase for classes (`Database`, `WorkerRPC`), camelCase for functions and variables, and SCREAMING_SNAKE_CASE for constants.
- Shell helpers in `scripts/` should remain POSIX-compatible; keep Playwright helpers in TypeScript.

## Testing Guidelines
- Place synchronous logic in `tests/unit/*.test.ts`; embedding-specific suites belong under `tests/embedding/**`.
- Environment initialization (OPFS, workers, wasm loading) should extend `tests/environment/*.test.ts`.
- UI and integration coverage resides in `tests/e2e/*.spec.ts` and is orchestrated by `playwright.config.ts`.
- Target >90% statement coverage on critical modules; record failing Playwright runs so traces land in `playwright-report/`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits as in `feat(embedding): ...` and `fix(search): ...`; mention schema or wasm rebuild requirements in the body.
- Keep commits atomic, referencing task IDs when applicable.
- PRs must describe motivation, summarize changes, list validation commands (e.g., `npm run build`, `npm run test:all`), and link issues or tickets.
- Attach screenshots or logs for UI/e2e work and call out skipped tests or temporary flags.

## Configuration & Secrets
- Store API keys in `.env.test` or local `.env` files; never commit keys.
- Playwright and Vitest respect `process.env`; document required variables in PRs that introduce new ones.
