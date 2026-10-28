/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-raw-error-toast.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/error-toast.*.ts'

describe('pera/no-raw-error-toast', () => {
    it('reports every hand-built error toast, in a catch or not', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'error-toast.bad.ts:13',
            'error-toast.bad.ts:19',
            'error-toast.bad.ts:25',
            'error-toast.bad.ts:30',
            'error-toast.bad.ts:34',
            'error-toast.bad.ts:38',
            'error-toast.bad.ts:46',
        ])
    })

    it('allows showError, errorToast and non-error toasts', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('.good.ts'))).toEqual([])
    })
})
