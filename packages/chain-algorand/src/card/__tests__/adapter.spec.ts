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
import { encodeUnsignedTransaction, type Algodv2 } from 'algosdk'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const {
    getAlgorandClient,
    waitForTransactionConfirmation,
    isDelegatedAccount,
    canSignArc60,
    canSignProgram,
} = vi.hoisted(() => ({
    getAlgorandClient: vi.fn(),
    waitForTransactionConfirmation: vi.fn(),
    isDelegatedAccount: vi.fn(),
    canSignArc60: vi.fn(),
    canSignProgram: vi.fn(),
}))
vi.mock('../../blockchain', async () => ({
    ...(await vi.importActual<object>('../../blockchain')),
    getAlgorandClient,
    waitForTransactionConfirmation,
}))
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    isDelegatedAccount,
    canSignProgram,
}))
vi.mock('../../accounts/vocabulary', async () => ({
    ...(await vi.importActual<object>('../../accounts/vocabulary')),
    canSignArc60,
}))

import { CardEscrowNotConfiguredError } from '@perawallet/wallet-core-card'
import { AlgodError } from '../../blockchain'
import { algorandCardAdapter as adapter } from '../adapter'
import { autoDrawDelegationRequest } from '../delegation'

const TESTNET: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const MAINNET: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const CUSTOM: ChainScope = { chainId: 'algorand', networkId: 'custom' }
const SENDER = 'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'
const CARD = 'PWJLR77JXPCJDWUCGB7MXGH2AFXAFU6UE7FNZLRLSEXJNP6MKJMIXGWT4I'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }
const accountInformation = vi.fn()
const algod = { accountInformation: () => ({ do: accountInformation }) }

beforeEach(() => {
    vi.clearAllMocks()
    getAlgorandClient.mockReturnValue({
        setDefaultValidityWindow: vi.fn(),
        setDefaultSigner: vi.fn(),
        client: { algod },
    })
})

describe('algorandCardAdapter delegation requests', () => {
    it('builds the Baanx Algorand post-approval body', () => {
        expect(
            adapter.delegationApprovalRequest({
                address: 'FUNDINGADDR',
                currency: 'usdc',
                txId: 'TX123',
                signData,
                signature: 'c2ln',
                token: 'ABC_tok',
            }),
        ).toEqual({
            path: '/v1/delegation/algorand/post-approval',
            data: {
                address: 'FUNDINGADDR',
                network: 'algorand',
                currency: 'usdc',
                amount: '0',
                txHash: 'TX123',
                sigData: signData,
                sigHash: 'c2ln',
                token: 'ABC_tok',
            },
        })
    })

    it('builds the delegator-lsig body with no fields Baanx would reject', () => {
        expect(
            autoDrawDelegationRequest({
                currency: 'usdc',
                delegatorAddress: 'FUNDING_ADDR',
                lsigBytes: 'bHNpZw==',
                cardAddress: 'ESCROW_CARD',
            }),
        ).toEqual({
            path: '/v1/delegation/algorand/delegator-lsig',
            data: {
                currency: 'usdc',
                delegatorAddress: 'FUNDING_ADDR',
                lsigBytes: 'bHNpZw==',
                cardAddress: 'ESCROW_CARD',
                blockchain: 'algorand',
            },
        })
    })
})

describe('algorandCardAdapter chain reads', () => {
    it('reads the holding of the asset in base units, zero when not opted in', async () => {
        accountInformation.mockResolvedValueOnce({
            assets: [{ assetId: 10_458_941n, amount: 2_500_000n }],
        })
        accountInformation.mockResolvedValueOnce({ assets: [] })

        await expect(
            adapter.getAssetBalance(TESTNET, 'ADDR', '10458941'),
        ).resolves.toBe(2_500_000n)
        await expect(
            adapter.getAssetBalance(TESTNET, 'ADDR', '10458941'),
        ).resolves.toBe(0n)
        expect(getAlgorandClient).toHaveBeenCalledWith('testnet')
    })

    it('waits for the transaction on the network algod', async () => {
        waitForTransactionConfirmation.mockResolvedValue(undefined)

        await adapter.awaitConfirmation(TESTNET, 'TX1')

        expect(waitForTransactionConfirmation).toHaveBeenCalledWith(
            algod,
            'TX1',
        )
    })

    it('settles in the network USDC, and has none without a deployment', () => {
        expect(adapter.settlementAsset(MAINNET)).toBe('31566704')
        expect(adapter.settlementAsset(TESTNET)).toBe('10458941')
        expect(
            adapter.settlementAsset({
                chainId: 'algorand',
                networkId: 'betanet',
            }),
        ).toBeNull()
    })
})

