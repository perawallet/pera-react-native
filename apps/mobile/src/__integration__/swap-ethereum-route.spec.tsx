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

// A swap opened from an Ethereum asset. Apart from swap-ethereum.spec because
// route params can't cross that file's module reset.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { act, waitFor } from '@testing-library/react'

import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSwapsStore } from '@perawallet/wallet-core-swaps'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { seedAlgo25Signer } from '@test-utils/signing-review'
import { SwapScreen } from '@modules/swap/screens/SwapScreen/SwapScreen'

import {
    ETHEREUM_SENDER,
    seedEthereumAssets,
    selectSender,
    TOKEN,
} from './__fixtures__/ethereum-send'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : actual.chainEndpointsFor(chainId),
    }
})

describe('Flow: Swap opened on an Ethereum asset', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })
    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedEthereumAssets()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
        useSwapsStore.getState().resetState()
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('Given an account on two chains, when the swap screen opens on an Ethereum token, then it stays on that chain and token', async () => {
        const signer = await seedAlgo25Signer()
        const account: WalletAccount = {
            ...signer,
            custody: ETHEREUM_SENDER.custody,
            chains: { ...signer.chains, ...ETHEREUM_SENDER.chains },
        }
        selectSender(account)

        renderWithNavigation(SwapScreen, 'Swap', {
            initialParams: { assetIn: { chainId: 'ethereum', assetId: TOKEN } },
        })

        await waitFor(() =>
            expect(useSwapsStore.getState().fromAsset).toBe(TOKEN),
        )
        // Long enough for the form's remount on the new chain to land.
        await act(() => new Promise(resolve => setTimeout(resolve, 100)))
        expect(useSwapsStore.getState().sourceChainId).toBe('ethereum')
        expect(useSwapsStore.getState().fromAsset).toBe(TOKEN)
        // Null falls back to this chain's own receive asset.
        expect(useSwapsStore.getState().toAsset).toBeNull()
    })
})
