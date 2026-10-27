/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, withScratch, type Violation } from './helpers.js'

const RULE = 'lanekeep/rules/conformance-workflow-paths.ts'
const WORKFLOW = '.github/workflows/ci-evm-conformance.yml'

const WORKSPACE = [
    'packages:',
    '  - packages/*',
    '  - conformance',
    '  - conformance-evm',
    '',
].join('\n')

const manifest = (name: string, deps: Record<string, string>): string =>
    JSON.stringify({ name, dependencies: deps }, null, 4)

const SUITE = manifest('@perawallet/conformance-evm', {
    '@perawallet/conformance': 'workspace:*',
    '@perawallet/wallet-core-kms': 'workspace:*',
    '@perawallet/wallet-core-signing': 'workspace:*',
    viem: 'catalog:',
})

const workflow = (paths: string[]): string =>
    [
        'name: EVM',
        '',
        'on:',
        '    schedule:',
        "        - cron: '30 3 * * *'",
        '    pull_request:',
        '        paths:',
        ...paths.map(p => `            # why\n            - '${p}'`),
        '',
        'permissions:',
        '    contents: read',
        '',
    ].join('\n')

const repo = (files: Record<string, string>): Record<string, string> => ({
    'pnpm-workspace.yaml': WORKSPACE,
    'packages/kms/package.json': manifest('@perawallet/wallet-core-kms', {}),
    'packages/signing/package.json': manifest(
        '@perawallet/wallet-core-signing',
        {},
    ),
    'conformance/package.json': manifest('@perawallet/conformance', {}),
    'conformance-evm/package.json': SUITE,
    'conformance-evm/vitest.config.ts': 'export default {}\n',
    ...files,
})

const check = async (files: Record<string, string>): Promise<Violation[]> =>
    withScratch(repo(files), async dir => {
        const runner = await createRunner(RULE, `${dir}/**/*.ts`)
        try {
            return await runner.run()
        } finally {
            await runner.dispose()
        }
    })

describe('pera/conformance-workflow-paths', () => {
    it('names the workspace dependency the workflow does not run on, at its paths key', async () => {
        const found = await check({
            [WORKFLOW]: workflow([
                'conformance-evm/**',
                'conformance/**',
                'packages/kms/**',
            ]),
        })

        expect(found.map(v => v.message)).toEqual([
            "pull_request.paths is missing 'packages/signing/**', which @perawallet/conformance-evm depends on as @perawallet/wallet-core-signing",
        ])
        expect(found[0]?.file.endsWith(WORKFLOW)).toBe(true)
        expect(found[0]?.line).toBe(7)
    })

    it('reports nothing when every workspace dependency and the suite are listed', async () => {
        const found = await check({
            [WORKFLOW]: workflow([
                'conformance-evm/**',
                'conformance/**',
                'packages/kms/**',
                'packages/signing/**',
                'tools/dev/evmnet*',
            ]),
        })

        expect(found).toEqual([])
    })

    it("requires the suite's own directory", async () => {
        const found = await check({
            [WORKFLOW]: workflow([
                'conformance/**',
                'packages/kms/**',
                'packages/signing/**',
            ]),
        })

        expect(found.map(v => v.message)).toEqual([
            "pull_request.paths is missing 'conformance-evm/**', @perawallet/conformance-evm's own directory",
        ])
    })

    it('reports a workspace dependency pnpm-workspace.yaml does not resolve', async () => {
        const found = await check({
            'conformance-evm/package.json': manifest(
                '@perawallet/conformance-evm',
                { '@perawallet/gone': 'workspace:*' },
            ),
            [WORKFLOW]: workflow(['conformance-evm/**']),
        })

        expect(found.map(v => v.message)).toEqual([
            '@perawallet/conformance-evm depends on @perawallet/gone, which is not a package in pnpm-workspace.yaml',
        ])
    })

    it('reports a suite whose workflow is missing on its vitest config', async () => {
        const found = await check({})

        expect(found.map(v => [v.file.split('/').pop(), v.message])).toEqual([
            ['vitest.config.ts', `${WORKFLOW} does not exist`],
        ])
    })
})
