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
    canSignDirectly,
    canSignViaParticipants,
    isMultisigAccount,
    type SignerResolution,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

type AuthHop =
    | { kind: 'self'; auth: WalletAccount }
    | { kind: 'rekeyed'; auth: WalletAccount }
    | { kind: 'authMissing'; authAddress: string }

/**
 * The one place the auth-addr hop is followed. Kept apart from the
 * signability check because the auth-account forms must not evaluate it:
 * legacy multisig records persisted without `multisigDetails` would throw.
 *
 * Rekey indirection follows exactly ONE hop: if A is rekeyed to B and B to C,
 * B still signs for A (A's auth-addr is literally B), so B's own rekey is
 * never followed. The same rule makes cyclic chains terminate.
 */
const followAuthHop = (
    account: WalletAccount,
    accounts: WalletAccount[],
): AuthHop => {
    if (!account.rekeyAddress) return { kind: 'self', auth: account }
    const auth = accounts.find(a => a.address === account.rekeyAddress)
    return auth
        ? { kind: 'rekeyed', auth }
        : { kind: 'authMissing', authAddress: account.rekeyAddress }
}

export const resolveAlgorandSigner = (
    account: WalletAccount,
    accounts: WalletAccount[],
): SignerResolution => {
    const hop = followAuthHop(account, accounts)
    if (hop.kind === 'authMissing') {
        return { kind: 'authMissing', account, authAddress: hop.authAddress }
    }
    const { auth } = hop
    const isRekeyed = hop.kind === 'rekeyed'
    if (isMultisigAccount(auth)) {
        if (canSignViaParticipants(auth.multisigDetails.addresses, accounts)) {
            return { kind: 'ok', signer: auth }
        }
        return isRekeyed
            ? { kind: 'authNoLocalParticipant', account, auth }
            : { kind: 'noLocalParticipant', account: auth }
    }
    if (canSignDirectly(auth)) return { kind: 'ok', signer: auth }
    return isRekeyed
        ? { kind: 'authIsWatch', account, auth }
        : { kind: 'watch', account }
}

export const getAlgorandAuthAccount = (
    account: WalletAccount,
    accounts: WalletAccount[],
): WalletAccount | null => {
    const hop = followAuthHop(account, accounts)
    return hop.kind === 'authMissing' ? null : hop.auth
}
