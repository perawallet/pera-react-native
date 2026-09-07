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

import type { PeraTransaction } from '../models'

export type Arc0001MultisigMetadata = {
    version: number
    threshold: number
    addrs: string[]
}

// Wire shape per ARC-0001 § "Payload: WalletTransaction".
export type Arc0001WalletTransaction = {
    txn: string
    signers?: string[]
    authAddr?: string
    msig?: Arc0001MultisigMetadata
    stxn?: string
    message?: string
    groupMessage?: string
}

export type Arc0001SignTxnsOpts = {
    message?: string
}

export type Arc0001SignTxnsRequest = {
    transactions: Arc0001WalletTransaction[]
    opts?: Arc0001SignTxnsOpts
}

export const Arc0001ErrorCode = {
    UserRejected: 4001,
    Unauthorized: 4100,
    Unsupported: 4200,
    TooManyTransactions: 4201,
    Uninitialized: 4202,
    InvalidInput: 4300,
} as const
export type Arc0001ErrorCode =
    (typeof Arc0001ErrorCode)[keyof typeof Arc0001ErrorCode]

// Multisig is intentionally not modeled — encountering it raises 4200.
export type Arc0001SignerKind =
    | { kind: 'do-not-sign' }
    | { kind: 'single'; address: string }

export type Arc0001ResolvedTransaction = {
    index: number
    walletTxn: Arc0001WalletTransaction
    decoded: PeraTransaction
    sender: string
    signer: Arc0001SignerKind
}

export type Arc0001ResolveResult = {
    // Full request decoded, in order — needed downstream to recompute the
    // group hash, which can't be done over a filtered subset.
    allDecoded: PeraTransaction[]
    toSign: Arc0001ResolvedTransaction[]
    signerOverrides: Map<number, string>
}

export type Arc0001ResolveContext = {
    // Addresses the wallet can sign for. Candidates outside this set are
    // silently skipped (result slot becomes null).
    signableAddresses: Set<string>
    // Optional gate. A candidate in `signableAddresses` but not here is
    // SKIPPED like a third-party sender (never signed for), not named in an
    // error — used by WalletConnect to bind a session to its approved accounts
    // without leaking which other accounts the wallet holds.
    authorizedAddresses?: Set<string>
    // Local multisig addresses. When a transaction's sender is in this set
    // the wallet routes through the multisig propose flow regardless of the
    // ARC-0001 `signers` hint — the dApp can't enumerate our local
    // participants, so we sign with the multisig address itself and let
    // the propose transport collect signatures.
    multisigAddresses?: ReadonlySet<string>
    maxTransactions?: number
}
