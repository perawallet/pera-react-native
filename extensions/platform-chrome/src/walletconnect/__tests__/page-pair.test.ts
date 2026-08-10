import { describe, it, expect } from 'vitest'
import { WC_PAGE_PAIR_SCOPE, isWcPagePairMessage } from '../page-pair'

describe('isWcPagePairMessage', () => {
    it('accepts a well-formed pair request', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
            }),
        ).toBe(true)
    })

    it('rejects another scope', () => {
        expect(
            isWcPagePairMessage({
                scope: 'pera-wc-control',
                uri: 'wc:topic@1?bridge=b&key=00',
            }),
        ).toBe(false)
    })

    it('rejects a missing uri', () => {
        expect(isWcPagePairMessage({ scope: WC_PAGE_PAIR_SCOPE })).toBe(false)
    })

    it('rejects a non-string uri', () => {
        expect(
            isWcPagePairMessage({ scope: WC_PAGE_PAIR_SCOPE, uri: 42 }),
        ).toBe(false)
    })

    it('rejects a non-wc uri scheme', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'https://evil.example',
            }),
        ).toBe(false)
    })

    it('rejects an over-long uri', () => {
        expect(
            isWcPagePairMessage({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: `wc:${'a'.repeat(5000)}`,
            }),
        ).toBe(false)
    })

    it('rejects a non-object', () => {
        expect(isWcPagePairMessage(null)).toBe(false)
        expect(isWcPagePairMessage('pair')).toBe(false)
    })

    it('rejects a page-supplied origin field by ignoring it entirely', () => {
        const withOrigin = {
            scope: WC_PAGE_PAIR_SCOPE,
            uri: 'wc:topic@1?bridge=b&key=00',
            requesterOrigin: 'https://trusted.example',
        }
        expect(isWcPagePairMessage(withOrigin)).toBe(true)
        // The guard narrows to the declared shape only; consumers must read
        // the origin from sender.origin, never from the message.
    })
})