describe('algorandCardAdapter.buildManualDeposit', () => {
    const suggestedParams = {
        flatFee: false,
        fee: 0n,
        minFee: 1000n,
        firstValid: 50_000n,
        lastValid: 51_000n,
        genesisID: 'testnet-v1.0',
        genesisHash: new Uint8Array(32).fill(7),
    }
    const fakeAlgod = {
        getTransactionParams: () => ({ do: async () => suggestedParams }),
    } as unknown as Algodv2
    const realClient = () => AlgorandClient.fromClients({ algod: fakeAlgod })

    // The group the app built in place before the adapter owned it: the
    // wallet's AlgorandClient (1000-round window, a never-called signer)
    // composing one transfer.
    const buildInPlace = async (amount: bigint) => {
        const client = realClient()
        client.setDefaultValidityWindow(1000)
        client.setDefaultSigner(async () => {
            throw new Error('building never signs')
        })
        const composer = client.newGroup()
        composer.addAssetTransfer({
            sender: SENDER,
            receiver: CARD,
            assetId: 10_458_941n,
            amount,
        })
        const { transactions } = await composer.build()
        return transactions.map(built => encodeUnsignedTransaction(built.txn))
    }

    it('builds the same bytes the app built in place', async () => {
        getAlgorandClient.mockImplementation(realClient)

        const group = await adapter.buildManualDeposit(
            { sender: SENDER, cardAddress: CARD, amount: 400_000n },
            TESTNET,
        )

        expect(group.map(txn => encodeUnsignedTransaction(txn))).toEqual(
            await buildInPlace(400_000n),
        )
    })

    it('refuses a network with no settlement asset', async () => {
        await expect(
            adapter.buildManualDeposit(
                { sender: SENDER, cardAddress: CARD, amount: 1n },
                { chainId: 'algorand', networkId: 'betanet' },
            ),
        ).rejects.toBeInstanceOf(CardEscrowNotConfiguredError)
    })
})

describe('algorandCardAdapter.fundingSourceEligibility', () => {
    const account = {
        id: 'a1',
        chains: { algorand: { address: SENDER } },
    } as unknown as WalletAccount

    it('refuses a rekeyed account as a funding source', () => {
        isDelegatedAccount.mockReturnValue(true)
        canSignArc60.mockReturnValue(true)
        canSignProgram.mockReturnValue(true)

        expect(adapter.fundingSourceEligibility(account, TESTNET)).toEqual({
            canFund: false,
            canProveOwnership: true,
            canAutoDraw: true,
        })
        expect(isDelegatedAccount).toHaveBeenCalledWith(account, 'algorand')
    })

    it('lets a Ledger prove ownership but not sign the auto-draw program', () => {
        isDelegatedAccount.mockReturnValue(false)
        canSignArc60.mockReturnValue(true)
        canSignProgram.mockReturnValue(false)

        expect(adapter.fundingSourceEligibility(account, TESTNET)).toEqual({
            canFund: true,
            canProveOwnership: true,
            canAutoDraw: false,
        })
        expect(canSignProgram).toHaveBeenCalledWith(account, 'algorand')
    })
})

describe('algorandCardAdapter.describeError', () => {
    it.each(['below_min_balance', 'overspend'] as const)(
        'reads %s as an insufficient native balance',
        code => {
            expect(
                adapter.describeError(new AlgodError(code, {} as never)),
            ).toBe('insufficient-native-balance')
        },
    )

    it('leaves every other node error to the caller', () => {
        expect(
            adapter.describeError(new AlgodError('network_unavailable', {})),
        ).toBeNull()
        expect(adapter.describeError(new Error('logic eval error'))).toBeNull()
    })
})

describe('algorandCardAdapter.transactionUrl', () => {
    it('links an Algorand leg into the network explorer', () => {
        expect(adapter.transactionUrl('HASH', ' Algorand ', TESTNET)).toMatch(
            /^https:\/\/.+\/tx\/HASH$/,
        )
    })

    it('has no link for an EVM leg', () => {
        expect(adapter.transactionUrl('0xabc', 'linea', TESTNET)).toBeNull()
    })

    it('has no link on a network without an explorer', () => {
        expect(adapter.transactionUrl('HASH', 'algorand', CUSTOM)).toBeNull()
    })
})
