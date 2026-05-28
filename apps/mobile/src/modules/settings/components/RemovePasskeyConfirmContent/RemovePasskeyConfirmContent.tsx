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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import {
    useRemovePasskeyMutation,
    type Passkey,
} from '@perawallet/wallet-core-passkeys'
import { useStyles } from './styles'

export type RemovePasskeyConfirmContentProps = {
    passkey: Passkey
}

export const RemovePasskeyConfirmContent = ({
    passkey,
}: RemovePasskeyConfirmContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<'removed'>()
    const { removePasskey, isPending } = useRemovePasskeyMutation()

    const handleRemove = async () => {
        try {
            await removePasskey(passkey)
            resolve('removed')
        } catch {
            // Mutation already surfaces errors via the hook's `error` field;
            // keep the sheet open so the user can retry.
        }
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.iconWrap}>
                <PWIcon
                    name='trash'
                    variant='error'
                    size='xl'
                />
            </PWView>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('settings.passkeys.remove_title')}
            </PWText>
            <PWText style={styles.body}>
                {t('settings.passkeys.remove_body')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='destructive'
                    onPress={handleRemove}
                    isDisabled={isPending}
                    isLoading={isPending}
                    title={t('settings.passkeys.remove_confirm')}
                />
                <PWButton
                    variant='secondary'
                    onPress={dismiss}
                    isDisabled={isPending}
                    title={t('settings.passkeys.remove_cancel')}
                />
            </PWView>
        </PWView>
    )
}
