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

import React from 'react'
import {
    PWChip,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { getTestProps } from '@utils/test-id-helper'
import { useTranslation } from 'react-i18next'
import { useStyles } from './styles'

export type ImportOptionsContentResult = 'hdWallet' | 'algo25'

export type ImportOptionsContentProps = Record<string, never>

export const ImportOptionsContent = () => {
    const styles = useStyles()
    const { t } = useTranslation()
    const { resolve } = useBottomSheetResult<ImportOptionsContentResult>()

    return (
        <PWSheetLayout
            header={
                <SheetHeader title={t('onboarding.import_options.title')} />
            }
            body={
                <PWView style={styles.optionsContainer}>
                    <PWTouchableOpacity
                        onPress={() => resolve('hdWallet')}
                        style={styles.optionBox}
                        {...getTestProps('import_options_hd_wallet_button')}
                    >
                        <PWView style={styles.optionContent}>
                            <PWView style={styles.optionTopContent}>
                                <PWView style={styles.optionHeader}>
                                    <PWView style={styles.optionTitleContainer}>
                                        <PWText
                                            variant='h4'
                                            numberOfLines={2}
                                            ellipsizeMode='tail'
                                        >
                                            {t(
                                                'onboarding.import_options.hd_wallet.title',
                                            )}
                                        </PWText>
                                    </PWView>
                                    <PWView style={styles.optionChipContainer}>
                                        <PWChip
                                            title={t(
                                                'onboarding.import_options.hd_wallet.chip',
                                            )}
                                            variant='helper'
                                        />
                                    </PWView>
                                </PWView>
                                <PWText
                                    variant='body'
                                    style={styles.optionBody}
                                    numberOfLines={3}
                                    ellipsizeMode='tail'
                                >
                                    {t(
                                        'onboarding.import_options.hd_wallet.description',
                                    )}
                                </PWText>
                            </PWView>
                            <PWText
                                variant='link'
                                style={styles.optionLink}
                                numberOfLines={2}
                                ellipsizeMode='tail'
                            >
                                {t('onboarding.import_options.mnemonic_info')}
                            </PWText>
                        </PWView>

                        <PWView style={styles.rightIconContainer}>
                            <PWIcon
                                name='chevron-right'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                    </PWTouchableOpacity>

                    <PWTouchableOpacity
                        onPress={() => resolve('algo25')}
                        style={styles.optionBox}
                        {...getTestProps('import_options_algo25_button')}
                    >
                        <PWView style={styles.optionContent}>
                            <PWView style={styles.optionTopContent}>
                                <PWView style={styles.optionHeader}>
                                    <PWView style={styles.optionTitleContainer}>
                                        <PWText
                                            variant='h4'
                                            numberOfLines={2}
                                            ellipsizeMode='tail'
                                        >
                                            {t(
                                                'onboarding.import_options.algo25.title',
                                            )}
                                        </PWText>
                                    </PWView>
                                    <PWView style={styles.optionChipContainer}>
                                        <PWChip
                                            title={t(
                                                'onboarding.import_options.algo25.chip',
                                            )}
                                        />
                                    </PWView>
                                </PWView>
                                <PWText
                                    variant='body'
                                    style={styles.optionBody}
                                    numberOfLines={3}
                                    ellipsizeMode='tail'
                                >
                                    {t(
                                        'onboarding.import_options.algo25.description',
                                    )}
                                </PWText>
                            </PWView>
                            <PWText
                                variant='link'
                                style={styles.optionLink}
                                numberOfLines={2}
                                ellipsizeMode='tail'
                            >
                                {t(
                                    'onboarding.import_options.algo25.mnemonic_info',
                                )}
                            </PWText>
                        </PWView>

                        <PWView style={styles.rightIconContainer}>
                            <PWIcon
                                name='chevron-right'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                    </PWTouchableOpacity>
                </PWView>
            }
        />
    )
}
