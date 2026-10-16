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
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    type AccountChainState,
    type AssetRef,
    type ChainId,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'

const mocks = vi.hoisted(() => ({
    getAccountChainStateRow: vi.fn(),
    getAccountHoldings: vi.fn(),
    isDelegatedAccount: vi.fn(),
    fetchOnChainAccountState: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    ...mocks,
}))

vi.mock('../../blockchain/fees/getMinimumFeeConfig', () => ({
    getMinimumFeeConfig: () => ({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
        assetMbr: 100_000n,
        baseAccountMbr: 100_000n,
    }),
}))

import {
    algorandHoldingReserve,
    readAlgorandRecipientWarning,
    readAlgorandSpendableBalance,
} from '../spendable-balance'

const SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const
const ALGO: AssetRef = { chainId: 'algorand' as ChainId, assetId: '0' }
const USDC: AssetRef = { chainId: 'algorand' as ChainId, assetId: '31566704' }
const SENDER: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'SENDER' } },
}
const FEE = new Decimal(1_000)
const BALANCE = new Decimal(5_000_000)

const syncedState = (
    minBalance: number,
    totalAssetsOptedIn: number,
): { nativeBalance: Decimal; chainData: AccountChainState } => ({
    nativeBalance: BALANCE,
    chainData: {
        family: 'algorand',
        minBalance: new Decimal(minBalance),
        status: 'Offline',
        totalAssetsOptedIn,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
    },
})

const MIN_BALANCE_NOTICE = (minBalance: string) => ({
    title: { key: 'send_funds.input.min_balance_title' },
    body: [
        {
            key: 'send_funds.input.min_balance_amount',
            params: { minBalance },
        },
        { key: 'send_funds.input.min_balance_body' },
    ],
    isFirm: false,
})

const spendableOf = (asset: AssetRef = ALGO) =>
    readAlgorandSpendableBalance({
        account: SENDER,
        asset,
        scope: SCOPE,
        fee: FEE,
    })

