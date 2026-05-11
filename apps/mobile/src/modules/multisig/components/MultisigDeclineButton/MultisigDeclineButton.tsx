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

import { type StyleProp, type ViewStyle } from 'react-native'
import { type SignRequest } from '@perawallet/wallet-core-signing'
import { PWButton } from '@components/core'
import { ConfirmActionBottomSheet } from '@components/ConfirmActionBottomSheet'
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
    const {
        isPending: isDeclining,
        isConfirmOpen,
        openConfirm,
        closeConfirm,
        handleConfirm: handleConfirmDecline,
    } = useMultisigSignRequestDecline({
        mode: 'decline',
        request,
        signerAddress,
    })

    return (
        <>
            <PWButton
                title={t('multisig.sign_sheet.decline')}
                variant='secondary'
                onPress={openConfirm}
                isDisabled={isDisabled || isDeclining}
                isLoading={isDeclining}
                style={style}
            />
            <ConfirmActionBottomSheet
                isVisible={isConfirmOpen}
                onClose={closeConfirm}
                onConfirm={handleConfirmDecline}
                icon='warning'
                iconVariant='error'
                title={t('multisig.decline.confirm_title')}
                message={t('multisig.decline.confirm_body')}
                confirmLabel={t('multisig.decline.confirm_action')}
                cancelLabel={t('multisig.decline.keep_signing')}
                confirmVariant='primary'
                testID='multisig_decline_confirm_sheet'
            />
        </>
    )
}
