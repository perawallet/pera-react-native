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

import { PWSheetLayout } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { WarningItem } from './WarningItem'

export type SigningWarningsContentProps = {
    isGroup?: boolean
}

export const SigningWarningsContent = ({
    isGroup = false,
}: SigningWarningsContentProps) => {
    const { t } = useLanguage()
    const { distinctWarnings, warnings } = useSigningPipeline()
    const warningCount = warnings.length

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('transactions.warning.title', {
                        count: warningCount,
                    })}
                />
            }
        >
            {distinctWarnings.map((warning, index) => (
                <WarningItem
                    key={
                        warning.type === 'high-fee'
                            ? 'high-fee'
                            : `${warning.type}-${warning.senderAddress}-${warning.targetAddress}`
                    }
                    warning={warning}
                    showDivider={index > 0}
                    isGroup={isGroup}
                />
            ))}
        </PWSheetLayout>
    )
}
