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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { TransactionWarning } from '@perawallet/wallet-core-signing'
import { useWarningItem } from './useWarningItem'
import { WarningRow } from './WarningRow'

type WarningItemProps = {
    warning: TransactionWarning
    showDivider: boolean
    isGroup: boolean
    scope: ChainScope
}

export const WarningItem = ({
    warning,
    showDivider,
    isGroup,
    scope,
}: WarningItemProps) => {
    const { icon, message, emphasis, caption } = useWarningItem({
        warning,
        isGroup,
        scope,
    })

    return (
        <WarningRow
            icon={icon}
            message={message}
            emphasis={emphasis}
            caption={caption}
            showDivider={showDivider}
        />
    )
}
