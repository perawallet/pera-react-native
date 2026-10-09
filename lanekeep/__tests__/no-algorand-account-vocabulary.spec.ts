/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-algorand-account-vocabulary.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/account-vocabulary/**/*.{ts,tsx}'

const messagesIn = (
    found: Awaited<ReturnType<typeof runRule>>,
    file: string,
): string[] =>
    found.filter(v => v.file.endsWith(file)).map(v => `${v.line}: ${v.message}`)

describe('pera/no-algorand-account-vocabulary', () => {
    it('reports the vocabulary outside the Algorand chain package and the composition roots', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual(
            [
                'bad.ts:2',
                'bad.ts:3',
                'bad.ts:5',
                'bad.ts:6',
                'bad.ts:7',
                'bad.ts:8',
                'bad.ts:9',
                'bad.ts:10',
                'bad.ts:11',
                'bad.ts:12',
                'bad.ts:12',
                'bad.ts:14',
                'bad.ts:17',
                'bad.ts:18',
                'bad.ts:19',
                'bad.ts:20',
                'bad.ts:20',
                'bad.ts:21',
                'bad.ts:22',
                'bad.ts:22',
                'bad.ts:23',
                'bad.ts:24',
                'kinds.ts:1',
                'legacy.ts:1',
                'seeds.ts:3',
                'useDemo.ts:1',
                'useDemo.ts:2',
            ].sort(),
        )
    })

    it('reads object keys, shorthand, interface members and namespace calls', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            messagesIn(found, 'bad.ts').filter(m => /^(11|12|14|17):/.test(m)),
        ).toEqual([
            '11: "hdWalletDetails" is Algorand vocabulary',
            '12: "hdWalletDetails" is Algorand vocabulary',
            '12: "hdWalletDetails" is Algorand vocabulary',
            '14: "hdWalletDetails" is Algorand vocabulary',
            '17: "isQuantumAccount" is Algorand vocabulary',
        ])
    })

    it('reports Algorand seed schemes and account-kind literals, but not where the keystore or a chain owns them', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            messagesIn(found, 'bad.ts').filter(m => /^(18|19|20|21):/.test(m)),
        ).toEqual([
            '18: "SeedScheme.Quantum" picks an Algorand key scheme outside the chain package',
            "19: 'quantum' names an Algorand account kind",
            "20: 'hdWallet' names an Algorand account kind",
            "20: 'standalone' names an Algorand account kind",
            "21: 'algo25' names an Algorand account kind",
        ])
        expect(messagesIn(found, 'scheme.ts')).toEqual([])
        expect(messagesIn(found, 'schemes.ts')).toEqual([])
        expect(messagesIn(found, 'seeds.ts')).toEqual([
            '3: "isQuantumAccount" is Algorand vocabulary',
        ])
    })

    it('keeps microAlgos in the shared units module and falcon in the keystore', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(messagesIn(found, 'units.ts')).toEqual([])
        expect(
            messagesIn(found, 'bad.ts').filter(m => /^(22|23):/.test(m)),
        ).toEqual([
            '22: "microAlgos" is Algorand vocabulary',
            '22: "microAlgos" is Algorand vocabulary',
            '23: "falcon" is Algorand vocabulary',
        ])
    })

    it('ignores the bip39 root, capabilities, icons, test ids and i18n keys', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(messagesIn(found, 'good.tsx')).toEqual([])
    })
})
