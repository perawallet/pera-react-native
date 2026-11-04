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

import type {
    ChainScope,
    SpendApproval,
} from '@perawallet/wallet-core-chain-contract'
import { PWText } from '@components/core'
import { useSpendApprovalTitle } from './useSpendApprovalTitle'

type SpendApprovalTitleProps = {
    approval: SpendApproval
    scope: ChainScope
}

export const SpendApprovalTitle = ({
    approval,
    scope,
}: SpendApprovalTitleProps) => {
    const title = useSpendApprovalTitle(approval, scope)

    return (
        <PWText
            variant='h2'
            testID='message-signing-spend-approval-title'
        >
            {title}
        </PWText>
    )
}