describe('readAlgorandSpendableBalance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isDelegatedAccount.mockReturnValue(false)
        mocks.getAccountHoldings.mockResolvedValue([])
    })

    it('offers to empty a plain account and keeps its minimum balance otherwise', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue(syncedState(100_000, 0))

        const result = await spendableOf()

        expect(result.balance).toEqual(BALANCE)
        expect(result.max).toEqual(new Decimal(4_899_000))
        expect(result.reserved).toEqual(new Decimal(100_000))
        expect(result.emptyAccount).toEqual({
            amount: new Decimal(4_999_000),
            notice: {
                title: { key: 'send_funds.close_account.title' },
                body: [
                    {
                        key: 'send_funds.close_account.body',
                        params: { minBalance: '0.1' },
                    },
                ],
            },
        })
        expect(result.reserveNotice).toEqual(MIN_BALANCE_NOTICE('0.1'))
    })

    it('keeps an account whose holdings raised its minimum balance open', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue(syncedState(200_000, 1))

        const result = await spendableOf()

        expect(result.max).toEqual(new Decimal(4_799_000))
        expect(result.reserved).toEqual(new Decimal(200_000))
        expect(result.emptyAccount).toBeUndefined()
        expect(result.reserveNotice).toEqual(MIN_BALANCE_NOTICE('0.2'))
    })

    // The opt-in count misses app opt-ins, created assets and boxes; the raised
    // minimum balance is what the node would reject the close-out for.
    it('keeps an account open when an app opt-in holds its minimum balance up', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue(syncedState(328_500, 0))

        const result = await spendableOf()

        expect(result.emptyAccount).toBeUndefined()
        expect(result.reserveNotice).toEqual(MIN_BALANCE_NOTICE('0.3285'))
    })

    it('never offers to empty a rekeyed account, and holds its reserve firm', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue(syncedState(100_000, 0))
        mocks.isDelegatedAccount.mockReturnValue(true)

        const result = await spendableOf()

        expect(result.max).toEqual(new Decimal(4_899_000))
        expect(result.emptyAccount).toBeUndefined()
        expect(result.reserveNotice).toEqual({
            title: { key: 'send_funds.input.rekeyed_min_balance_title' },
            body: [
                {
                    key: 'send_funds.input.rekeyed_min_balance_amount',
                    params: { minBalance: '0.1' },
                },
                { key: 'send_funds.input.rekeyed_min_balance_body' },
            ],
            isFirm: true,
        })
    })

    it('never goes below zero when the reserve and fee exceed the balance', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue({
            ...syncedState(100_000, 0),
            nativeBalance: new Decimal(50_000),
        })

        const result = await spendableOf()

        expect(result.max).toEqual(new Decimal(0))
        expect(result.emptyAccount?.amount).toEqual(new Decimal(49_000))
    })

    it('reads a never-synced account as empty', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue(undefined)

        const result = await spendableOf()

        expect(result.balance).toEqual(new Decimal(0))
        expect(result.max).toEqual(new Decimal(0))
        expect(result.reserved).toEqual(new Decimal(0))
    })

    it('offers the whole holding of a token, with no reserve or close-out', async () => {
        mocks.getAccountHoldings.mockResolvedValue([
            { assetId: USDC.assetId, amount: new Decimal(250), native: null },
        ])

        const result = await spendableOf(USDC)

        expect(result).toEqual({
            balance: new Decimal(250),
            max: new Decimal(250),
            reserved: new Decimal(0),
        })
        expect(mocks.getAccountHoldings).toHaveBeenCalledWith({
            accountAddress: 'SENDER',
            scope: SCOPE,
        })
    })

    it('reads an unheld token as zero', async () => {
        const result = await spendableOf(USDC)

        expect(result.max).toEqual(new Decimal(0))
    })

    it('refuses an account with no Algorand address', async () => {
        await expect(
            readAlgorandSpendableBalance({
                account: { ...SENDER, chains: {} },
                asset: ALGO,
                scope: SCOPE,
                fee: FEE,
            }),
        ).rejects.toBeInstanceOf(InvalidSendParamsError)
    })
})

describe('readAlgorandRecipientWarning', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.fetchOnChainAccountState.mockResolvedValue({
            nativeBalanceBaseUnits: new Decimal(0),
            reserveBalance: new Decimal(100_000),
        })
    })

    const warningFor = (amount: number, asset: AssetRef = ALGO) =>
        readAlgorandRecipientWarning({
            recipient: 'RECEIVER',
            asset,
            amount: new Decimal(amount),
            scope: SCOPE,
        })

    it('warns when the send leaves the recipient below its minimum balance', async () => {
        await expect(warningFor(50_000)).resolves.toEqual({
            title: {
                key: 'send_funds.confirmation.recipient_below_mbr.title',
            },
            body: [
                {
                    key: 'send_funds.confirmation.recipient_below_mbr.body',
                    params: { min: '0.1' },
                },
            ],
        })
        expect(mocks.fetchOnChainAccountState).toHaveBeenCalledWith(
            'RECEIVER',
            SCOPE,
        )
    })

    it('allows leaving an empty recipient at exactly zero', async () => {
        await expect(warningFor(0)).resolves.toBeUndefined()
    })

    it('allows a send that reaches the minimum balance', async () => {
        await expect(warningFor(100_000)).resolves.toBeUndefined()
    })

    it('never warns about a token send, and reads nothing for it', async () => {
        await expect(warningFor(1, USDC)).resolves.toBeUndefined()
        expect(mocks.fetchOnChainAccountState).not.toHaveBeenCalled()
    })
})

describe('algorandHoldingReserve', () => {
    it('is the per-asset minimum balance', () => {
        expect(algorandHoldingReserve(SCOPE)).toEqual(new Decimal(100_000))
    })
})
