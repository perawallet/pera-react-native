/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-secret-in-logs.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secret-flows/**/*.ts'

describe('pera/no-secret-in-logs', () => {
    it('reports a secret reaching a log, analytics, crash-report, error or clipboard sink', async () => {
        expect(locations(await runRule(RULE, FIXTURES))).toEqual([
            'caught-error.bad.ts:5',
            'caught-error.bad.ts:10',
            'caught-error.bad.ts:13',
            'caught-error.bad.ts:19',
            'caught-error.bad.ts:24',
            'clipboard.bad.ts:2',
            'clipboard.bad.ts:6',
            'clipboard.bad.ts:11',
            'clipboard.bad.ts:16',
            'clipboard.bad.ts:21',
            'clipboard.bad.ts:25',
            'clipboard.bad.ts:29',
            'pairing-uri.bad.ts:2',
            'pairing-uri.bad.ts:5',
            'pairing-uri.bad.ts:8',
            'pairing-uri.bad.ts:12',
            'pairing-uri.bad.ts:17',
            'pairing-uri.bad.ts:21',
            'pairing-uri.bad.ts:25',
            'scanned-link.bad.ts:3',
            'scanned-link.bad.ts:8',
            'scanned-link.bad.ts:13',
            'scanned-link.bad.ts:18',
            'scanned-link.bad.ts:22',
            'scanned-link.bad.ts:27',
            'string-building.bad.ts:3',
            'string-building.bad.ts:4',
            'string-building.bad.ts:5',
            'string-building.bad.ts:6',
            'string-building.bad.ts:7',
            'string-building.bad.ts:9',
            'leaks.ts:4',
            'leaks.ts:5',
            'leaks.ts:6',
            'leaks.ts:7',
            'leaks.ts:8',
            'leaks.ts:19',
            'leaks.ts:20',
            'leaks.ts:21',
        ])
    })
})
