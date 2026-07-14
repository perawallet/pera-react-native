import { describe, expect, it } from 'vitest'
import en from '../locales/en.json'

const errors = en.errors as Record<string, unknown>

describe('network/api error copy', () => {
    it('offline copy is a {title, body} pair that says the device appears offline', () => {
        const offline = (
            errors.network as Record<string, { title: string; body: string }>
        ).no_connection
        expect(typeof offline.title).toBe('string')
        expect(offline.body.toLowerCase()).toMatch(
            /offline|not connected|internet/,
        )
    })

    it('timeout copy suggests trying again', () => {
        const timeout = (errors.network as Record<string, { body: string }>)
            .timeout
        expect(timeout.body.toLowerCase()).toMatch(/again|try/)
    })

    it('api copy keys are {title, body} pairs', () => {
        const api = errors.api as Record<
            string,
            { title: string; body: string }
        >
        for (const key of [
            'generic',
            'not_found',
            'unauthorized',
            'server_error',
        ]) {
            expect(typeof api[key].title).toBe('string')
            expect(typeof api[key].body).toBe('string')
        }
    })

    it('removes dead keys', () => {
        expect(
            (errors.network as Record<string, unknown>).generic,
        ).toBeUndefined()
        expect(
            (errors.algod as Record<string, unknown>).network_unavailable,
        ).toBeUndefined()
    })
})
