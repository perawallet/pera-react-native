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
import { useQueryClient } from '@tanstack/react-query'
import { addressOn, getAllAccounts } from '@perawallet/wallet-core-accounts'
import { findAccountsNeedingMnemonicBackup } from '@perawallet/wallet-core-backup'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { navigateHome, navigateToScreen } from '../navigateToScreen'

export type PassphraseBackupDeeplinkHandler = (
    replaceCurrentScreen: boolean,
) => Promise<void>

/**
 * Opens the passphrase backup of the first account that needs one, resolved
 * at tap time: the widget that sent the link may be showing an older count,
 * and on a cold start the funding reads haven't run yet. With nothing left to
 * back up it lands home.
 */
export const usePassphraseBackupDeeplink =
    (): PassphraseBackupDeeplinkHandler => {
        const scope = useSelectedScope(useCapableChainId('mnemonicBackup'))
        const queryClient = useQueryClient()

        return useCallback(
            async (replaceCurrentScreen: boolean) => {
                const [first] = await findAccountsNeedingMnemonicBackup(
                    queryClient,
                    getAllAccounts(),
                    scope,
                )
                const address = first ? addressOn(first, scope) : undefined
                if (!address) {
                    navigateHome(replaceCurrentScreen)
                    return
                }
                navigateToScreen(replaceCurrentScreen, 'BackupWallet', {
                    screen: 'BackupInfo',
                    params: { address },
                })
            },
            [queryClient, scope],
        )
    }
