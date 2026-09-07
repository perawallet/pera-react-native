/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect } from 'vitest'
import { resolveDisplayableVerificationTier } from '../verification'
import type { PeraProject } from '../../models/types'

const project = (overrides: Partial<PeraProject> = {}): PeraProject => ({
    name: 'Tinyman',
    url: 'https://tinyman.org',
    verificationTier: 'verified',
    ...overrides,
})

describe('resolveDisplayableVerificationTier', () => {
    it('suppresses a verified tier when no verifiedOrigin is present (all WalletConnect requests)', () => {
        // The peer asserted tinyman.org and the registry returned tinyman's
        // verified record — but WalletConnect has no platform-observed origin,
        // so the checkmark must not be minted.
        expect(resolveDisplayableVerificationTier(project(), undefined)).toBe(
            undefined,
        )
    })

    it('honours a verified tier when a verifiedOrigin host-matches the record URL (webview)', () => {
        expect(
            resolveDisplayableVerificationTier(
                project(),
                'https://tinyman.org/swap',
            ),
        ).toBe('verified')
    })

    it('suppresses a verified tier when the verifiedOrigin host does not match', () => {
        expect(
            resolveDisplayableVerificationTier(
                project(),
                'https://evil.example',
            ),
        ).toBe(undefined)
    })

    it('always surfaces a suspicious tier, even from a peer-asserted URL with no verifiedOrigin', () => {
        expect(
            resolveDisplayableVerificationTier(
                project({ verificationTier: 'suspicious' }),
                undefined,
            ),
        ).toBe('suspicious')
    })

    it('surfaces a suspicious tier regardless of origin match', () => {
        expect(
            resolveDisplayableVerificationTier(
                project({ verificationTier: 'suspicious' }),
                'https://unrelated.example',
            ),
        ).toBe('suspicious')
    })

    it('renders nothing for an unverified or missing tier', () => {
        expect(
            resolveDisplayableVerificationTier(
                project({ verificationTier: 'unverified' }),
                'https://tinyman.org',
            ),
        ).toBe(undefined)
        expect(
            resolveDisplayableVerificationTier(
                project({ verificationTier: undefined }),
                'https://tinyman.org',
            ),
        ).toBe(undefined)
        expect(
            resolveDisplayableVerificationTier(
                undefined,
                'https://tinyman.org',
            ),
        ).toBe(undefined)
    })

    it('matches hosts tolerant of scheme, case, port and path; rejects look-alikes', () => {
        // Scheme-less origin, uppercase, trailing path + port all still match.
        expect(
            resolveDisplayableVerificationTier(
                project({ url: 'https://tinyman.org' }),
                'TINYMAN.ORG:443/app',
            ),
        ).toBe('verified')
        // A suffix look-alike is a different host — must not match.
        expect(
            resolveDisplayableVerificationTier(
                project({ url: 'https://tinyman.org' }),
                'https://tinyman.org.evil.com',
            ),
        ).toBe(undefined)
        // A true subdomain is also a different host. Exact-match is deliberate:
        // a compromised subdomain must not inherit the parent's checkmark.
        expect(
            resolveDisplayableVerificationTier(
                project({ url: 'https://tinyman.org' }),
                'https://app.tinyman.org',
            ),
        ).toBe(undefined)
    })
})
