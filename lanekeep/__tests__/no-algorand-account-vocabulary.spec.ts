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
                'bad.ts:19',
                'bad.ts:20',
                'bad.ts:20',
                'bad.ts:21',
                'bad.ts:22',
                'bad.ts:22',
                'bad.ts:23',
                'bad.ts:24',
                'bad.ts:24',
                'compound.ts:1',
                'compound.ts:2',
                'compound.ts:3',
                'compound.ts:4',
                'kinds.ts:1',
                'legacy.ts:1',
                'seeds.ts:3',
                'useDemo.ts:1',
                'useDemo.ts:2',
                'useIsQuantumThing.ts:1',
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
            '19: "isQuantum" is Algorand account vocabulary in shared code',
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

    it('reads Algorand account words inside compound names in shared code', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(messagesIn(found, 'compound.ts')).toEqual([
            '1: "ParticipantIsQuantumError" is Algorand account vocabulary in shared code',
            '2: "useIsQuantumBlocked" is Algorand account vocabulary in shared code',
            '3: "ALGO25_SEED_LENGTH" is Algorand account vocabulary in shared code',
            '4: "isRekeyedSender" is Algorand account vocabulary in shared code',
        ])
        expect(messagesIn(found, 'useIsQuantumThing.ts')).toEqual([
            '1: "useIsQuantumThing" is Algorand account vocabulary in shared code',
        ])
        expect(
            messagesIn(found, 'bad.ts').filter(m => m.startsWith('24:')),
        ).toEqual([
            '24: "rekeyed" is Algorand account vocabulary in shared code',
            '24: "useRekeyAccount" is Algorand vocabulary',
        ])
    })

    it('leaves compound names to an app feature module, the keystore and the product features named quantum', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(messagesIn(found, 'RekeyToQuantumScreen.ts')).toEqual([])
        expect(messagesIn(found, 'scheme.ts')).toEqual([])
        expect(
            messagesIn(found, 'compound.ts').filter(m => !/^[1-4]:/.test(m)),
        ).toEqual([])
    })

    it('ignores the bip39 root, capabilities, icons, test ids and i18n keys', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(messagesIn(found, 'good.tsx')).toEqual([])
    })
})
