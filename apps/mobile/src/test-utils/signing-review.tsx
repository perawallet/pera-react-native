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

/*
 * Integration harness for the interactive signing review sheet.
 *
 * Local (headless) sign requests are driven by the originating screen's own
 * confirmation UI and never mount `SignRequestView`. Interactive sources
 * (WalletConnect / webview / deeplink / multisig-cosign / arc60) surface the
 * review sheet via `SigningOverlays` → `useSignRequestDriver`. This harness
 * mounts `SigningOverlays` and enqueues a sign request so a test can drive the
 * real review UI end-to-end: assert the rendered summary/warnings, slide to
 * confirm, or reject — and observe the request's `approve`/`reject`/`error`
 * callbacks fire.
 *
 * `PWSlideToConfirm` is mocked to a tappable element in vitest.integration-setup
 * (its gesture can't be fired under jsdom), so `confirm()` is a plain click.
 */

import React, { useEffect, useRef } from 'react'
import { createHash } from 'crypto'
import { expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Address, Transaction, TransactionType } from 'algosdk'
import {
    useSigningRequest,
    type Arc60SignRequest,
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataSignResult,
    type SignRequest,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    useKMS,
    type Algo25KeyResult,
    type QuantumKeyResult,
} from '@perawallet/wallet-core-kms'
import {
    AccountTypes,
    useAccountsStore,
    type QuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import { renderHook } from '@testing-library/react'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { renderWithNavigation } from './renderWithNavigation'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
} from '../__integration__/__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
} from '../__integration__/__fixtures__/quantum'

export const REVIEW_SIGNER_ADDRESS = ALGO25_TEST_ADDRESS
export const REVIEW_RECEIVER_ADDRESS = HD_TEST_ADDRESS

const BASE_TX_PARAMS = {
    minFee: 1000n,
    // flatFee so the txn fee equals the passed `fee` exactly (matches the prior
    // behaviour of setting fee directly on the transaction).
    flatFee: true,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisID: 'mainnet-v1.0',
    // Must match the harness's active network (mainnet); the genesis-hash check rejects any txn that doesn't.
    // Re-wrap in a Uint8Array so it's the same realm algosdk's Transaction
    // constructor validates against (base64-js returns a foreign-realm view).
    genesisHash: new Uint8Array(
        decodeFromBase64('wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='),
    ),
}

/**
 * Mint a real algo25 key in the in-memory keystore from the pinned mnemonic and
 * register the matching account so the signing pipeline can actually sign for
 * it. Returns the account.
 */
export const seedAlgo25Signer = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'review-signer',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: keyResult!.seedKey.id ?? '',
        name: 'Review Signer',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountAddress(account.address)
    return account
}

/**
 * Mint a real quantum (Falcon) key from the pinned quantum mnemonic and
 * register the derived quantum account, alongside any accounts already
 * seeded. Returns the account.
 */
export const seedQuantumSigner = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: QuantumKeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonic: QUANTUM_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })
    const account: QuantumAccount = {
        id: 'review-quantum-signer',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: keyResult!.signKeyId,
        name: 'Quantum Review Signer',
    }
    const store = useAccountsStore.getState()
    store.setAccounts([...store.accounts, account])
    store.setSelectedAccountAddress(account.address)
    return account
}

export const buildPaymentTransaction = ({
    sender = REVIEW_SIGNER_ADDRESS,
    receiver = REVIEW_RECEIVER_ADDRESS,
    amount = 1_000_000n,
    fee = 1000n,
    closeRemainderTo,
    rekeyTo,
}: {
    sender?: string
    receiver?: string
    amount?: bigint
    fee?: bigint
    closeRemainderTo?: string
    rekeyTo?: string
} = {}): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender: Address.fromString(sender),
        suggestedParams: { ...BASE_TX_PARAMS, fee },
        ...(rekeyTo ? { rekeyTo: Address.fromString(rekeyTo) } : {}),
        paymentParams: {
            receiver: Address.fromString(receiver),
            amount,
            ...(closeRemainderTo
                ? { closeRemainderTo: Address.fromString(closeRemainderTo) }
                : {}),
        },
    })

type CallbackSpies = {
    approve: ReturnType<typeof vi.fn>
    reject: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
}

const makeCallbackSpies = (): CallbackSpies => ({
    approve: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
    error: vi.fn(async () => {}),
})

export type BuiltRequest<T extends SignRequest> = {
    request: T
} & CallbackSpies

/**
 * Build an interactive transaction sign request (defaults: a single payment
 * from the seeded signer, WalletConnect source, callback transport) with
 * captured approve/reject/error spies.
 */
export const buildTransactionSignRequest = ({
    txs,
    sourceType = 'walletconnect',
    overrides = {},
}: {
    txs?: Transaction[]
    sourceType?: TransactionSignRequest['sourceType']
    overrides?: Partial<TransactionSignRequest>
} = {}): BuiltRequest<TransactionSignRequest> => {
    const spies = makeCallbackSpies()
    const request: TransactionSignRequest = {
        id: `review-tx-${Math.round(Math.random() * 1e9)}`,
        type: 'transactions',
        transport: 'callback',
        sourceType,
        txs: txs ?? [buildPaymentTransaction()],
        approve: spies.approve as unknown as TransactionSignRequest['approve'],
        reject: spies.reject as unknown as TransactionSignRequest['reject'],
        error: spies.error as unknown as TransactionSignRequest['error'],
        ...overrides,
    }
    return { request, ...spies }
}

