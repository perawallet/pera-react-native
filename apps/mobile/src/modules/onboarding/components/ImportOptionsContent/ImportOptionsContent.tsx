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

import React, { useMemo } from 'react'
import {
    offeredLocalKeyKinds,
    type LocalKeySeed,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
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

export type ImportOptionsContentResult = LocalKeySeed

export type ImportOptionsContentProps = Record<string, never>

export const ImportOptionsContent = () => {
    const styles = useStyles()
    const { t } = useTranslation()
    const { resolve } = useBottomSheetResult<ImportOptionsContentResult>()

    // A kind with no recover option is offered only from the passphrase of
    // a kind it shares a word count with.
    const options = useMemo(
        () =>
            offeredLocalKeyKinds(LEGACY_CHAIN_ID).flatMap(
                ({ kind, options: { recover } }) =>
                    recover
                        ? [
                              {
                                  ...recover,
                                  seed: kind.seed,
                                  testID: `import_options_${recover.id}_button`,
                                  chipVariant: recover.isSuggested
                                      ? ('helper' as const)
                                      : undefined,
                              },
                          ]
                        : [],
            ),
        [],
    )

    return (
        <PWSheetLayout
            header={
                <SheetHeader title={t('onboarding.import_options.title')} />
            }
        >
            <PWView style={styles.optionsContainer}>
                {options.map(option => (
                    <PWTouchableOpacity
                        key={option.testID}
                        onPress={() => resolve(option.seed)}
                        style={styles.optionBox}
                        {...getTestProps(option.testID)}
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
                                            {t(option.titleKey)}
                                        </PWText>
                                    </PWView>
                                    <PWView style={styles.optionChipContainer}>
                                        <PWChip
                                            title={t(option.chipKey)}
                                            variant={option.chipVariant}
                                        />
                                    </PWView>
                                </PWView>
                                <PWText
                                    variant='body'
                                    style={styles.optionBody}
                                    numberOfLines={3}
                                    ellipsizeMode='tail'
                                >
                                    {t(option.descriptionKey)}
                                </PWText>
                            </PWView>
                            <PWText
                                variant='link'
                                style={styles.optionLink}
                                numberOfLines={2}
                                ellipsizeMode='tail'
                            >
                                {t(option.mnemonicInfoKey)}
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
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
