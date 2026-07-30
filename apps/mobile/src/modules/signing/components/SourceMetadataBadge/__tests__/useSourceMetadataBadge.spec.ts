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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useProjectByUrlQuery,
    type PeraProject,
    type UseProjectByUrlQueryResult,
} from '@perawallet/wallet-core-projects'
import { useSourceMetadataBadge } from '../useSourceMetadataBadge'

// Keep the real `resolveDisplayableVerificationTier` so the actual trust logic
// runs; only the network lookup is stubbed.
vi.mock('@perawallet/wallet-core-projects', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-projects')
    >()),
    useProjectByUrlQuery: vi.fn(),
}))

const verifiedTinyman: PeraProject = {
    name: 'Tinyman',
    url: 'https://tinyman.org',
    verificationTier: 'verified',
}

// Only `data` is read by the hook; the rest of TanStack's UseQueryResult union
// isn't worth constructing.
const stubProjectQuery = (project: PeraProject) =>
    vi.mocked(useProjectByUrlQuery).mockReturnValue({
        data: project,
    } as unknown as UseProjectByUrlQueryResult)

describe('useSourceMetadataBadge — verified-badge gating (PERA-4715)', () => {
    it('suppresses the verified badge for a WalletConnect request (no verifiedOrigin), even when the peer URL resolves to a verified project', () => {
        stubProjectQuery(verifiedTinyman)

        const { result } = renderHook(() =>
            useSourceMetadataBadge({
                name: 'Free Airdrop',
                url: 'https://tinyman.org',
            }),
        )

        expect(result.current.verificationTier).toBeUndefined()
    })

    it('shows the verified badge for a webview request whose verifiedOrigin host-matches', () => {
        stubProjectQuery(verifiedTinyman)

        const { result } = renderHook(() =>
            useSourceMetadataBadge(
                { url: 'https://tinyman.org' },
                'https://tinyman.org',
            ),
        )

        expect(result.current.verificationTier).toBe('verified')
    })

    it('always surfaces a suspicious badge, even for a WalletConnect request', () => {
        stubProjectQuery({ ...verifiedTinyman, verificationTier: 'suspicious' })

        const { result } = renderHook(() =>
            useSourceMetadataBadge({ url: 'https://tinyman.org' }),
        )

        expect(result.current.verificationTier).toBe('suspicious')
    })
})
