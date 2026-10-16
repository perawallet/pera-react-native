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

import { afterEach, describe, it, expect, vi } from 'vitest'
import {
    Address,
    OnApplicationComplete,
    Transaction,
    TransactionType,
} from 'algosdk'
import { standaloneAccount } from '../../__tests__/algorandAccounts'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    AnalysisError,
    GenesisHashMismatchError,
    InvalidSignableDataError,
    reviewGroup,
    TransactionRoundTripError,
    type AnalysisContext,
    type AnalysisWarning,
    type SignableAnalysis,
    type SignableGroup,
} from '@perawallet/wallet-core-signing'

// The genesis check runs unmocked in the contract spec; these fixtures share
// one test genesis.
vi.mock('../assertTransactionsMatchNetwork', () => ({
    assertTransactionsMatchNetwork: vi.fn(),
}))

// A custom network's genesis lives only in its saved config, so the check must
// use the resolved hash; mainnet can't tell the two sources apart.
vi.mock('../../blockchain', async importOriginal => ({
    ...(await importOriginal<typeof import('../../blockchain')>()),
    getExpectedGenesisHash: vi.fn(() => 'RESOLVED_GENESIS'),
}))

import { encodeTransactionRaw, getExpectedGenesisHash } from '../../blockchain'
import { algorandReviewerAdapter } from '../adapter'
import { assertTransactionsMatchNetwork } from '../assertTransactionsMatchNetwork'
import { generateMultisigAddress } from '../../multisig/address'
import {
    TEST_SUGGESTED_PARAMS,
    asUnsignedAlgorandTransaction,
    makeUnsignedAlgorandTransaction,
    makeTestAddress,
    makeTestAssetTransferTx,
    makeTestPaymentTx,
} from './transactions'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const WALLET = makeTestAddress(1)
const SECOND = makeTestAddress(3)
const OTHER = makeTestAddress(2)
const TARGET = makeTestAddress(9)

const context: AnalysisContext = {
    scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
    accounts: [WALLET, SECOND].map(address =>
        standaloneAccount(address.toString()),
    ),
}

const transactionsGroup = (
    transactions: Transaction[],
    {
        signer = WALLET,
        rawTransactionsBase64,
    }: { signer?: Address; rawTransactionsBase64?: string[] } = {},
): SignableGroup =>
    ({
        signerAddress: signer.toString(),
        source: { type: 'local' },
        data: {
            type: 'transactions',
            transactions,
            indicesToSign: transactions.map((_, i) => i),
            rawTransactionsBase64,
        },
    }) as unknown as SignableGroup

const chainNeutralGroup = (payload: unknown): SignableGroup =>
    ({
        signerAddress: WALLET.toString(),
        source: { type: 'local' },
        data: {
            type: 'transactions',
            transactions: [{ ...makeUnsignedAlgorandTransaction(), payload }],
            chainData: {},
        },
    }) as unknown as SignableGroup

const authDataGroup = (
    domain: string,
    verifiedOrigin?: string,
): SignableGroup =>
    ({
        signerAddress: WALLET.toString(),
        source: { type: 'webview', verifiedOrigin },
        data: {
            type: 'auth-data',
            authData: { domain, signer: WALLET.toString() },
            metadata: { scope: 1, encoding: 'base64' },
        },
    }) as unknown as SignableGroup

const rawOf = (txn: Transaction): string =>
    encodeToBase64(encodeTransactionRaw(txn))

const payment = makeTestPaymentTx(WALLET, { receiver: OTHER, amount: 5n })

const transaction = (
    params: ConstructorParameters<typeof Transaction>[0],
): Transaction => new Transaction(params)

const KINDS = {
    payment,
    assetTransfer: makeTestAssetTransferTx(WALLET, {
        assetIndex: 42n,
        receiver: OTHER,
        amount: 5n,
    }),
    optIn: makeTestAssetTransferTx(WALLET, {
        assetIndex: 42n,
        receiver: WALLET,
    }),
    clawback: transaction({
        type: TransactionType.axfer,
        sender: WALLET,
        assetTransferParams: {
            assetIndex: 42n,
            receiver: WALLET,
            amount: 5n,
            assetSender: OTHER,
        },
        suggestedParams: TEST_SUGGESTED_PARAMS,
    }),
    assetConfig: transaction({
        type: TransactionType.acfg,
        sender: WALLET,
        assetConfigParams: { assetIndex: 42n, manager: WALLET },
        suggestedParams: TEST_SUGGESTED_PARAMS,
    }),
    assetFreeze: transaction({
        type: TransactionType.afrz,
        sender: WALLET,
        assetFreezeParams: {
            assetIndex: 42n,
            freezeTarget: OTHER,
            frozen: true,
        },
        suggestedParams: TEST_SUGGESTED_PARAMS,
    }),
    appCall: transaction({
        type: TransactionType.appl,
        sender: WALLET,
        appCallParams: {
            appIndex: 99n,
            onComplete: OnApplicationComplete.NoOpOC,
        },
        suggestedParams: TEST_SUGGESTED_PARAMS,
    }),
    keyreg: transaction({
        type: TransactionType.keyreg,
        sender: WALLET,
        keyregParams: {},
        suggestedParams: TEST_SUGGESTED_PARAMS,
    }),
    rekey: makeTestPaymentTx(WALLET, { receiver: OTHER, rekeyTo: TARGET }),
    foreignSenderRekey: makeTestPaymentTx(OTHER, {
        receiver: OTHER,
        rekeyTo: TARGET,
    }),
    accountClose: makeTestPaymentTx(WALLET, {
        receiver: OTHER,
        closeRemainderTo: TARGET,
    }),
    assetClose: makeTestAssetTransferTx(WALLET, {
        assetIndex: 42n,
        receiver: OTHER,
        closeRemainderTo: TARGET,
    }),
}

