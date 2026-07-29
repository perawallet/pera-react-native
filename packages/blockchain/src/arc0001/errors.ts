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

import { type Arc0001ErrorCode } from './types'

// Carries ARC-0001's numeric code + { index, field }. Transports relay the
// message and data to the dApp; note the WalletConnect v1 bridge collapses any
// code-bearing error to JSON-RPC -32000, so the numeric code is NOT relayed
// there. Never place wallet-private data (e.g. held addresses) in either field
// — it reaches the remote peer verbatim (PERA-4716).
export class Arc0001Error extends Error {
    public readonly code: Arc0001ErrorCode
    public readonly data?: { index?: number; field?: string }

    constructor(
        code: Arc0001ErrorCode,
        message: string,
        data?: { index?: number; field?: string },
    ) {
        super(message)
        this.name = 'Arc0001Error'
        this.code = code
        this.data = data
    }
}
