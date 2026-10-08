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
    accountType,
    credentialScheme,
    type AccountCustody,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { CannotSignError } from '../../pipeline/errors'

/** Picks the signing actor; a watch account has none. */
export type SignerCustody = Exclude<AccountCustody['kind'], 'watch'>

/**
 * Custody picks the actor and scheme the primitive inside it, so a new scheme
 * on an existing custody adds no machine state.
 */
export type SignerCredential = {
    custody: SignerCustody
    scheme: SigningScheme
}

/** @throws CannotSignError when `account` has no signer on `chainId`. */
export const resolveSignerCredential = (
    account: WalletAccount,
    chainId: ChainId,
): SignerCredential => {
    const custody = account.custody.kind
    const scheme = credentialScheme(
        account,
        getProvider().chains.get(chainId).descriptor,
    )
    if (custody === 'watch' || scheme === null) {
        throw new CannotSignError(
            account.address,
            `No signing capability found for account type: ${accountType(account)}`,
        )
    }
    return { custody, scheme }
}
