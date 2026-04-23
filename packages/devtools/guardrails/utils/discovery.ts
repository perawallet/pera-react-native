import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import fg from 'fast-glob'

export function findRepoRoot(startFromFileUrl: string): string {
    let dir = dirname(fileURLToPath(startFromFileUrl))
    while (true) {
        if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
            return dir
        }
        const parent = dirname(dir)
        if (parent === dir) {
            throw new Error(
                `guardrails: could not locate pnpm-workspace.yaml starting from ${startFromFileUrl}`,
            )
        }
        dir = parent
    }
}

export async function discoverFilePaths(
    repoRoot: string,
    extraIgnore: string[] = [],
): Promise<string[]> {
    const patterns = [
        'apps/mobile/src/**/*.{ts,tsx}',
        'packages/*/src/**/*.{ts,tsx}',
    ]
    const ignore = [
        '**/__tests__/**',
        '**/*.spec.{ts,tsx}',
        '**/*.test.{ts,tsx}',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.expo/**',
        'packages/devtools/**',
        ...extraIgnore,
    ]
    return fg(patterns, { cwd: repoRoot, absolute: true, ignore })
}
