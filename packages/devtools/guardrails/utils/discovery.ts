import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import fg from 'fast-glob'
import ts from 'typescript'
import type { SourceMap } from '../types.js'

export function findRepoRoot(startFromFileUrl: string): string {
    let dir = dirname(fileURLToPath(startFromFileUrl))
    while (true) {
        if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
            return dir
        }
        const parent = dirname(dir)
        if (parent === dir) {
            throw new Error('guardrails: could not locate pnpm-workspace.yaml')
        }
        dir = parent
    }
}

const DEFAULT_IGNORE = [
    '**/__tests__/**',
    '**/*.spec.{ts,tsx}',
    '**/*.test.{ts,tsx}',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.expo/**',
    'packages/devtools/**',
]

const SOURCE_PATTERNS = [
    'apps/mobile/src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
]

export async function discoverSources(
    repoRoot: string,
    extraIgnore?: string[],
): Promise<SourceMap> {
    const paths = await fg(SOURCE_PATTERNS, {
        cwd: repoRoot,
        absolute: true,
        ignore: [...DEFAULT_IGNORE, ...(extraIgnore ?? [])],
    })

    const contents = await Promise.all(
        paths.map((p) => readFile(p, 'utf8')),
    )

    const sources: SourceMap = new Map()
    for (let i = 0; i < paths.length; i += 1) {
        const path = paths[i]
        const text = contents[i]
        const kind = path.endsWith('.tsx')
            ? ts.ScriptKind.TSX
            : ts.ScriptKind.TS
        const sf = ts.createSourceFile(
            path,
            text,
            ts.ScriptTarget.Latest,
            true,
            kind,
        )
        sources.set(path, sf)
    }
    return sources
}
