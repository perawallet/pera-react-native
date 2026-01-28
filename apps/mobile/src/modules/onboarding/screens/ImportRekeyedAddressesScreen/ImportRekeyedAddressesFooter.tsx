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
import { PWView, PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type ImportRekeyedAddressesFooterProps = {
    onContinue: () => void
    onSkip: () => void
    canContinue: boolean
}

export const ImportRekeyedAddressesFooter = ({
    onContinue,
    onSkip,
    canContinue,
}: ImportRekeyedAddressesFooterProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.footer}>
            <PWButton
                title={t('onboarding.import_rekeyed_addresses.continue')}
                onPress={onContinue}
                variant={canContinue ? 'primary' : 'secondary'}
                isDisabled={!canContinue}
                style={styles.continueButton}
            />

            <PWButton
                title={t('onboarding.import_rekeyed_addresses.skip')}
                onPress={onSkip}
                variant='secondary'
            />
        </PWView>
    )
}
