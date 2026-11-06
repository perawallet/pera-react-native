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
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useContactAddressName } from './useContactAddressName'
import { useStyles } from './styles'

export type ContactAddressNameProps = {
    address: string
    chainId: ChainId
    testID?: string
}

export const ContactAddressName = ({
    address,
    chainId,
    testID,
}: ContactAddressNameProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { name, labelKey } = useContactAddressName(address, chainId)

    if (!name) return null

    return (
        <PWView
            style={styles.section}
            testID={testID}
        >
            <PWText
                variant='h4'
                style={styles.label}
            >
                {t(labelKey)}
            </PWText>
            <PWText
                variant='body'
                style={styles.name}
            >
                {name}
            </PWText>
        </PWView>
    )
}
