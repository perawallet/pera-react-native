import { describe, expect, it } from 'vitest'
import check from '../checks/error-message-key-exists.check.js'
import { runCheckOnSource } from './helpers.js'

describe('error-message-key-exists check', () => {
    it('flags a messageKey that is not in en.json', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = { messageKey: 'errors.validation.does_not_exist' }
            `,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain(
            'errors.validation.does_not_exist',
        )
    })

    it('accepts a messageKey that resolves to a string leaf', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = { messageKey: 'errors.general.body' }
            `,
        )

        expect(violations).toEqual([])
    })

    it('flags a messageKey pointing at an object rather than a string', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = { messageKey: 'errors.network.no_connection' }
            `,
        )

        expect(violations).toHaveLength(1)
    })

    it('ignores a non-literal messageKey', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const key = 'errors.general.body'
            const meta = { messageKey: key }
            `,
        )

        expect(violations).toEqual([])
    })
})
