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

import { SafeAreaView } from 'react-native-safe-area-context'
import {
    PWButton,
    PWInput,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useOnrampSenderAddressContent } from './useOnrampSenderAddressContent'

export type OnrampSenderAddressContentProps = {
    initialAddress?: string
    /** The pay asset; the address is checked against its chain. */
    sourceToken: RampToken
}

// Rendered inline (no PWSheetLayout) so it sizes correctly in an `auto` sheet:
// the header + body + button provide the intrinsic height, and the Apply
// button lives in the body rather than a fixed footer.
export const OnrampSenderAddressContent = ({
    initialAddress = '',
    sourceToken,
}: OnrampSenderAddressContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        address,
        setAddress,
        clearAddress,
        networkLabel,
        isValid,
        hasError,
        handleConfirm,
    } = useOnrampSenderAddressContent({ initialAddress, sourceToken })

    return (
        <SafeAreaView edges={['bottom']}>
            <SheetHeader
                title={t('onramp.sender_address.title')}
                showClose
            />
            <PWView style={styles.body}>
                <PWText>{t('onramp.sender_address.body')}</PWText>
                <PWInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder={t('onramp.form.enter_sender_address', {
                        name: networkLabel,
                    })}
                    autoCapitalize='none'
                    autoCorrect={false}
                    renderErrorMessage={false}
                    inputContainerStyle={styles.inputContainer}
                    rightIcon={
                        address.length > 0 ? (
                            <PWTouchableIcon
                                name='cross'
                                variant='secondary'
                                size='md'
                                onPress={clearAddress}
                                testID='onramp-sender-address-clear'
                            />
                        ) : undefined
                    }
                    testID='onramp-sender-address-input'
                />
                {hasError && (
                    <PWText
                        variant='footnoteMedium'
                        style={styles.errorText}
                        testID='onramp-sender-address-error'
                    >
                        {t('onramp.sender_address.invalid', {
                            network: networkLabel,
                        })}
                    </PWText>
                )}
                <PWButton
                    variant='primary'
                    title={t('onramp.sender_address.confirm')}
                    onPress={handleConfirm}
                    isDisabled={!isValid}
                    testID='onramp-sender-address-confirm'
                />
            </PWView>
        </SafeAreaView>
    )
}
