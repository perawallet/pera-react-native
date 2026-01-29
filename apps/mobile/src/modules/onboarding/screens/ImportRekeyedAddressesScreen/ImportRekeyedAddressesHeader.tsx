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
import { PWView, PWText, PWIcon } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type ImportRekeyedAddressesHeaderProps = {
    accountsCount: number
}

export const ImportRekeyedAddressesHeader = ({
    accountsCount,
}: ImportRekeyedAddressesHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.headerIconContainer}>
                <PWIcon
                    name='wallet'
                    size='lg'
                />
            </PWView>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('onboarding.import_rekeyed_addresses.title', {
                    count: accountsCount,
                })}
            </PWText>
            <PWText
                variant='h4'
                style={styles.description}
            >
                {t('onboarding.import_rekeyed_addresses.description_line_1', {
                    count: accountsCount,
                })}
            </PWText>
            <PWText
                variant='h4'
                style={styles.description}
            >
                {t('onboarding.import_rekeyed_addresses.description_line_2')}
            </PWText>
        </PWView>
    )
}
