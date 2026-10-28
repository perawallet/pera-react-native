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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountSummaryLine } from './useAccountSummaryLine'
import { useSummaryStyles } from './styles'

type AccountSummaryLineProps = {
    account: WalletAccount
    /** The account's backup item key. */
    address: string
}

export const AccountSummaryLine = ({
    account,
    address,
}: AccountSummaryLineProps) => {
    const { t } = useLanguage()
    const styles = useSummaryStyles()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { holdingsCount, value } = useAccountSummaryLine(
        account,
        address,
        scope,
    )

    return (
        <PWView style={styles.line}>
            <PWText
                variant='body'
                style={styles.text}
            >
                {t('cloud_backup.accounts.asset_count', {
                    count: holdingsCount,
                })}
            </PWText>
            {value.kind !== 'none' && (
                <PWText
                    variant='body'
                    style={styles.text}
                >
                    {'・'}
                </PWText>
            )}
            {value.kind === 'native' && (
                <AssetAmount
                    asset={value.asset}
                    value={value.value}
                    density='compact'
                    variant='body'
                    weight={400}
                    style={styles.text}
                />
            )}
            {value.kind === 'fiat' && (
                <PreferredAmount
                    value={value.value}
                    density='compact'
                    variant='body'
                    weight={400}
                    style={styles.text}
                />
            )}
        </PWView>
    )
}
