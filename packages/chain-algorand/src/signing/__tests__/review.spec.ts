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
    OnApplicationComplete,
    Transaction,
    TransactionType,
    type Address,
} from 'algosdk'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    type PeraTransactionType,
} from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    AnalysisError,
    GenesisHashMismatchError,
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
import {
    TEST_SUGGESTED_PARAMS,
    makeTestAddress,
    makeTestAssetTransferTx,
    makeTestPaymentTx,
} from './transactions'

const WALLET = makeTestAddress(1)
const SECOND = makeTestAddress(3)
const OTHER = makeTestAddress(2)
const TARGET = makeTestAddress(9)

const context: AnalysisContext = {
    scope: scopeForLegacyNetwork('mainnet'),
    accounts: [WALLET, SECOND].map(
        address => ({ address: address.toString() }) as WalletAccount,
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
    summaryTypes: PeraTransactionType[]
    /** Charged its transactions' own fees, rather than nothing. */
    isCharged: boolean
    warningTypes: AnalysisWarning['type'][]
    riskLevel: SignableAnalysis['riskLevel']
    signableAddresses: string[]
}

const SIGNER = [WALLET.toString()]
const EVERY_ACCOUNT = [WALLET.toString(), SECOND.toString()]

const signed = (
    summaryType: PeraTransactionType,
    warningTypes: AnalysisWarning['type'][] = [],
): Expected => ({
    summaryTypes: [summaryType],
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
    ['a payment', transactionsGroup([KINDS.payment]), signed('payment')],
    [
        'an asset transfer',
        transactionsGroup([KINDS.assetTransfer]),
        signed('asset-transfer'),
    ],
    [
        'an asset opt-in',
        transactionsGroup([KINDS.optIn]),
        signed('asset-opt-in'),
    ],
    [
        'an asset clawback',
        transactionsGroup([KINDS.clawback]),
        signed('asset-clawback'),
    ],
    [
        'an asset config',
        transactionsGroup([KINDS.assetConfig]),
        signed('asset-config'),
    ],
    [
        'an asset freeze',
        transactionsGroup([KINDS.assetFreeze]),
        signed('asset-freeze'),
    ],
    ['an app call', transactionsGroup([KINDS.appCall]), signed('app-call')],
    [
        'a key registration',
        transactionsGroup([KINDS.keyreg]),
        signed('key-registration'),
    ],
    ['a rekey', transactionsGroup([KINDS.rekey]), signed('payment', ['rekey'])],
    [
        'a rekey a wallet account authorises for another sender',
        transactionsGroup([KINDS.foreignSenderRekey]),
        signed('payment', ['rekey']),
    ],
    [
        'an account close-out',
        transactionsGroup([KINDS.accountClose]),
        signed('payment', ['close-account']),
    ],
    [
        'an asset close-out',
        transactionsGroup([KINDS.assetClose]),
        signed('asset-opt-out', ['close-account']),
    ],
    [
        'a dApp group whose bytes round-trip',
        transactionsGroup([KINDS.payment], {
            rawTransactionsBase64: [rawOf(KINDS.payment)],
        }),
        signed('payment'),
    ],
    [
        'a rekey no wallet account signs',
        transactionsGroup([KINDS.rekey], { signer: OTHER }),
        {
            summaryTypes: ['payment'],
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
            summaryTypes: [],
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
            summaryTypes: [],
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
            summaryTypes: [],
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
            summaryTypes: [],
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

        expect(analysis.transactionSummaries.map(s => s.type)).toEqual(
            expected.summaryTypes,
        )
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

    it('summarises each transaction from its own payload, guessing nothing for a contract call', async () => {
        const note = new Uint8Array(new TextEncoder().encode('hello'))
        const withNote = makeTestPaymentTx(WALLET, {
            receiver: OTHER,
            amount: 5n,
            note,
        })
        const group = transactionsGroup([
            withNote,
            KINDS.assetTransfer,
            KINDS.appCall,
        ])

        const analysis = await review(group)

        expect(analysis.transactionSummaries).toEqual([
            {
                type: 'payment',
                sender: WALLET.toString(),
                receiver: OTHER.toString(),
                amount: 5n,
                note: 'hello',
            },
            {
                type: 'asset-transfer',
                sender: WALLET.toString(),
                receiver: OTHER.toString(),
                amount: 5n,
                assetId: 42n,
                note: '',
            },
            { type: 'app-call', sender: WALLET.toString(), note: '' },
        ])
        expect(analysis.totalFees).toBe(feesOf(group))
    })

    it("leaves out a note that isn't valid UTF-8", async () => {
        vi.stubGlobal(
            'TextDecoder',
            class {
                decode(): never {
                    throw new TypeError('invalid UTF-8')
                }
            },
        )

        const analysis = await review(transactionsGroup([KINDS.payment]))

        expect(analysis.transactionSummaries[0]).not.toHaveProperty('note')
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

    it('reports any other failure as an analysis error', async () => {
        const unreadable = {
            get sender(): never {
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
