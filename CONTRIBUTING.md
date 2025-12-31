# Contributing to Pera Wallet

Welcome! We're glad you're here. This guide will help you get started with contributing to the Pera Wallet React Native project.

## Getting Started

1.  **Environment Setup**: Follow the [Prerequisites and Install instructions](README.md#prerequisites) in the main README.
2.  **Initialize**: Run `pnpm install` and then `pnpm run setup`. The setup command installs Git hooks that automatically handle linting and formatting.
3.  **Explore**: Familiarize yourself with the [Workspace layout](README.md#workspace-layout). Business logic lives in `packages/*` and UI lives in `apps/mobile`.

## Core Values

When contributing, keep these principles in mind:

- **Reusability & Scalability**: We prioritize building flexible, reusable components and patterns to accelerate future development.
- **Clean Code**: Minimize in-code comments. Code should be self-documenting; comments should explain _why_, not _what_.
- **Quality Documentation**: Keep external documentation (like this guide and `docs/*`) accurate and up to date, but keep it concise.

## Workflow & Standards

To keep the codebase healthy, we follow these standards:

- **Style Guide**: Please read the [Style Guide](docs/STYLE_GUIDE.md) before making changes. It covers naming conventions, TypeScript rules, and component patterns.
- **Branching**: Use the format `<your-name>/<feature-or-fix>` for branch names (e.g., `john/add-login-screen`).
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/).
- **Pull Requests**:
    - Target the `main` branch.
    - Ensure all tests pass.
    - Use **Squash Merge** when merging.

## Additional Documentation

- [Architecture & State Management](docs/ARCHITECTURE.md)
- [Testing Guide](docs/TESTING.md)
- [Security Best Practices](docs/SECURITY.md)
- [Performance Guidelines](docs/PERFORMANCE.md)

Thank you for contributing!
