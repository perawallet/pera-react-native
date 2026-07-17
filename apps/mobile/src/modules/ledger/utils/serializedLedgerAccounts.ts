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

import { bytesToHex, hexToBytes } from '@perawallet/wallet-core-shared'

import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import type { LedgerSelectableAccount } from '@perawallet/wallet-core-accounts'

// React Navigation state must stay JSON-serializable (dev warning today,
// broken state persistence if it is ever enabled) — `LedgerAccount` carries a
// `Uint8Array` public key, so routes carry these hex-encoded twins instead.
// Encode at the `navigate`/`replace` call site, decode in the receiving hook.

export type SerializedLedgerAccount = {
    address: string
    /** Raw 32-byte Ed25519 public key, hex-encoded. */
    publicKeyHex: string
    accountIndex: number
}

export type SerializedLedgerSelectableAccount =
    | { kind: 'derived'; account: SerializedLedgerAccount }
    | {
          kind: 'rekeyed'
          address: string
          authAccount: SerializedLedgerAccount
      }

export const serializeLedgerAccount = (
    account: LedgerAccount,
): SerializedLedgerAccount => ({
    address: account.address,
    publicKeyHex: bytesToHex(account.publicKey),
    accountIndex: account.accountIndex,
})

export const deserializeLedgerAccount = (
    serialized: SerializedLedgerAccount,
): LedgerAccount => ({
    address: serialized.address,
    publicKey: hexToBytes(serialized.publicKeyHex),
    accountIndex: serialized.accountIndex,
})

export const serializeSelectableAccount = (
    selectable: LedgerSelectableAccount,
): SerializedLedgerSelectableAccount =>
    selectable.kind === 'derived'
        ? {
              kind: 'derived',
              account: serializeLedgerAccount(selectable.account),
          }
        : {
              kind: 'rekeyed',
              address: selectable.address,
              authAccount: serializeLedgerAccount(selectable.authAccount),
          }

export const deserializeSelectableAccount = (
    serialized: SerializedLedgerSelectableAccount,
): LedgerSelectableAccount =>
    serialized.kind === 'derived'
        ? {
              kind: 'derived',
              account: deserializeLedgerAccount(serialized.account),
          }
        : {
              kind: 'rekeyed',
              address: serialized.address,
              authAccount: deserializeLedgerAccount(serialized.authAccount),
          }