type Expected = {
    /** Charged its transactions' own fees, rather than nothing. */
    isCharged: boolean
    warningTypes: AnalysisWarning['type'][]
    riskLevel: SignableAnalysis['riskLevel']
    signableAddresses: string[]
}

const SIGNER = [WALLET.toString()]
const EVERY_ACCOUNT = [WALLET.toString(), SECOND.toString()]

const signed = (warningTypes: AnalysisWarning['type'][] = []): Expected => ({
    isCharged: true,
    warningTypes,
    riskLevel: warningTypes.length > 0 ? 'high' : 'low',
    signableAddresses: SIGNER,
})

const feesOf = (group: SignableGroup): bigint =>
    group.data.type === 'transactions'
        ? group.data.transactions.reduce((sum, tx) => sum + (tx.fee ?? 0n), 0n)
        : 0n

const CASES: [string, SignableGroup, Expected][] = [
    ['a payment', transactionsGroup([KINDS.payment]), signed()],
    ['an asset transfer', transactionsGroup([KINDS.assetTransfer]), signed()],
    ['an asset opt-in', transactionsGroup([KINDS.optIn]), signed()],
    ['an asset clawback', transactionsGroup([KINDS.clawback]), signed()],
    ['an asset config', transactionsGroup([KINDS.assetConfig]), signed()],
    ['an asset freeze', transactionsGroup([KINDS.assetFreeze]), signed()],
    ['an app call', transactionsGroup([KINDS.appCall]), signed()],
    ['a key registration', transactionsGroup([KINDS.keyreg]), signed()],
    ['a rekey', transactionsGroup([KINDS.rekey]), signed(['rekey'])],
    [
        'a rekey a wallet account authorises for another sender',
        transactionsGroup([KINDS.foreignSenderRekey]),
        signed(['rekey']),
    ],
    [
        'an account close-out',
        transactionsGroup([KINDS.accountClose]),
        signed(['close-account']),
    ],
    [
        'an asset close-out',
        transactionsGroup([KINDS.assetClose]),
        signed(['close-account']),
    ],
    [
        'a dApp group whose bytes round-trip',
        transactionsGroup([KINDS.payment], {
            rawTransactionsBase64: [rawOf(KINDS.payment)],
        }),
        signed(),
    ],
    [
        'a rekey no wallet account signs',
        transactionsGroup([KINDS.rekey], { signer: OTHER }),
        {
            isCharged: false,
            warningTypes: [],
            riskLevel: 'low',
            signableAddresses: [],
        },
    ],
    [
        'arbitrary data',
        {
            signerAddress: WALLET.toString(),
            source: { type: 'local' },
            data: { type: 'arbitrary-data', data: [] },
        } as unknown as SignableGroup,
        {
            isCharged: false,
            warningTypes: [],
            riskLevel: 'low',
            signableAddresses: EVERY_ACCOUNT,
        },
    ],
    [
        'a sign-in from the site that asked',
        authDataGroup('pera.app', 'https://pera.app'),
        {
            isCharged: false,
            warningTypes: [],
            riskLevel: 'low',
            signableAddresses: EVERY_ACCOUNT,
        },
    ],
    [
        'a sign-in with no origin to check, as over WalletConnect',
        authDataGroup('pera.app'),
        {
            isCharged: false,
            warningTypes: [],
            riskLevel: 'low',
            signableAddresses: EVERY_ACCOUNT,
        },
    ],
    [
        'a sign-in relayed from another site',
        authDataGroup('pera.app', 'https://evil.example'),
        {
            isCharged: false,
            warningTypes: ['suspicious'],
            riskLevel: 'high',
            signableAddresses: EVERY_ACCOUNT,
        },
    ],
]

const review = (group: SignableGroup): Promise<SignableAnalysis> =>
    reviewGroup(algorandReviewerAdapter, group, context)

