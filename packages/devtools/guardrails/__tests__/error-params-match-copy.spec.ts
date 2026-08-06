import { describe, expect, it } from 'vitest'
import check from '../checks/error-params-match-copy.check.js'
import { runCheckOnSource } from './helpers.js'

describe('error-params-match-copy check', () => {
    it('flags a placeholder with no matching param', () => {
        // errors.validation.invalid_address interpolates {{address}}
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.validation.invalid_address',
                params: { wrongName: 'x' },
            }
            `,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('address')
    })

    it('flags a placeholder when params is absent entirely', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = { messageKey: 'errors.validation.invalid_address' }
            `,
        )

        expect(violations).toHaveLength(1)
    })

    it('accepts an extra log-only param on placeholder-free copy', () => {
        // errors.general.body has no placeholders; cause is log-only context.
        // Guards the zero-placeholder early return specifically.
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.general.body',
                params: { cause: 'raw detail' },
            }
            `,
        )

        expect(violations).toEqual([])
    })

    it('accepts an extra log-only param alongside a matched placeholder', () => {
        // The asymmetry is load-bearing: TransactionError and
        // InvalidMnemonicError both carry log-only params. This is the case a
        // "tidy it into a symmetric comparison" regression would break, and
        // it must reach the params-vs-placeholders comparison to prove it —
        // unlike the placeholder-free case above, which never gets there.
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.validation.invalid_address',
                params: { address: 'ABC', extra: 'log-only' },
            }
            `,
        )

        expect(violations).toEqual([])
    })

    it('accepts matching placeholder and param', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.validation.invalid_address',
                params: { address: 'ABC' },
            }
            `,
        )

        expect(violations).toEqual([])
    })

    it('reports a spread params object as unverifiable, not a failure', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.validation.invalid_address',
                params: { ...extra },
            }
            `,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('unverifiable')
    })

    it('reports a shorthand params property as unverifiable, not "no params"', () => {
        // `{ params }` has no initializer to read the param names from.
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.validation.invalid_address',
                params,
            }
            `,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('unverifiable')
    })

    it('reports a container spread as unverifiable, not "no params"', () => {
        // `...base` could supply `params` at runtime even though this
        // object literal never writes a `params` property itself.
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                ...base,
                messageKey: 'errors.validation.invalid_address',
            }
            `,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('unverifiable')
    })

    it('ignores a non-literal messageKey', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const key = 'errors.validation.invalid_address'
            const meta = { messageKey: key }
            `,
        )

        expect(violations).toEqual([])
    })

    it('ignores a messageKey that does not resolve to a string leaf', () => {
        // error-message-key-exists' job, not ours; don't double-report.
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = { messageKey: 'errors.validation.does_not_exist' }
            `,
        )

        expect(violations).toEqual([])
    })

    it('does not read params when the copy has zero placeholders, even if params is not a literal', () => {
        // Mirrors ValidationError's base class: a computed params expression
        // against placeholder-free copy must not be flagged as unverifiable.
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'errors.validation.generic',
                params: metadata?.params ?? (field ? { field } : undefined),
            }
            `,
        )

        expect(violations).toEqual([])
    })

    it('accepts multiple placeholders each with a matching param', () => {
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'multisig.threshold.exceeds_participants',
                params: { threshold: 2, participantCount: 1 },
            }
            `,
        )

        expect(violations).toEqual([])
    })

    it('flags a second placeholder missing its param when the first is present', () => {
        // Catches a regression where the placeholder regex only extracts the
        // first match (e.g. a missing /g flag or an early break).
        const violations = runCheckOnSource(
            check,
            'errors.ts',
            `
            const meta = {
                messageKey: 'multisig.threshold.exceeds_participants',
                params: { threshold: 2 },
            }
            `,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('participantCount')
    })
})
