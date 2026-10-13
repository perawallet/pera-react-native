/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-react-native-imports-in-packages.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/**/{rn-imports.*.ts,falconModule.native.ts}'

describe('pera/no-react-native-imports-in-packages', () => {
    it('reports every import form of a React Native or Expo package, type-only included', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(found.filter(v => v.file.endsWith('rn-imports.bad.ts'))),
        ).toEqual([
            'rn-imports.bad.ts:1',
            'rn-imports.bad.ts:2',
            'rn-imports.bad.ts:3',
            'rn-imports.bad.ts:4',
            'rn-imports.bad.ts:5',
            'rn-imports.bad.ts:6',
            'rn-imports.bad.ts:7',
            'rn-imports.bad.ts:8',
            'rn-imports.bad.ts:9',
            'rn-imports.bad.ts:10',
        ])
    })

    it('allows provider imports, relative paths, look-alike names and non-require calls', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('rn-imports.good.ts')),
        ).toEqual([])
    })

    it('exempts an allowlisted file only for its allowlisted specifier', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('falconModule.native.ts')),
            ),
        ).toEqual(['falconModule.native.ts:2'])
    })

    it('leaves files outside packages/*/src alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('rn-imports.app.ts'))).toEqual(
            [],
        )
    })
})
