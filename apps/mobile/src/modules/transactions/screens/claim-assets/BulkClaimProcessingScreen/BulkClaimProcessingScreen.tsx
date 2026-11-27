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

import {
    type IconName,
    PWButton,
    PWIcon,
    type PWIconVariant,
    PWLoadingIndicator,
    PWLottie,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import peraTransactionLoading from '@assets/animations/pera-transaction-loading.json'
import type { AssetInboxBatchItemStatus } from '@perawallet/wallet-core-transactions'
import { useStyles } from './styles'
import { useBulkClaimProcessingScreen } from './useBulkClaimProcessingScreen'

const STATUS_ICONS: Record<
    Exclude<AssetInboxBatchItemStatus, 'sending'>,
    { name: IconName; variant: PWIconVariant }
> = {
    waiting: { name: 'minus', variant: 'secondary' },
    done: { name: 'check', variant: 'positive' },
    failed: { name: 'error-circle', variant: 'error' },
    cancelled: { name: 'cross', variant: 'secondary' },
}

export const BulkClaimProcessingScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { items, title, subtitle, hasFailed, statusLabel, handleDone } =
        useBulkClaimProcessingScreen()

    return (
        <PWScreen
            footer={
                hasFailed ? (
                    <PWButton
                        variant='primary'
                        title={t('common.done')}
                        onPress={handleDone}
                        style={styles.doneButton}
                        testID='asset_inbox_bulk_done'
                    />
                ) : undefined
            }
        >
            <PWView style={styles.header}>
                <PWView style={styles.spinnerCircle}>
                    {hasFailed ? (
                        <PWIcon
                            name='error-circle'
                            size='lg'
                            variant='error'
                        />
                    ) : (
                        <PWLottie
                            autoPlay
                            loop
                            source={peraTransactionLoading}
                            style={styles.animation}
                        />
                    )}
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {title}
                </PWText>
                <PWText style={styles.subtitle}>{subtitle}</PWText>
            </PWView>
            {items.map((item, position) => (
                <PWView
                    key={item.key}
                    style={styles.row}
                    testID={`asset_inbox_bulk_item_${position}`}
                >
                    <PWView style={styles.statusIcon}>
                        {item.status === 'sending' ? (
                            <PWLoadingIndicator size='xs' />
                        ) : (
                            <PWIcon
                                name={STATUS_ICONS[item.status].name}
                                size='sm'
                                variant={STATUS_ICONS[item.status].variant}
                            />
                        )}
                    </PWView>
                    <PWText
                        style={styles.name}
                        numberOfLines={1}
                    >
                        {item.name}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.status}
                    >
                        {statusLabel(item.status)}
                    </PWText>
                </PWView>
            ))}
        </PWScreen>
    )
}
