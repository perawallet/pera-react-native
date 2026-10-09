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

const {
    compileAutoDrawProgram,
    resolveEscrowChainConfig,
    autoDraw,
    postCardDelegation,
    signProgram,
    submit,
    submitWithFeeDelegation,
} = vi.hoisted(() => ({
    compileAutoDrawProgram: vi.fn(),
    resolveEscrowChainConfig: vi.fn(),
    autoDraw: {
        isConfigured: vi.fn(),
        isEnabled: vi.fn(),
        buildEnable: vi.fn(),
        buildKill: vi.fn(),
    },
    postCardDelegation: vi.fn(),
    signProgram: vi.fn(),
    submit: vi.fn(),
    submitWithFeeDelegation: vi.fn(),
}))
vi.mock('../escrow/lsig', () => ({
    compileAutoDrawProgram,
    resolveEscrowChainConfig,
}))
vi.mock('../escrow/killswitch', () => ({ algorandAutoDraw: autoDraw }))
vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    postCardDelegation,
}))
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useProgramSigner: () => ({ signProgram }),
    encodeProgramAccount: () => new Uint8Array([9, 9, 9]),
    useSignAndSubmitGroup: () => ({ submit }),
}))
vi.mock('../../fee-delegation', () => ({
    useFeeDelegation: () => ({ submitWithFeeDelegation }),
}))

import { useAlgorandCardAutoDraw } from '../useAlgorandCardAutoDraw'

const TESTNET: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const account = {
    id: 'a1',
    chains: { algorand: { address: 'FUNDINGADDR' } },
} as unknown as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    compileAutoDrawProgram.mockResolvedValue(new Uint8Array([7, 7, 7]))
    resolveEscrowChainConfig.mockReturnValue({
        assetId: '10458941',
        killswitchAppId: '222',
        mainAppId: '111',
    })
    signProgram.mockResolvedValue(new Uint8Array([1, 2, 3]))
    postCardDelegation.mockResolvedValue(undefined)
    autoDraw.isConfigured.mockReturnValue(true)
    // Not enabled by default: enable proceeds, kill no-ops.
    autoDraw.isEnabled.mockResolvedValue(false)
    autoDraw.buildEnable.mockResolvedValue([{ txn: 'enable' }])
    autoDraw.buildKill.mockResolvedValue([{ txn: 'kill' }])
    submit.mockResolvedValue({ txIds: ['TX1'] })
    submitWithFeeDelegation.mockResolvedValue(undefined)
})

const render = () => renderHook(() => useAlgorandCardAutoDraw()).result

describe('useAlgorandCardAutoDraw.enableAutoDraw', () => {
    it('registers the signed program, then submits the fee-delegated enable', async () => {
        await render().current.enableAutoDraw(account, 'CARD', TESTNET)

        expect(compileAutoDrawProgram).toHaveBeenCalledWith({
            network: 'testnet',
        })
        expect(signProgram).toHaveBeenCalledWith(
            account,
            new Uint8Array([7, 7, 7]),
        )
        expect(postCardDelegation).toHaveBeenCalledWith(
            {
                path: '/v1/delegation/algorand/delegator-lsig',
                data: {
                    currency: 'usdc',
                    delegatorAddress: 'FUNDINGADDR',
                    lsigBytes: 'CQkJ',
                    cardAddress: 'CARD',
                    blockchain: 'algorand',
                },
            },
            TESTNET,
        )
        expect(autoDraw.buildEnable).toHaveBeenCalledWith({
            network: 'testnet',
            sender: 'FUNDINGADDR',
            cardAddress: 'CARD',
            asset: '10458941',
        })
        expect(submitWithFeeDelegation).toHaveBeenCalledWith({
            account: 'FUNDINGADDR',
            transactions: [{ txn: 'enable' }],
            includeAssetOptInMbr: true,
            sourceMetadata: {
                name: 'card-autodraw-enable',
                description: 'Enable auto funding',
            },
        })
        expect(postCardDelegation.mock.invocationCallOrder[0]).toBeLessThan(
            submitWithFeeDelegation.mock.invocationCallOrder[0],
        )
    })

    it("refuses an account with no address on the scope's chain before signing", async () => {
        const elsewhere = {
            id: 'a2',
            chains: { ethereum: { address: '0xFUNDING' } },
        } as unknown as WalletAccount

        await expect(
            render().current.enableAutoDraw(elsewhere, 'CARD', TESTNET),
        ).rejects.toThrow('no address on algorand')
        expect(signProgram).not.toHaveBeenCalled()
        expect(postCardDelegation).not.toHaveBeenCalled()
    })

    it('only registers the program while the switch contract is unconfigured', async () => {
        autoDraw.isConfigured.mockReturnValue(false)

        await render().current.enableAutoDraw(account, 'CARD', TESTNET)

        expect(postCardDelegation).toHaveBeenCalledTimes(1)
        expect(autoDraw.buildEnable).not.toHaveBeenCalled()
        expect(submitWithFeeDelegation).not.toHaveBeenCalled()
    })

    it('re-registers but does not re-enable when already enabled', async () => {
        autoDraw.isEnabled.mockResolvedValue(true)

        await expect(
            render().current.enableAutoDraw(account, 'CARD', TESTNET),
        ).resolves.toBeUndefined()

        expect(postCardDelegation).toHaveBeenCalledTimes(1)
        expect(autoDraw.buildEnable).not.toHaveBeenCalled()
        expect(submitWithFeeDelegation).not.toHaveBeenCalled()
    })

    it('fails closed when the switch state cannot be read', async () => {
        autoDraw.isEnabled.mockRejectedValue(new Error('network down'))

        await expect(
            render().current.enableAutoDraw(account, 'CARD', TESTNET),
        ).rejects.toThrow('network down')
        expect(submitWithFeeDelegation).not.toHaveBeenCalled()
    })

    it('rethrows an on-chain failure', async () => {
        submitWithFeeDelegation.mockRejectedValue(new Error('NOT_CARD_OWNER'))

        await expect(
            render().current.enableAutoDraw(account, 'CARD', TESTNET),
        ).rejects.toThrow('NOT_CARD_OWNER')
    })
})

describe('useAlgorandCardAutoDraw.disableAutoDraw', () => {
    it('submits kill when auto-draw is on chain', async () => {
        autoDraw.isEnabled.mockResolvedValue(true)

        await render().current.disableAutoDraw(account, TESTNET)

        expect(autoDraw.buildKill).toHaveBeenCalledWith({
            network: 'testnet',
            sender: 'FUNDINGADDR',
            asset: '10458941',
        })
        expect(submit).toHaveBeenCalledWith({
            chainId: 'algorand',
            unsignedTxs: [{ txn: 'kill' }],
            source: {
                name: 'card-autodraw-disable',
                description: 'Turn off auto funding',
            },
        })
    })

    // Covers the retry and a persisted Auto choice whose enable never ran:
    // switching to Manual must succeed rather than revert ALREADY_DISABLED.
    it('does nothing when there is no enable to kill', async () => {
        await expect(
            render().current.disableAutoDraw(account, TESTNET),
        ).resolves.toBeUndefined()

        expect(autoDraw.buildKill).not.toHaveBeenCalled()
        expect(submit).not.toHaveBeenCalled()
    })

    it('skips the chain while the switch contract is unconfigured', async () => {
        autoDraw.isConfigured.mockReturnValue(false)

        await render().current.disableAutoDraw(account, TESTNET)

        expect(autoDraw.isEnabled).not.toHaveBeenCalled()
        expect(submit).not.toHaveBeenCalled()
    })
})
