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
import type { SeedRef } from '@perawallet/wallet-core-chain-contract'

/** BIP-44 coin type 60, the path MetaMask and Ledger Live derive. */
export const ethereumHdPath = (account: number, keyIndex: number): string =>
    `m/44'/60'/${account}'/0/${keyIndex}`

/**
 * Stored accounts reference this id, so its format never changes, and the
 * accounts adapter's `hdKeyPairId` must return the same. It names the chain
 * because another secp256k1 chain at the same coordinates is a different key.
 */
export const ethereumHdKeyId = (
    seedRef: SeedRef,
    account: number,
    keyIndex: number,
): string => `${seedRef}-eth-acc${account}-idx${keyIndex}`
