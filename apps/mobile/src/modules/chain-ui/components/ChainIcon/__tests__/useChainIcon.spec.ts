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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChainIcon } from '../useChainIcon'

const registered = vi.hoisted(
    () => new Map<string, { displayName: string; family: string }>(),
)
const Logo = vi.hoisted(() => () => null)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            has: (id: string) => registered.has(id),
            get: (id: string) => ({ descriptor: registered.get(id) }),
        },
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (id: string) => registered.get(id)?.displayName,
}))

vi.mock('../../../registry', () => ({
    chainUiFor: (family: string) =>
        family === 'with-logo' ? { icon: () => Logo } : {},
}))

describe('useChainIcon', () => {
    beforeEach(() => {
        registered.clear()
        registered.set('logo-chain', {
            displayName: 'Logo Chain',
            family: 'with-logo',
        })
        registered.set('base', { displayName: 'Base', family: 'bare' })
    })

    it("uses the chain's own icon when its family registers one", () => {
        const { result } = renderHook(() =>
            useChainIcon('logo-chain' as ChainId),
        )

        expect(result.current).toEqual({
            Icon: Logo,
            initials: 'LC',
            displayName: 'Logo Chain',
        })
    })

    it('falls back to initials of its display name when it has none', () => {
        const { result } = renderHook(() => useChainIcon('base' as ChainId))

        expect(result.current.Icon).toBeUndefined()
        expect(result.current.initials).toBe('B')
        expect(result.current.displayName).toBe('Base')
    })
})
