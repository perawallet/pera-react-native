import { describe, test, expect } from 'vitest'
import { transformApplication } from '../transformers'
import type { ApplicationApiResponse } from '../schema'

describe('transformApplication', () => {
    test('transforms a full application response to domain model', () => {
        const response: ApplicationApiResponse = {
            application_id: 123456,
            name: 'Tinyman AMM',
            project: {
                name: 'Tinyman',
                verification_tier: 'verified',
                logo_png: 'https://tinyman.org/logo.png',
            },
        }

        const result = transformApplication(response)

        expect(result.applicationId).toBe(123456)
        expect(result.name).toBe('Tinyman AMM')
        expect(result.project.name).toBe('Tinyman')
        expect(result.project.logoPng).toBe('https://tinyman.org/logo.png')
        expect(result.project.verificationTier).toBe('verified')
    })

    test('handles a response with optional fields absent', () => {
        const response: ApplicationApiResponse = {
            project: {},
        }

        const result = transformApplication(response)

        expect(result.applicationId).toBeUndefined()
        expect(result.name).toBeUndefined()
        expect(result.project.name).toBeUndefined()
        expect(result.project.verificationTier).toBeUndefined()
    })
})
