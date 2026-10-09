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

import {
    addressFromPQKey,
    ALGORAND_ZERO_ADDRESS_STRING,
    encodeMsgpack,
    makePaymentTxnWithSuggestedParamsFromObject,
    msgpackRawDecodeAsMap,
    msgpackRawEncode,
    Address,
    SignedTransaction,
    type EncodedMultisig,
    type EncodedPQSig,
    type Transaction,
} from 'algosdk'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    findAccountByAddressOn,
    getAuthAccount,
    isHardwareWalletAccount,
    isMultisigAccount,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { algorandMultisigOf } from '../accounts/multisig-participants'
import {
    algorandAddressOf,
    algorandKeyOf,
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
} from '../accounts/vocabulary'
import { resolvePQSigningInfo } from '@perawallet/wallet-core-kms'
import {
    encodeToBase64,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { PQ_SCHEMES } from '../blockchain/pq/schemes'
import { storedQuantumPublicKey } from '../accounts/quantum'

export type EmptySignatureFields = {
    msig?: EncodedMultisig
    pqsig?: EncodedPQSig
    sgnr?: Address
}

let placeholderTxn: Transaction | undefined

// Only carries the signature fields through algosdk's codec; `txn` is dropped.
const getPlaceholderTxn = (): Transaction => {
    placeholderTxn ??= makePaymentTxnWithSuggestedParamsFromObject({
        sender: ALGORAND_ZERO_ADDRESS_STRING,
        receiver: ALGORAND_ZERO_ADDRESS_STRING,
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
    return placeholderTxn
}

/**
 * Base64 of the canonical msgpack `SignedTransaction` minus `txn`, as use-wallet
 * defines it. algosdk omits empty signature bytes, so plain ed25519 is `gA==`.
 */
export const encodeEmptySignature = (fields: EmptySignatureFields): string => {
    const stxn = new SignedTransaction({ ...fields, txn: getPlaceholderTxn() })
    const encoded = msgpackRawDecodeAsMap(encodeMsgpack(stxn)) as Map<
        string,
        unknown
    >
    encoded.delete('txn')
    return encodeToBase64(msgpackRawEncode(encoded))
}

/**
 * The signature fields `auth`'s key produces, with no signature bytes; `null`
 * for a key this wallet can't describe. Throws for a legacy multisig record.
 */
export const emptySignatureFieldsOf = (
    auth: WalletAccount,
): Nullable<Omit<EmptySignatureFields, 'sgnr'>> => {
    if (isQuantumAccount(auth)) {
        // The stored key first: the extension's offscreen document has no
        // keystore it can open. `pq.scheme` admits only Falcon-1024.
        const stored = storedQuantumPublicKey(auth)
        const info = stored
            ? { schemeId: 'falcon1024' as const, publicKey: stored }
            : resolvePQSigningInfo(
                  getKeystoreStore().state.keys,
                  algorandKeyOf(auth) ?? '',
              )
        if (!info) return null
        const scheme = PQ_SCHEMES[info.schemeId]
        const { salt } = addressFromPQKey(scheme, info.publicKey)
        return {
            pqsig: {
                sch: scheme,
                slt: salt,
                pk: info.publicKey,
                sig: new Uint8Array(0),
            },
        }
    }
    if (isMultisigAccount(auth)) {
        const details = algorandMultisigOf(auth)
        if (!details) return null
        return {
            msig: {
                v: details.version,
                thr: details.threshold,
                subsig: details.addresses.map(address => ({
                    pk: Address.fromString(address).publicKey,
                })),
            },
        }
    }
    if (
        isAlgo25Account(auth) ||
        isHDWalletAccount(auth) ||
        isHardwareWalletAccount(auth)
    ) {
        return {}
    }
    return null
}

/**
 * `algo_getEmptySignatures`'s answer on the active network, whose rekey state
 * the account records mirror. An address left out reads as unknown to the
 * dApp, which is the honest answer for a watch authority, an auth account
 * this wallet doesn't hold, or a key the keystore can't describe.
 */
export const algorandEmptySignaturesFor = (
    addresses: readonly string[],
): Record<string, string> => {
    const accounts = useAccountsStore.getState().accounts
    const result: Record<string, string> = {}
    for (const address of addresses) {
        const account = findAccountByAddressOn(
            accounts,
            LEGACY_CHAIN_ID,
            address,
        )
        if (!account) continue
        const auth = getAuthAccount(account, accounts, LEGACY_CHAIN_ID)
        const authAddress = auth ? algorandAddressOf(auth) : undefined
        if (!auth || !authAddress) continue
        try {
            const fields = emptySignatureFieldsOf(auth)
            if (!fields) continue
            result[address] = encodeEmptySignature(
                authAddress === address
                    ? fields
                    : { ...fields, sgnr: Address.fromString(authAddress) },
            )
        } catch (error) {
            logger.warn('[WC] could not build an empty signature', { error })
        }
    }
    return result
}
