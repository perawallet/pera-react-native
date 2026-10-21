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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWSheetLayout, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { ChainRow } from '@modules/chain-ui'
import { useStyles } from './styles'

export type ContactSendNetworkContentProps = {
    /** The networks of the address's family the user can send on. */
    chainIds: readonly ChainId[]
}

/** Resolves the picked network's id. */
export const ContactSendNetworkContent = ({
    chainIds,
}: ContactSendNetworkContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<ChainId>()

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('contacts.view_contact.send_network_title')}
                />
            }
        >
            <PWView style={styles.list}>
                {chainIds.map(chainId => (
                    <ChainRow
                        key={chainId}
                        chainId={chainId}
                        right={
                            <PWIcon
                                variant='secondary'
                                name='chevron-right'
                            />
                        }
                        onPress={() => resolve(chainId)}
                        testID={`contact_send_network_${chainId}`}
                    />
                ))}
            </PWView>
        </PWSheetLayout>
    )
}
