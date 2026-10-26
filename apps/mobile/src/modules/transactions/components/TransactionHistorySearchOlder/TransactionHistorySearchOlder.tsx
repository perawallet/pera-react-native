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

import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'

export type TransactionHistorySearchOlderProps = {
    onPress: () => void
}

/** Resumes a records search that paused after a run of pages with nothing to show. */
export const TransactionHistorySearchOlder = ({
    onPress,
}: TransactionHistorySearchOlderProps) => {
    const { t } = useLanguage()

    return (
        <PWButton
            title={t('asset_details.transaction_list.search_older')}
            variant='link'
            onPress={onPress}
        />
    )
}
