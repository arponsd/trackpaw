# Contributing to Trackpaw

Thanks for your interest in contributing! This guide covers how to set up the project, make changes, and submit pull requests.

## Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.0.0
- **Git**

### Getting Started

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/trackpaw.git
cd trackpaw

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type-check
pnpm typecheck
```

## Project Structure

```
trackpaw/
  packages/
    types/        # Shared TypeScript interfaces (internal)
    tracker/      # @trackpaw/tracker — Client-side SDK
    server/       # @trackpaw/server — Ingestion API + query engine
    dashboard/    # @trackpaw/dashboard — React analytics UI
  examples/
    express-app/  # Express.js integration example
    nextjs-app/   # Next.js App Router example
    standalone/   # Zero-config standalone demo
```

## Development Workflow

1. Create a branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature
   ```

2. Make your changes in the appropriate package(s).

3. Run tests for the package you changed:
   ```bash
   pnpm --filter @trackpaw/tracker test
   pnpm --filter @trackpaw/server test
   pnpm --filter @trackpaw/dashboard test
   ```

4. Run the full suite before submitting:
   ```bash
   pnpm build && pnpm test && pnpm typecheck
   ```

5. Create a changeset describing your change:
   ```bash
   pnpm changeset
   ```

6. Push and open a PR to `develop`.

## Pull Request Guidelines

- Target the `develop` branch (not `main`).
- Keep PRs focused — one feature or fix per PR.
- Include tests for new functionality.
- Update relevant README if the public API changes.
- Run `pnpm build && pnpm test && pnpm typecheck` before submitting.
- Add a changeset (`pnpm changeset`) for any user-facing change.

## Code Style

- TypeScript strict mode everywhere.
- ESLint + Prettier enforced (run `pnpm lint` and `pnpm format`).
- No external dependencies in the tracker package (zero-dep constraint).
- Parameterized queries only — never interpolate user input into SQL.

## Testing

- **Vitest** for all packages.
- Unit tests alongside the code they test in `__tests__/` directories.
- Adapter conformance tests in `packages/server/src/adapters/__tests__/`.
- Aim for >85% coverage on new code.

## Versioning

We use [Changesets](https://github.com/changesets/changesets) for versioning:

- **Patch** — Bug fixes, documentation
- **Minor** — New features, new adapters, new dashboard views
- **Major** — Breaking API changes

## Reporting Issues

- Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template for bugs.
- Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template for ideas.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
