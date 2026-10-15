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

import type { ComponentType } from 'react'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'

export type ReviewBodyProps = {
    transaction: TransactionNative
    source?: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

export type DetailBodyProps = {
    transaction: TransactionNative
    /** A transaction reachable from this one's body, such as an inner transaction. */
    onRelatedTransactionPress?: (transaction: TransactionNative) => void
}

export type PreviewRowProps = {
    transaction: TransactionNative
    /** Shown in the request for the group's sake; another party signs it. */
    isExternal?: boolean
    onPress?: () => void
}

export type TransactionDisplay = {
    ReviewBody: ComponentType<ReviewBodyProps>
    DetailBody: ComponentType<DetailBodyProps>
    PreviewRow: ComponentType<PreviewRowProps>
}
