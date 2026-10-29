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

import { PWText, PWView } from '@components/core'
import { ChainBadge } from '@components/ChainBadge'
import { useLanguage } from '@hooks/useLanguage'
import type { PassphraseLinkedAddress } from '../../hooks'
import { useStyles } from './styles'

export type PassphraseReachListProps = {
    linkedAddresses: PassphraseLinkedAddress[]
    testID?: string
}

export const PassphraseReachList = ({
    linkedAddresses,
    testID = 'view_passphrase_bottom_sheet_reach',
}: PassphraseReachListProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWText variant='h4'>
                {t('view_passphrase.screen.reach_title')}
            </PWText>
            {linkedAddresses.map(({ chainId, displayName, address }) => (
                <PWView
                    key={chainId}
                    style={styles.row}
                    testID={`${testID}_${chainId}`}
                >
                    <ChainBadge name={displayName} />
                    <PWText
                        variant='mono'
                        style={styles.address}
                        testID={`${testID}_${chainId}_address`}
                    >
                        {address}
                    </PWText>
                </PWView>
            ))}
        </PWView>
    )
}
