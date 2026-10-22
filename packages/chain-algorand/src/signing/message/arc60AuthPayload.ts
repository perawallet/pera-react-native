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

import { Address } from 'algosdk'
import {
    canSignArbitraryData,
    InvalidBip44PathError,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    AuthData,
    AuthDataMetadata,
} from '@perawallet/wallet-core-signing'
import { assertAlgorandBip44PathMatches } from '../../accounts/bip44'
import {
    accountType,
    algorandAddressOf,
    algorandKeyOf,
    isStandaloneAccount,
    isHDWalletAccount,
    isQuantumAccount,
} from '../../accounts/vocabulary'
import { buildArc60AuthSigningPayload, validateArc60AuthRequest } from './arc60'
import { encodeAlgorandLedgerMessage } from '../../ledger/messagePayload'
import { Arc60FailedHdPathError, Arc60InvalidSignerError } from './arc60-errors'

/**
 * Validates an ARC-60 AUTH-scope request for the given signer account and
 * returns the bytes to sign.
 * Throws spec-aligned errors (`Arc60*Error`) for every rejection path so the
 * caller can surface a precise reason to the dApp.
 *
 * Local-key only (Algo25 / HDWallet / quantum); a Ledger account plans through
 * {@link arc60LedgerRequestFor}.
 */
export const arc60AuthPayloadFor = (
    account: WalletAccount,
    authData: AuthData,
    metadata: AuthDataMetadata,
    accounts: WalletAccount[],
): Uint8Array => {
    // `account` is the account the dApp named as `signer`. Data signing never
    // follows a rekey (see resolveSigningAccount), so a keyless rekeyed signer
    // is refused here, the spec's ERROR_INVALID_SIGNER, rather than signed for
    // by its auth account.
    const address = algorandAddressOf(account) ?? ''
    const keyPairId = algorandKeyOf(account)
    if (!canSignArbitraryData(account) || !keyPairId) {
        throw new Arc60InvalidSignerError(
            address,
            `account ${address} cannot sign ARC-60 payloads`,
        )
    }

    // Shared host-side validation (scope / domain / SIWA / signer).
    const { decodedData } = validateArc60AuthRequest(
        authData,
        metadata,
        accounts,
    )

    const payload = buildArc60AuthSigningPayload(
        decodedData,
        authData.authenticatorData,
    )

    const { hdPath } = authData

    if (isHDWalletAccount(account)) {
        if (hdPath) {
            try {
                assertAlgorandBip44PathMatches(hdPath, account.custody.hd)
            } catch (caught) {
                if (caught instanceof InvalidBip44PathError) {
                    // Project the generic accounts-package error into the
                    // ARC-60 spec-aligned shape so the dApp gets
                    // `ERROR_FAILED_HD_PATH` semantics.
                    throw new Arc60FailedHdPathError(
                        caught.hdPath,
                        caught.message,
                    )
                }
                throw caught
            }
        }
    } else if (isStandaloneAccount(account) || isQuantumAccount(account)) {
        // Neither Algo25 nor quantum accounts are BIP-44 derived, so an
        // hdPath is meaningless for them and is rejected rather than ignored.
        if (hdPath) {
            throw new Arc60FailedHdPathError(
                hdPath,
                `${accountType(account)} accounts have no BIP44 derivation path`,
            )
        }
    } else {
        // canSignArbitraryData ⇒ hasSigningKeys, which is true for Algo25,
        // HDWallet and quantum; this branch is a defensive type-system
        // fallback for any account type not yet handled above.
        throw new Arc60InvalidSignerError(
            address,
            `unsupported account type ${accountType(account)}`,
        )
    }

    // ARC-60 payload is signed as-is — no MX prefix.
    return payload
}

/**
 * A Ledger account's ARC-60 request: the same host-side validation, with the
 * request the Algorand app hashes on-device as `devicePayload`. `hdPath` is
 * not checked, because the device derives its key from the account index.
 */
export const arc60LedgerRequestFor = (
    account: WalletAccount,
    authData: AuthData,
    metadata: AuthDataMetadata,
    accounts: WalletAccount[],
): { payload: Uint8Array; devicePayload: Uint8Array } => {
    const address = algorandAddressOf(account) ?? ''
    const { decodedData } = validateArc60AuthRequest(
        authData,
        metadata,
        accounts,
    )
    return {
        payload: buildArc60AuthSigningPayload(
            decodedData,
            authData.authenticatorData,
        ),
        devicePayload: encodeAlgorandLedgerMessage({
            data: authData.data,
            signerPublicKey: Address.fromString(address).publicKey,
            domain: authData.domain,
            authenticatorData: authData.authenticatorData,
            ...(authData.requestId !== undefined && {
                requestId: authData.requestId,
            }),
            scope: metadata.scope,
            encoding: metadata.encoding,
        }),
    }
}
