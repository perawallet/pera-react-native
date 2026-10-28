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

import { useMemo } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import type { SpendApprovalWarningRow } from '../SpendApprovalWarning/useSpendApprovalWarning'

export type UseCollectionApprovalWarningResult = {
    rows: SpendApprovalWarningRow[]
}

export const useCollectionApprovalWarning = (
    operator: string,
): UseCollectionApprovalWarningResult => {
    const { t } = useLanguage()

    return useMemo(
        () => ({
            rows: [
                {
                    type: 'collection',
                    icon: 'warning',
                    message: t('signing.collection_approval.warning'),
                    emphasis: t('signing.spend_approval.spend_warning_bold'),
                    caption: t('signing.collection_approval.operator_caption', {
                        address: operator,
                    }),
                },
            ],
        }),
        [operator, t],
    )
}
