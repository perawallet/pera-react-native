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

import React from 'react'
import { useTranslation } from 'react-i18next'
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'
import { PWSheetLayout, PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { SheetOptionCard } from '../SheetOptionCard'
import {
    useLedgerTransportOptionsContent,
    type UseLedgerTransportOptionsContentParams,
} from './useLedgerTransportOptionsContent'
import { useStyles } from './styles'

export type LedgerTransportOptionsContentResult = LedgerTransportType

export type LedgerTransportOptionsContentProps =
    UseLedgerTransportOptionsContentParams

export const LedgerTransportOptionsContent = (
    props: LedgerTransportOptionsContentProps,
) => {
    const styles = useStyles()
    const { t } = useTranslation()
    const { resolve } =
        useBottomSheetResult<LedgerTransportOptionsContentResult>()
    const { options } = useLedgerTransportOptionsContent(props)

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('onboarding.ledger_transport_options.title')}
                    showClose
                />
            }
        >
            <PWView style={styles.optionsContainer}>
                {options.map(option => (
                    <SheetOptionCard
                        key={option.testID}
                        testID={option.testID}
                        title={t(option.titleKey)}
                        description={t(option.descriptionKey)}
                        isDisabled={option.isDisabled}
                        onPress={() => resolve(option.transport)}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
