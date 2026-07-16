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
    isMultisigUnsignable,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isTransactionRequest, type SignRequest } from '../models'

/**
 * True iff `request` is a transaction sign request in which ANY transaction's
 * signer is a multisig account the wallet holds no signable participant of —
 * so the signing UI can block it up-front with a clear message instead of
 * letting the pipeline fail late with a generic toast. Every transaction's
 * resolved signer (including per-index `signerOverrides`) is inspected, so a
 * mixed group whose unsignable sender sits in a later slot cannot slip past.
 *
 * Such a request can arrive via e.g. a transaction deeplink, or a WalletConnect
 * session connected while the account was still signable. `multisig-cosign`
 * requests pin a signable participant and are excluded.
 */
export const isSignRequestMultisigUnsignable = (
    request: SignRequest,
    accounts: WalletAccount[],
): boolean => {
    if (request.sourceType === 'multisig-cosign') return false
    if (!isTransactionRequest(request)) return false

    const signerAddresses = new Set<string>()
    request.txs.forEach((tx, index) => {
        const address =
            request.signerOverrides?.get(index) ?? tx.sender?.toString?.()
        if (address) signerAddresses.add(address)
    })

    for (const signerAddress of signerAddresses) {
        const signerAccount = accounts.find(
            account => account.address === signerAddress,
        )
        if (!signerAccount) continue
        if (isMultisigUnsignable(signerAccount, accounts)) return true
    }
    return false
}
