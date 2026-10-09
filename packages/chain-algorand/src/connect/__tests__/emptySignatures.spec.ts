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

// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    Address,
    addressWithSignersFromRawPQSigner,
    FALCON_1024_SCHEME,
    generateAccount,
    makePaymentTxnWithSuggestedParamsFromObject,
    msgpackRawDecodeAsMap,
    msgpackRawEncode,
} from 'algosdk'
import { generateKey } from 'falcon-1024'
import {
    accountsChainAdapters,
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import {
    standaloneAccount,
    multisigAccount,
    quantumAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import { algorandAccountsAdapter } from '../../accounts/adapter'
import { deriveQuantumAddress } from '../../blockchain/pq/quantumAdapter'
import { algorandEmptySignaturesFor } from '../emptySignatures'

const state = vi.hoisted(() => ({
    accounts: [] as unknown[],
    pqPublicKey: new Uint8Array(),
    isKeystoreOpen: true,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountsStore: { getState: () => ({ accounts: state.accounts }) },
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    resolvePQSigningInfo: () => {
        if (!state.isKeystoreOpen) throw new Error('keystore cannot open')
        return { schemeId: 'falcon1024', publicKey: state.pqPublicKey }
    },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: [] } }),
}))

// Signer resolution reads the selected network through the provider, which
// this node environment can't load.
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

const { publicKey: PQ_PUBLIC_KEY } = generateKey(new Uint8Array(48).fill(3))
const PQ_ADDRESS = deriveQuantumAddress(PQ_PUBLIC_KEY)
const [ED_A, ED_B, ED_C] = Array.from({ length: 3 }, () =>
    generateAccount().addr.toString(),
)

const algo25 = (address: string, authorityAddress?: string): WalletAccount =>
    standaloneAccount(address, { authorityAddress })

const quantum = (address: string): WalletAccount => quantumAccount(address)

const watch = (address: string): WalletAccount => watchAccount(address)

const fieldsOf = (value: string | undefined): Map<string, unknown> =>
    msgpackRawDecodeAsMap(decodeFromBase64(value ?? '')) as Map<string, unknown>

// algosdk's own empty signer is the reference use-wallet specifies for PQ.
const algosdkPqEmptySignature = async (sender: string): Promise<string> => {
    const { emptyTxnSigner } = addressWithSignersFromRawPQSigner(
        {
            pqScheme: FALCON_1024_SCHEME,
            pqPublicKey: PQ_PUBLIC_KEY,
            pqSigner: () => Promise.resolve(new Uint8Array()),
        },
        Address.fromString(sender),
    )
    const txn = makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: sender,
        amount: 0,
        suggestedParams: {
            fee: 0,
            minFee: 0,
            firstValid: 0,
            lastValid: 0,
            genesisHash: new Uint8Array(32),
            flatFee: true,
        },
    })
    const [stxn] = await emptyTxnSigner([txn], [0])
    const fields = msgpackRawDecodeAsMap(stxn) as Map<string, unknown>
    fields.delete('txn')
    return encodeToBase64(msgpackRawEncode(fields))
}

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
    state.accounts = []
    state.pqPublicKey = PQ_PUBLIC_KEY
    state.isKeystoreOpen = true
})

describe('algorandEmptySignaturesFor', () => {
    it('encodes an unrekeyed ed25519 account as an empty map', () => {
        state.accounts = [algo25(ED_A)]

        expect(algorandEmptySignaturesFor([ED_A])).toEqual({ [ED_A]: 'gA==' })
    })

    it('adds only sgnr for an ed25519 account rekeyed to a held ed25519 key', () => {
        state.accounts = [algo25(ED_A, ED_B), algo25(ED_B)]

        const fields = fieldsOf(algorandEmptySignaturesFor([ED_A])[ED_A])

        expect([...fields.keys()]).toEqual(['sgnr'])
        expect(fields.get('sgnr')).toEqual(Address.fromString(ED_B).publicKey)
    })

    it('matches algosdk for a post-quantum account', async () => {
        state.accounts = [quantum(PQ_ADDRESS)]

        expect(algorandEmptySignaturesFor([PQ_ADDRESS])).toEqual({
            [PQ_ADDRESS]: await algosdkPqEmptySignature(PQ_ADDRESS),
        })
    })

    // The extension's offscreen document has no keystore it can open.
    it('builds the pqsig from the key stored on the account when the keystore cannot open', async () => {
        state.isKeystoreOpen = false
        state.accounts = [
            {
                ...quantum(PQ_ADDRESS),
                chains: {
                    algorand: {
                        address: PQ_ADDRESS,
                        native: {
                            family: 'algorand',
                            pq: {
                                scheme: 'falcon-1024',
                                publicKey: encodeToBase64(PQ_PUBLIC_KEY),
                            },
                        },
                    },
                },
            },
        ]

        expect(algorandEmptySignaturesFor([PQ_ADDRESS])).toEqual({
            [PQ_ADDRESS]: await algosdkPqEmptySignature(PQ_ADDRESS),
        })
    })

    it('matches algosdk, sgnr included, for an account rekeyed to a post-quantum key', async () => {
        state.accounts = [algo25(ED_A, PQ_ADDRESS), quantum(PQ_ADDRESS)]

        const result = algorandEmptySignaturesFor([ED_A])

        expect(result).toEqual({
            [ED_A]: await algosdkPqEmptySignature(ED_A),
        })
        expect([...fieldsOf(result[ED_A]).keys()].sort()).toEqual([
            'pqsig',
            'sgnr',
        ])
    })

    it('lists every participant key, unsigned, for a multisig account', () => {
        state.accounts = [
            multisigAccount(ED_C, {
                threshold: 2,
                addresses: [ED_A, ED_B],
                version: 1,
            }),
        ]

        const msig = fieldsOf(algorandEmptySignaturesFor([ED_C])[ED_C]).get(
            'msig',
        ) as Map<string, unknown>

        expect(msig.get('v')).toBe(1n)
        expect(msig.get('thr')).toBe(2n)
        expect(msig.get('subsig')).toEqual([
            new Map([['pk', Address.fromString(ED_A).publicKey]]),
            new Map([['pk', Address.fromString(ED_B).publicKey]]),
        ])
    })

    it('leaves out what it cannot classify', () => {
        state.accounts = [watch(ED_A), algo25(ED_B, ED_C)]

        // A watch account, a rekey target not held, an address not held.
        expect(algorandEmptySignaturesFor([ED_A, ED_B, PQ_ADDRESS])).toEqual({})
    })
})
