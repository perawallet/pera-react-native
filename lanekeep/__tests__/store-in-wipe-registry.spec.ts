/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    REPO_ROOT,
    createRunner,
    locations,
    runRule,
    withScratch,
} from './helpers.js'

const RULE = 'lanekeep/rules/store-in-wipe-registry.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/wipe-registry/**/*.ts'

const STORE = [
    "import { create } from 'zustand'",
    '',
    'export const useDemoStore = create<{ n: number }>()(() => ({ n: 0 }))',
    '',
].join('\n')

const REGISTRATION = [
    "import { registerStore } from '@perawallet/wallet-core-shared'",
    "import { useDemoStore } from './demo-store'",
    '',
    'registerStore({',
    "    name: 'demo',",
    '    clearStorage: () => {},',
    '    resetState: () => useDemoStore.setState({ n: 0 }),',
    '})',
    '',
].join('\n')

describe('pera/store-in-wipe-registry', () => {
    it('reports exactly the stores no registerStore call references', async () => {
        const found = await runRule(RULE, FIXTURES)

        // The registered, cross-file, exempt, factory and non-zustand
        // fixtures are clean.
        expect(locations(found).sort()).toEqual([
            'wipe-local-unregistered.ts:7',
            'wipe-persisted-unregistered.ts:8',
            'wipe-unregistered.ts:7',
        ])
    })

    it('names the store in each finding', async () => {
        const found = await runRule(RULE, FIXTURES)

        const messages = found.map(v => v.message).join('\n')
        expect(messages).toContain('store "useUnregisteredStore"')
        expect(messages).toContain('store "usePersistedStore"')
    })

    it('sees a registration added in another file on a warm cache', async () => {
        await withScratch(
            { 'packages/demo/src/demo-store.ts': STORE },
            async dir => {
                const runner = await createRunner(
                    RULE,
                    `${dir}/packages/demo/src/**/*.ts`,
                )
                try {
                    expect(await runner.run()).toHaveLength(1)

                    await writeFile(
                        join(
                            REPO_ROOT,
                            dir,
                            'packages/demo/src/demo-registry.ts',
                        ),
                        REGISTRATION,
                    )

                    expect(await runner.run()).toEqual([])
                } finally {
                    await runner.dispose()
                }
            },
        )
    })
})
