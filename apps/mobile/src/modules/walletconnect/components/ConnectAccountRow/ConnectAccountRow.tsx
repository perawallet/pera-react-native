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

import { useTheme } from '@rneui/themed'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    getIconPixelSize,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui/icon'
import { useStyles } from './styles'

export type ConnectAccountRowProps = {
    /** `null` until the user picks one. */
    account: Nullable<WalletAccount>
    /** The chain whose address and badge the row shows. */
    chainId: ChainId
    onPress: () => void
    isDisabled?: boolean
    labelKey: 'connect' | 'change'
    testID?: string
}

const LABEL_KEYS = {
    connect: 'walletconnect.request.connect_account',
    change: 'walletconnect.settings.change_account',
} as const

export const ConnectAccountRow = ({
    account,
    chainId,
    onPress,
    isDisabled = false,
    labelKey,
    testID,
}: ConnectAccountRowProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWText
                variant='h4'
                style={styles.label}
            >
                {t(LABEL_KEYS[labelKey])}
            </PWText>
            <PWTouchableOpacity
                style={[styles.field, isDisabled && styles.disabled]}
                onPress={onPress}
                disabled={isDisabled}
                testID={testID}
            >
                {account ? (
                    <AccountDisplay
                        account={account}
                        chainId={chainId}
                        avatarBadge={
                            <ChainIcon
                                chainId={chainId}
                                size={getIconPixelSize(theme, 'sm')}
                            />
                        }
                        showChevron
                    />
                ) : (
                    <>
                        <PWText style={styles.placeholder}>
                            {t('walletconnect.request.choose_account')}
                        </PWText>
                        <PWIcon
                            variant='secondary'
                            name='chevron-down'
                        />
                    </>
                )}
            </PWTouchableOpacity>
        </PWView>
    )
}
