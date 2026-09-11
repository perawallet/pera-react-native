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

import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { WalletOperationResult } from '@perawallet/wallet-core-connections'

/**
 * The JSON-RPC `result` an operation answers with. Both protocols put the same
 * value on the wire: ARC-0001's response is the slot-ordered
 * `Nullable<string>[]`, one entry per transaction the request named, and
 * ARC-60's is the signatures base64-encoded.
 */
export const toWireResult = (result: WalletOperationResult): unknown =>
    result.type === 'sign-transactions'
        ? result.signed
        : result.signatures.map(signature => encodeToBase64(signature))
