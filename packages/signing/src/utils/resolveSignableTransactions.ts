/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Per-transaction signer specification (ARC-0001).
 *
 * - `signers: []`        → do not sign (dApp-signed)
 * - `signers: [addr]`    → sign only if addr is a signable account
 * - `signers` absent     → sign only if tx sender is a signable account
 */
type SignerSpec = { signers?: string[] }

type ResolveSignableResult = {
    indicesToSign: number[]
    signerOverrides: Map<number, string>
}

/**
 * Determines which transactions the wallet should sign and builds a
 * signer-override map for cases where the explicit signer in the
 * request differs from the transaction sender.
 *
 * @param txParams        Per-transaction signer specs from the request
 * @param txSenders       Sender address of each decoded transaction (same order as txParams)
 * @param signableAddresses  Addresses the wallet can actually sign for
 * @param multisigAddresses  Locally-held multisig (joint-account) addresses.
 *   When a transaction's sender is in this set, the wallet ignores the
 *   ARC-0001 `signers` field for that index — the dApp can't enumerate
 *   our local participant set, so its hint is incomplete by definition.
 *   `signerAddress` stays as the multisig sender, the multisig strategy
 *   auto-signs with every local participant, and the transport selector
 *   routes the result to `createMultisigProposeTransport`. Mirrors
 *   pera-android's `JointAccountTransactionSignHelper.autoSignWithLocalAccounts`.
 *   Defaults to an empty set so non-WC callers stay unchanged.
 */
export const resolveSignableTransactions = (
    txParams: SignerSpec[],
    txSenders: string[],
    signableAddresses: Set<string>,
    multisigAddresses: ReadonlySet<string> = new Set(),
): ResolveSignableResult => {
    const indicesToSign: number[] = []
    const signerOverrides = new Map<number, string>()

    for (let i = 0; i < txParams.length; i++) {
        const param = txParams[i]
        const txSender = txSenders[i]

        // Explicit dApp-signed (`signers: []`) wins for every account
        // type — it's the only way to say "skip this txn".
        if (param.signers && param.signers.length === 0) {
            continue
        }

        // Multisig sender: route via the multisig flow regardless of
        // ARC-0001 `signers`. Even when the dApp specifies a single
        // participant (e.g. `signers: [P1]`), the wallet signs with every
        // local participant of this multisig — the resulting signatures
        // are posted to the backend via the propose transport, and the
        // dApp peer is resolved via `softReject`. Keeping the sender as
        // the multisig address ensures the transport selector at
        // `getTransport.ts` picks the propose branch.
        if (multisigAddresses.has(txSender)) {
            indicesToSign.push(i)
            continue
        }

        if (param.signers && param.signers.length > 0) {
            const match = param.signers.find(s => signableAddresses.has(s))
            if (match) {
                const txsIndex = indicesToSign.length
                indicesToSign.push(i)
                if (match !== txSender) {
                    signerOverrides.set(txsIndex, match)
                }
            }
            continue
        }

        // signers absent → sign only if sender is a signable account
        if (signableAddresses.has(txSender)) {
            indicesToSign.push(i)
        }
    }

    return { indicesToSign, signerOverrides }
}
