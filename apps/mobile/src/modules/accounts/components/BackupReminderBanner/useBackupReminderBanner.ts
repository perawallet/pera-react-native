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
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    type WalletAccount,
    useAccountCapabilityScope,
    useAccountScope,
} from '@perawallet/wallet-core-accounts'

import {
    useCloudBackupStore,
    useShouldPromptMnemonicBackup,
} from '@perawallet/wallet-core-backup'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useIsCloudBackupAvailableFor } from '@hooks/useIsCloudBackupAvailable'
import { useLanguage } from '@hooks/useLanguage'
import { useBackupFlowLauncher } from '@modules/backup'
import { useCloudBackupInitialRoute } from '@modules/cloud-backup'

export type UseBackupReminderBannerResult = {
    isVisible: boolean
    message: string
    passphraseCtaLabel: string
    cloudBackupCtaLabel: Optional<string>
    onBackUpPassphrase: () => void
    onOpenCloudBackup: () => void
}

export const useBackupReminderBanner = (
    account: WalletAccount,
): UseBackupReminderBannerResult => {
    const ownScope = useAccountScope(account, useHomeChainScope().chainId)
    // The chain with mnemonicBackup switched on, which may not be the account's own chain.
    const backupScope = useAccountCapabilityScope(account, 'mnemonicBackup')
    const isVisible = useShouldPromptMnemonicBackup(
        account,
        backupScope ?? ownScope,
    )
    const launch = useBackupFlowLauncher()
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const isCloudBackupAvailable = useIsCloudBackupAvailableFor(account)
    const cloudBackupRoute = useCloudBackupInitialRoute()
    const needsCredentialsConfirmation = useCloudBackupStore(state =>
        state.needsCredentialsConfirmation(),
    )

    const onBackUpPassphrase = useCallback(
        () => launch(account),
        [launch, account],
    )

    const onOpenCloudBackup = useCallback(
        () =>
            navigation.navigate('Settings', {
                screen: 'CloudBackupSettings',
                params: { screen: cloudBackupRoute },
            }),
        [navigation, cloudBackupRoute],
    )

    // Confirming comes first: unconfirmed credentials keep the backup from
    // counting whatever the last sync did; otherwise a configured backup that
    // misses the account has something to fix.
    let cloudBackupCtaLabel: Optional<string>
    if (isCloudBackupAvailable) {
        if (cloudBackupRoute !== 'CloudBackupOverview') {
            cloudBackupCtaLabel = t('backup.banner.cta_turn_on_cloud_backup')
        } else if (needsCredentialsConfirmation) {
            cloudBackupCtaLabel = t('backup.banner.cta_confirm_cloud_backup')
        } else {
            cloudBackupCtaLabel = t('backup.banner.cta_fix_cloud_backup')
        }
    }

    return {
        isVisible,
        message: isCloudBackupAvailable
            ? t('backup.banner.text_with_cloud_backup')
            : t('backup.banner.text'),
        passphraseCtaLabel: isCloudBackupAvailable
            ? t('backup.banner.cta_passphrase')
            : t('backup.banner.cta'),
        cloudBackupCtaLabel,
        onBackUpPassphrase,
        onOpenCloudBackup,
    }
}
