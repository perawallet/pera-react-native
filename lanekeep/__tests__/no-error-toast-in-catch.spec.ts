/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-error-toast-in-catch.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/error-toast.*.ts'

describe('pera/no-error-toast-in-catch', () => {
    it('reports an error toast in a catch clause and in a .catch callback', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual([
            'error-toast.bad.ts:8',
            'error-toast.bad.ts:14',
        ])
    })

    it('allows showError, success toasts, and a nested function declaration', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(found.filter(v => v.file.endsWith('.good.ts'))).toEqual([])
    })
})
