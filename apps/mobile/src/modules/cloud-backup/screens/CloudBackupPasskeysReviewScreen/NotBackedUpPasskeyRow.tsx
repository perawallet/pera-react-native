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

import { memo, useCallback } from 'react'
import type { BackupPasskey } from '@perawallet/wallet-core-backup'
import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { BackupPasskeyRow } from '../../components/BackupPasskeyRow'
import { passkeyLabel } from '../../components/passkeyLabel'

type NotBackedUpPasskeyRowProps = {
    passkey: BackupPasskey
    isBusy: boolean
    onBackUp: (credentialId: string) => void
}

const NotBackedUpPasskeyRowComponent = ({
    passkey,
    isBusy,
    onBackUp,
}: NotBackedUpPasskeyRowProps) => {
    const { t } = useLanguage()

    const handleBackUp = useCallback(
        () => onBackUp(passkey.credentialId),
        [onBackUp, passkey.credentialId],
    )

    return (
        <BackupPasskeyRow
            label={passkeyLabel(passkey)}
            origin={passkey.origin}
            isBackedUp={false}
            trailing={
                <PWButton
                    variant='primary'
                    paddingStyle='dense'
                    title={t('cloud_backup.passkeys.back_up_action')}
                    isLoading={isBusy}
                    onPress={handleBackUp}
                    testID='backup_review_passkey_back_up_button'
                />
            }
            testID={`backup_review_not_backed_up_passkey_${passkey.credentialId}`}
        />
    )
}

export const NotBackedUpPasskeyRow = memo(NotBackedUpPasskeyRowComponent)
