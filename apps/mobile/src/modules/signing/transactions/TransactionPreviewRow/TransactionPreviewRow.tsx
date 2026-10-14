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

import { chainUiFor } from '@modules/chain-ui'
import type { PreviewRowProps } from '../types'

export type TransactionPreviewRowProps = PreviewRowProps

export const TransactionPreviewRow = (props: TransactionPreviewRowProps) => {
    const PreviewRow = chainUiFor(props.transaction.family).transactionDetails
        ?.PreviewRow

    return PreviewRow ? <PreviewRow {...props} /> : null
}