/**
 * Build an interactive arbitrary-data (`algo_signData`) sign request.
 */
export const buildArbitraryDataSignRequest = ({
    messages,
    sourceType = 'walletconnect',
    overrides = {},
}: {
    messages?: { signer?: string; data?: string; message?: string }[]
    sourceType?: ArbitraryDataSignRequest['sourceType']
    overrides?: Partial<ArbitraryDataSignRequest>
} = {}): BuiltRequest<ArbitraryDataSignRequest> => {
    const spies = makeCallbackSpies()
    const request: ArbitraryDataSignRequest = {
        id: `review-data-${Math.round(Math.random() * 1e9)}`,
        type: 'arbitrary-data',
        transport: 'callback',
        sourceType,
        data: (messages ?? [{ message: 'Sign me' }]).map(m => ({
            signer: m.signer ?? REVIEW_SIGNER_ADDRESS,
            data: m.data ?? 'aGVsbG8=', // "hello"
            message: m.message ?? 'Sign me',
            chainId: 416001,
        })),
        approve: spies.approve as unknown as (
            signed: PeraArbitraryDataSignResult[],
        ) => Promise<void>,
        reject: spies.reject as unknown as ArbitraryDataSignRequest['reject'],
        error: spies.error as unknown as ArbitraryDataSignRequest['error'],
        ...overrides,
    }
    return { request, ...spies }
}

/**
 * Build a valid ARC-60 AUTH (SIWA) sign request: a canonical SIWA payload whose
 * `account_address` is the signer, with `authenticatorData[0:32] === sha256(domain)`
 * so it passes host-side validation and signs cleanly. Set `verifiedOrigin` to a
 * host different from `domain` to exercise the origin-mismatch warning.
 */
export const buildArc60SignRequest = ({
    domain = 'arc60.io',
    signer = REVIEW_SIGNER_ADDRESS,
    verifiedOrigin,
    sourceType = 'webview',
    overrides = {},
}: {
    domain?: string
    signer?: string
    verifiedOrigin?: string
    sourceType?: Arc60SignRequest['sourceType']
    overrides?: Partial<Arc60SignRequest>
} = {}): BuiltRequest<Arc60SignRequest> => {
    const spies = makeCallbackSpies()

    // Keys inserted in lexicographic order so JSON.stringify yields the RFC-8785
    // canonical form parseSiwa requires (flat ASCII string values only).
    const siwa = {
        account_address: signer,
        chain_id: '283',
        domain,
        nonce: 'nonce-12345',
        type: 'ed25519',
        uri: `https://${domain}`,
        version: '1',
    }
    const jsonString = JSON.stringify(siwa)
    const data = encodeToBase64(new TextEncoder().encode(jsonString))

    const rpIdHash = new Uint8Array(
        createHash('sha256').update(Buffer.from(domain, 'utf8')).digest(),
    )
    const authenticatorData = new Uint8Array(37)
    authenticatorData.set(rpIdHash.subarray(0, 32), 0)

    const request: Arc60SignRequest = {
        id: `review-arc60-${Math.round(Math.random() * 1e9)}`,
        type: 'arc60',
        transport: 'callback',
        sourceType,
        verifiedOrigin,
        stdSigData: { data, signer, domain, authenticatorData },
        metadata: { scope: 1, encoding: 'base64' },
        approve: spies.approve as unknown as (
            signed: PeraArbitraryDataSignResult[],
        ) => Promise<void>,
        reject: spies.reject as unknown as Arc60SignRequest['reject'],
        error: spies.error as unknown as Arc60SignRequest['error'],
        ...overrides,
    }
    return { request, ...spies }
}

/**
 * Mount the signing overlays and enqueue `request` so the interactive review
 * sheet opens. Returns the render result plus `confirm()`/`reject()` helpers.
 */
export const renderSignReview = (request: SignRequest) => {
    const Host = () => {
        const { addSignRequest } = useSigningRequest()
        const { setPreference } = usePreferences()
        const enqueued = useRef(false)
        useEffect(() => {
            if (enqueued.current) return
            enqueued.current = true
            // Suppress the once-per-device transaction-request FAQ sheet so it
            // doesn't open a competing bottom sheet during the test.
            setPreference('hasSeenTransactionRequestFAQ', true)
            addSignRequest(request)
        }, [addSignRequest, setPreference])
        return <SigningOverlays />
    }

    const result = renderWithNavigation(Host, 'SignReviewHost')

    return {
        ...result,
        /** Tap the slide-to-confirm control (mocked to a button in tests). */
        confirm: (testID = 'signing-confirm-slide') =>
            fireEvent.click(screen.getByTestId(testID)),
        /** Tap the Cancel button (i18n returns the key as-is in tests). */
        reject: () => fireEvent.click(screen.getByText('common.cancel.label')),
    }
}

// re-export commonly needed bits so test files import from one place
export { screen, waitFor, fireEvent } from '@testing-library/react'
