/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

interface Suite {
    manifest: string
    workflow: string
}

const SUITES: readonly Suite[] = [
    {
        manifest: 'conformance/package.json',
        workflow: '.github/workflows/ci-localnet-conformance.yml',
    },
    {
        manifest: 'conformance-evm/package.json',
        workflow: '.github/workflows/ci-evm-conformance.yml',
    },
]

const WORKSPACE_PROTOCOL = 'workspace:'

const dirOf = (path: string): string => path.split('/').slice(0, -1).join('/')

const join = (base: string, path: string): string =>
    base === '' ? path : `${base}/${path}`

const unquote = (raw: string): string => {
    const value = raw.trim()
    const quote = value.charAt(0)
    if (quote === "'" || quote === '"') {
        const end = value.indexOf(quote, 1)
        return end === -1 ? value.slice(1) : value.slice(1, end)
    }
    const comment = value.indexOf(' #')
    return (comment === -1 ? value : value.slice(0, comment)).trim()
}

const indentOf = (line: string): number => line.length - line.trimStart().length

/**
 * The block-sequence entries under a nested mapping key, and the line of that
 * key (1-based, 0 when absent). Handles the block style every workflow and
 * pnpm-workspace.yaml here is written in; a flow sequence (`[a, b]`) reads as
 * empty, which reports every path as missing rather than passing silently.
 */
const yamlList = (
    raw: string,
    keyPath: readonly string[],
): { items: string[]; line: number } => {
    const stack: { indent: number; key: string }[] = []
    const items: string[] = []
    let line = 0
    const lines = raw.split('\n')
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? ''
        const trimmed = text.trim()
        if (trimmed === '' || trimmed.startsWith('#')) continue
        const indent = indentOf(text)
        const item = /^-\s+(.*)$/.exec(trimmed)
        if (item !== null) {
            const inside =
                stack.length === keyPath.length &&
                stack.every((s, k) => s.key === keyPath[k]) &&
                indent >= (stack[stack.length - 1]?.indent ?? 0)
            if (inside) items.push(unquote(item[1] ?? ''))
            continue
        }
        const key = /^([^\s:#][^:#]*?):(\s|$)/.exec(trimmed)
        if (key === null) continue
        while (
            stack.length > 0 &&
            (stack[stack.length - 1]?.indent ?? 0) >= indent
        ) {
            stack.pop()
        }
        stack.push({ indent, key: unquote(key[1] ?? '') })
        if (
            stack.length === keyPath.length &&
            stack.every((s, k) => s.key === keyPath[k])
        ) {
            line = i + 1
        }
    }
    return { items, line }
}

interface ReadCtx {
    readFile(path: string): string | undefined
    listDir(path: string): string[] | undefined
}

const nameOf = (ctx: ReadCtx, dir: string): string | undefined => {
    const raw = ctx.readFile(`${dir}/package.json`)
    if (raw === undefined) return undefined
    try {
        const name = (JSON.parse(raw) as { name?: unknown }).name
        return typeof name === 'string' ? name : undefined
    } catch {
        return undefined
    }
}

/** Workspace package name to its directory, relative to the project root. */
const workspaceDirs = (ctx: ReadCtx, base: string): Map<string, string> => {
    const out = new Map<string, string>()
    const raw = ctx.readFile(join(base, 'pnpm-workspace.yaml'))
    if (raw === undefined) return out
    for (const pattern of yamlList(raw, ['packages']).items) {
        const dirs: string[] = []
        if (pattern.endsWith('/*')) {
            const parent = pattern.slice(0, -2)
            // listDir marks a directory with a trailing slash.
            for (const entry of ctx.listDir(join(base, parent)) ?? []) {
                if (entry.endsWith('/'))
                    dirs.push(`${parent}/${entry.slice(0, -1)}`)
            }
        } else {
            dirs.push(pattern)
        }
        for (const dir of dirs) {
            const name = nameOf(ctx, join(base, dir))
            if (name !== undefined) out.set(name, dir)
        }
    }
    return out
}

export default defineRule({
    id: 'pera/conformance-workflow-paths',
    severity: 'error',
    card: {
        message:
            'a conformance workflow does not run on a PR that changes a package its suite depends on',
        remediation:
            "Add the reported `<dir>/**` to the workflow's `on.pull_request.paths`, so a PR that regresses the package runs the suite before merge instead of the next nightly.",
        examples: {
            bad: 'conformance-evm/package.json depends on @perawallet/wallet-core-kms and ci-evm-conformance.yml has no packages/kms/**',
            good: "ci-evm-conformance.yml's pull_request.paths lists packages/kms/**",
        },
    },
    // The suite's vitest config anchors the check: lanekeep discovers only
    // source files, and the manifest and workflow it compares are read from here.
    gates: {
        pathMatches: SUITES.map(
            s => `**/${dirOf(s.manifest)}/vitest.config.ts`,
        ),
    },
    query: '(program) @file',
    check(ctx, m) {
        const file = m.file
        if (file === undefined) return
        const suite = SUITES.find(s =>
            ctx.filePath.endsWith(`${dirOf(s.manifest)}/vitest.config.ts`),
        )
        if (suite === undefined) return
        const suiteDir = dirOf(ctx.filePath)
        const base = dirOf(suiteDir)
        const manifestRaw = ctx.readFile(join(base, suite.manifest))
        const workflowPath = join(base, suite.workflow)
        const workflowRaw = ctx.readFile(workflowPath)
        if (manifestRaw === undefined) return
        if (workflowRaw === undefined) {
            ctx.report(file, `${suite.workflow} does not exist`)
            return
        }

        const manifest = JSON.parse(manifestRaw) as {
            name?: string
            dependencies?: Record<string, string>
        }
        const { items, line } = yamlList(workflowRaw, [
            'on',
            'pull_request',
            'paths',
        ])
        const listed = new Set(items)
        const suiteName = manifest.name ?? dirOf(suite.manifest)
        const at = { workflow: workflowPath, line: line === 0 ? 1 : line }

        const ownDir = dirOf(suite.manifest)
        if (!listed.has(`${ownDir}/**`)) {
            ctx.emitFact({
                kind: 'missing',
                ...at,
                message: `pull_request.paths is missing '${ownDir}/**', ${suiteName}'s own directory`,
            })
        }

        let dirs: Map<string, string> | undefined
        for (const [dep, version] of Object.entries(
            manifest.dependencies ?? {},
        )) {
            if (!version.startsWith(WORKSPACE_PROTOCOL)) continue
            dirs ??= workspaceDirs(ctx, base)
            const dir = dirs.get(dep)
            if (dir === undefined) {
                ctx.emitFact({
                    kind: 'missing',
                    ...at,
                    message: `${suiteName} depends on ${dep}, which is not a package in pnpm-workspace.yaml`,
                })
                continue
            }
            if (listed.has(`${dir}/**`)) continue
            ctx.emitFact({
                kind: 'missing',
                ...at,
                message: `pull_request.paths is missing '${dir}/**', which ${suiteName} depends on as ${dep}`,
            })
        }
    },
    reduce(ctx) {
        for (const fact of ctx.facts('missing')) {
            ctx.report(
                {
                    file: String(fact.workflow),
                    line: Number(fact.line),
                    column: 1,
                },
                String(fact.message),
            )
        }
    },
})
