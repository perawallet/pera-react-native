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

import { useCallback } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { PWButton } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useMultisigSignRequestDecline } from '@modules/multisig/hooks/useMultisigSignRequestDecline'

export type MultisigDeclineButtonProps = {
    request: SignRequest
    signerAddress: string
    isDisabled: boolean
    style?: StyleProp<ViewStyle>
}

export const MultisigDeclineButton = ({
    request,
    signerAddress,
    isDisabled,
    style,
}: MultisigDeclineButtonProps) => {
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const { isPending: isDeclining, handleConfirm: handleConfirmDecline } =
        useMultisigSignRequestDecline({
            mode: 'decline',
            request,
            signerAddress,
        })

    const handlePress = useCallback(async () => {
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='warning'
                    iconVariant='error'
                    title={t('multisig.decline.confirm_title')}
                    message={t('multisig.decline.confirm_body')}
                    confirmLabel={t('multisig.decline.confirm_action')}
                    cancelLabel={t('multisig.decline.keep_signing')}
                    confirmVariant='primary'
                    testID='multisig_decline_confirm_sheet'
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (confirmed) await handleConfirmDecline()
    }, [requestBottomSheet, t, handleConfirmDecline])

    return (
        <PWButton
            title={t('multisig.sign_sheet.decline')}
            variant='linkNeutral'
            onPress={() => void handlePress()}
            isDisabled={isDisabled || isDeclining}
            isLoading={isDeclining}
            style={style}
        />
    )
}
