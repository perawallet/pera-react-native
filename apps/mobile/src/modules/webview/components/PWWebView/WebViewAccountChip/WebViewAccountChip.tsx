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

import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { chainAccountOf } from '@perawallet/wallet-core-accounts'
import { PWText, PWTouchableOpacity } from '@components/core'
import { AccountIcon } from '@components/AccountIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useWebViewAccountChip } from './useWebViewAccountChip'

export type WebViewAccountChipProps = {
    url: string
}

export const WebViewAccountChip = ({ url }: WebViewAccountChipProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { account, chainId, isVisible, isChanging, handlePress } =
        useWebViewAccountChip(url)

    if (!isVisible || chainId === undefined) return null

    const address = account ? chainAccountOf(account, chainId)?.address : null
    const label =
        address && addressCodecs.has(chainId)
            ? addressCodecs.get(chainId).truncate(address)
            : t('walletconnect.request.choose_account')

    return (
        <PWTouchableOpacity
            style={styles.chip}
            onPress={() => void handlePress()}
            disabled={isChanging}
            accessibilityLabel={t('common.webview.connected_account_a11y')}
            testID='webview_account_chip'
        >
            {account && (
                <AccountIcon
                    account={account}
                    size='sm'
                />
            )}
            <PWText
                variant='caption'
                style={styles.address}
                numberOfLines={1}
            >
                {label}
            </PWText>
        </PWTouchableOpacity>
    )
}
