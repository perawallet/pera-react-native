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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useEthereumAccountSection,
    useHasEthereumAccountSection,
} from '../useEthereumAccountSection'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    useCapability: vi.fn((_requirement: unknown) => true),
    hasPeraService: vi.fn((..._args: unknown[]) => true),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    hasPeraService: (...args: unknown[]) => mocks.hasPeraService(...args),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@hooks/useCapability', () => ({
    useCapability: (requirement: unknown) => mocks.useCapability(requirement),
}))

const scope: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const account: WalletAccount = {
    id: 'eth-1',
    name: '',
    chains: {
        ethereum: {
            address: '0x00000000000000000000000000000000000000aa',
            keyPairId: 'key-1',
        },
    },
    custody: { kind: 'local', seed: null },
}

describe('useHasEthereumAccountSection', () => {
    const props = { account, scope, onClose: vi.fn() }
    const render = () =>
        renderHook(() => useHasEthereumAccountSection(props)).result.current

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useCapability.mockReturnValue(true)
        mocks.hasPeraService.mockReturnValue(true)
    })

    it('shows the section when the capability is on and the backend serves approvals', () => {
        expect(render()).toBe(true)
        expect(mocks.useCapability).toHaveBeenCalledWith({
            chain: { chainId: 'ethereum', capability: 'tokenApprovals' },
        })
        expect(mocks.hasPeraService).toHaveBeenCalledWith(scope, 'approvals')
    })

    it('hides the section where the backend does not serve approvals', () => {
        mocks.hasPeraService.mockReturnValue(false)

        expect(render()).toBe(false)
    })

    it('hides the section when the capability is off', () => {
        mocks.useCapability.mockReturnValue(false)

        expect(render()).toBe(false)
    })
})

describe('useEthereumAccountSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens the account’s token approvals on the row’s network, after closing the sheet', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useEthereumAccountSection({ account, scope, onClose }),
        )

        expect(result.current.options.map(option => option.id)).toEqual([
            'token-approvals',
        ])

        result.current.options[0]!.onPress()

        expect(onClose).toHaveBeenCalledOnce()
        expect(mocks.navigate).toHaveBeenCalledWith('TokenApprovals', {
            accountId: 'eth-1',
            scope,
        })
    })
})
