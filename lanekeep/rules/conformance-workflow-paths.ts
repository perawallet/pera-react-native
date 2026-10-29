/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { dirOf, join, workspaceDirs, yamlList } from '../shared/workspace.js'

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

        let manifest: {
            name?: string
            dependencies?: Record<string, string>
        }
        try {
            manifest = JSON.parse(manifestRaw) as typeof manifest
        } catch {
            ctx.report(file, `${suite.manifest} is not valid JSON`)
            return
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