describe('algorandReviewerAdapter review parts', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it.each(CASES)('reviews %s', async (_kind, group, expected) => {
        const analysis = await review(group)

        expect(analysis.totalFees).toBe(expected.isCharged ? feesOf(group) : 0n)
        expect(analysis.warnings.map(w => w.type)).toEqual(
            expected.warningTypes,
        )
        expect(analysis.riskLevel).toBe(expected.riskLevel)
        expect(analysis.signableAddresses).toEqual(expected.signableAddresses)
    })

    it("refuses bytes that don't round-trip to the decoded group", async () => {
        const group = transactionsGroup([KINDS.payment], {
            rawTransactionsBase64: [rawOf(KINDS.assetTransfer)],
        })

        await expect(
            algorandReviewerAdapter.decoder.decode(group, context),
        ).rejects.toBeInstanceOf(TransactionRoundTripError)
    })

    it("refuses a chain-neutral group whose request bytes don't round-trip to its payloads", async () => {
        const group = {
            signerAddress: WALLET.toString(),
            source: { type: 'walletconnect' },
            data: {
                type: 'transactions',
                transactions: [asUnsignedAlgorandTransaction(KINDS.payment)],
                chainData: {
                    algorand: {
                        indicesToSign: [0],
                        rawTransactionsBase64: [rawOf(KINDS.assetTransfer)],
                    },
                },
            },
        } as unknown as SignableGroup

        await expect(
            algorandReviewerAdapter.decoder.decode(group, context),
        ).rejects.toBeInstanceOf(TransactionRoundTripError)
    })

    it("checks the transactions against the selected network's resolved genesis", async () => {
        await review(transactionsGroup([KINDS.payment]))

        expect(getExpectedGenesisHash).toHaveBeenCalledWith('mainnet')
        expect(assertTransactionsMatchNetwork).toHaveBeenCalledWith(
            [KINDS.payment],
            'mainnet',
            'RESOLVED_GENESIS',
        )
    })

    it("refuses another network's transaction with the network error itself", async () => {
        vi.mocked(assertTransactionsMatchNetwork).mockImplementationOnce(() => {
            throw new GenesisHashMismatchError(
                'mainnet',
                0,
                'EXPECTED',
                'ACTUAL',
            )
        })

        await expect(
            review(transactionsGroup([KINDS.payment])),
        ).rejects.toBeInstanceOf(GenesisHashMismatchError)
    })

    it('reviews a chain-neutral transaction as the Algorand transaction it carries', async () => {
        const neutral = {
            signerAddress: WALLET.toString(),
            source: { type: 'local' },
            data: {
                type: 'transactions',
                transactions: [
                    {
                        ...makeUnsignedAlgorandTransaction(),
                        payload: { transaction: KINDS.rekey },
                    },
                ],
                chainData: {},
            },
        } as unknown as SignableGroup

        expect(await review(neutral)).toEqual(
            await review(transactionsGroup([KINDS.rekey])),
        )
    })

    it('lists every multisig participant the wallet holds as a signer', async () => {
        const addresses = [WALLET, SECOND, OTHER].map(a => a.toString())
        const msig = generateMultisigAddress(1, 2, addresses)
        const neutral = chainNeutralGroup({
            transaction: makeTestPaymentTx(Address.fromString(msig), {
                receiver: OTHER,
            }),
            multisig: { version: 1, threshold: 2, addresses },
        })

        const analysis = await review(neutral)

        expect(analysis.signableAddresses).toEqual([
            WALLET.toString(),
            SECOND.toString(),
        ])
    })

    it("refuses an authority a wallet sender isn't rekeyed to", async () => {
        const neutral = chainNeutralGroup({
            transaction: KINDS.payment,
            authorizer: SECOND.toString(),
        })

        await expect(review(neutral)).rejects.toBeInstanceOf(
            InvalidSignableDataError,
        )
    })

    it("refuses for good a chain-neutral payload the planner can't read", async () => {
        const group = {
            signerAddress: WALLET.toString(),
            source: { type: 'local' },
            data: {
                type: 'transactions',
                transactions: [makeUnsignedAlgorandTransaction()],
                chainData: {},
            },
        } as unknown as SignableGroup

        const error = await review(group).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(InvalidSignableDataError)
        expect(error).toMatchObject({
            metadata: expect.objectContaining({ retryable: false }),
        })
    })

    it('reports any other failure as an analysis error', async () => {
        const unreadable = {
            get fee(): never {
                throw new Error('unreadable transaction')
            },
        } as unknown as Transaction

        await expect(
            review(transactionsGroup([unreadable])),
        ).rejects.toBeInstanceOf(AnalysisError)
    })

    it('lets a request the app built sign without review, even a rekey', async () => {
        const analysis = await review(transactionsGroup([KINDS.rekey]))

        expect(algorandReviewerAdapter.policy.autoApproveLocal(analysis)).toBe(
            true,
        )
    })
})
