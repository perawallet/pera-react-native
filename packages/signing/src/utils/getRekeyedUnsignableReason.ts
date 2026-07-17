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
    resolveSignerForAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isArbitraryDataRequest,
    isArc60Request,
    isTransactionRequest,
    type SignRequest,
} from '../models'

export type RekeyedUnsignableReason = {
    kind: 'authMissing' | 'authIsWatch'
    senderAddress: string
    authAddress: string
}

// Every signer the request names, across all transactions/data entries — not
// just the first (a mixed group can hide its unsignable sender in a later
// slot). Unlike `resolveSignerAddress`, which serves the hardware overlay and
// deliberately returns one representative signer.
const resolveAllSignerAddresses = (request: SignRequest): string[] => {
    if (isTransactionRequest(request)) {
        return request.txs
            .map(
                (tx, index) =>
                    request.signerOverrides?.get(index) ??
                    tx.sender?.toString?.(),
            )
            .filter((address): address is string => !!address)
    }
    if (isArbitraryDataRequest(request)) {
        return request.data
            .map(entry => entry.signer)
            .filter((address): address is string => !!address)
    }
    if (isArc60Request(request)) {
        const signer = request.stdSigData?.signer
        return signer ? [signer] : []
    }
    return []
}

/**
 * Returns why a held sender in `request` cannot sign because of its rekey
 * state — its auth address is not in the wallet (`authMissing`) or is a
 * watch-only account (`authIsWatch`) — or `null` when no such sender exists.
 *
 * Lets the signing UI block the request up-front with a specific explanation
 * instead of letting the pipeline fail at machine init with a generic
 * "Signing failed". `multisig-cosign` requests pin a signable participant
 * and are excluded; senders not held in the wallet are skipped (they resolve
 * their own signability upstream).
 */
export const getRekeyedUnsignableReason = (
    request: SignRequest,
    accounts: WalletAccount[],
): RekeyedUnsignableReason | null => {
    if (request.sourceType === 'multisig-cosign') return null

    const uniqueSigners = [...new Set(resolveAllSignerAddresses(request))]
    for (const address of uniqueSigners) {
        const account = accounts.find(a => a.address === address)
        if (!account) continue
        const resolution = resolveSignerForAccount(account, accounts)
        if (resolution.kind === 'authMissing') {
            return {
                kind: 'authMissing',
                senderAddress: address,
                authAddress: resolution.authAddress,
            }
        }
        if (resolution.kind === 'authIsWatch') {
            return {
                kind: 'authIsWatch',
                senderAddress: address,
                authAddress: resolution.auth.address,
            }
        }
    }
    return null
}
