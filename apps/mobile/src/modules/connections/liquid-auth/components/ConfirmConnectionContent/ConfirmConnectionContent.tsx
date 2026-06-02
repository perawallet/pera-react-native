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

import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { DisplayIdentity } from '@perawallet/wallet-core-liquid-auth'
import { PWButton, PWFlatList, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { DappConnectionHeader } from '@modules/connections/components/DappConnectionHeader'
import { useLanguage } from '@hooks/useLanguage'
import { LIQUID_AUTH_PERMISSIONS } from '../../constants'
import { faviconUrlForOrigin } from '../../faviconUrl'
import { useStyles } from './styles'

export type ConfirmConnectionContentProps = {
    identity: DisplayIdentity
    address: string
    onConfirm: () => void
    onReject: () => void
}

/**
 * Post-negotiation confirmation: shows the dApp's real (self-asserted or
 * server-attested) identity via the shared header and the single bound account
 * read-only in a "Selected Account" row — no account picker (the account was
 * chosen in the select step).
 */
export const ConfirmConnectionContent = ({
    identity,
    address,
    onConfirm,
    onReject,
}: ConfirmConnectionContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { network } = useNetwork()
    const account = useFindAccountByAddress(address)

    const ListHeader = (
        <>
            <DappConnectionHeader
                networks={[network === 'testnet' ? 'testnet' : 'mainnet']}
                iconUri={faviconUrlForOrigin(identity.origin)}
                fallbackIconName='globe'
                title={identity.name}
                subtitle={
                    identity.verified
                        ? identity.origin
                        : t('liquidauth.confirm.claimed_origin', {
                              origin: identity.origin,
                          })
                }
                permissions={LIQUID_AUTH_PERMISSIONS}
            />
            <PWView style={styles.selectedAccountRow}>
                <PWText
                    variant='h4'
                    style={styles.selectedAccountLabel}
                >
                    {t('liquidauth.confirm.selected_account')}
                </PWText>
                <AccountDisplay
                    account={account ?? undefined}
                    showChevron={false}
                    style={styles.account}
                />
            </PWView>
        </>
    )

    return (
        <>
            <PWFlatList
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                data={[]}
                renderItem={() => null}
                ListHeaderComponent={ListHeader}
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    variant='secondary'
                    title={t('common.cancel.label')}
                    onPress={onReject}
                    style={styles.cancelButton}
                />
                <PWButton
                    variant='primary'
                    title={t('common.connect.label')}
                    onPress={onConfirm}
                    style={styles.connectButton}
                />
            </PWView>
        </>
    )
}
