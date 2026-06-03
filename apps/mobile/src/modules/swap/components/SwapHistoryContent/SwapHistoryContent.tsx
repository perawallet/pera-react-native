/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { SwapHistoryList } from '@modules/swap/components/SwapHistoryList'
import { useStyles } from './styles'

export type SwapHistoryContentProps = {
    address: string
}

export const SwapHistoryContent = ({ address }: SwapHistoryContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <>
            <SheetHeader title={t('swap.history.title')} />
            <PWView style={styles.listWrapper}>
                <SwapHistoryList
                    address={address}
                    onClose={dismiss}
                    inBottomSheet
                />
            </PWView>
        </>
    )
}
