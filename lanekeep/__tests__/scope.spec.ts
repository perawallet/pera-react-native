/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import {
    PRODUCTION_SOURCE_PATHS,
    TEST_FILES,
    productionSource,
    withoutTests,
} from '../shared/scope.js'
import { locations, runRule } from './helpers.js'

describe('lanekeep/shared/scope', () => {
    it('narrows a rule to shipped source and appends its own exclusions', () => {
        expect(
            productionSource({
                fileContains: ['makeStyles'],
                pathNotMatches: ['apps/mobile/src/components/core/**'],
            }),
        ).toEqual({
            fileContains: ['makeStyles'],
            pathMatches: [...PRODUCTION_SOURCE_PATHS],
            pathNotMatches: [
                ...TEST_FILES,
                'apps/mobile/src/components/core/**',
            ],
        })
    })

    it('keeps a rule’s own pathMatches and only adds the test exclusions', () => {
        expect(withoutTests({ pathMatches: ['**/v1/**'] })).toEqual({
            pathMatches: ['**/v1/**'],
            pathNotMatches: [...TEST_FILES],
        })
    })

    it('drops test files but still reaches fixtures, so gated rules run in their specs', async () => {
        const found = await runRule(
            'lanekeep/rules/error-message-key-exists.ts',
            'lanekeep/__tests__/fixtures/scope/**/*.ts',
        )

        expect(locations(found)).toEqual(['shipped.ts:1'])
    })
})
