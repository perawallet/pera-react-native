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
import {
    type WalletAccount,
    useAccountCapabilityScope,
    useAccountScope,
} from '@perawallet/wallet-core-accounts'

import { useShouldPromptMnemonicBackup } from '@perawallet/wallet-core-backup'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useBackupFlowLauncher } from '@modules/backup'

export type UseBackupReminderBannerResult = {
    isVisible: boolean
    onPress: () => void
}

export const useBackupReminderBanner = (
    account: WalletAccount,
): UseBackupReminderBannerResult => {
    const ownScope = useAccountScope(account, useHomeChainScope().chainId)
    // The phrase is backed up on the chain that mints it, not on the account's own chain.
    const backupScope = useAccountCapabilityScope(account, 'mnemonicBackup')
    const isVisible = useShouldPromptMnemonicBackup(
        account,
        backupScope ?? ownScope,
    )
    const launch = useBackupFlowLauncher()

    const onPress = useCallback(() => launch(account), [launch, account])

    return { isVisible, onPress }
}
