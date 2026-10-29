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

import type { ReactNode } from 'react'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import { PWListItemLayout, PWText, PWView } from '@components/core'
import { ChainFamilyIcon, useChainFamily } from '@modules/chain-ui'
import { useStyles } from './styles'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: chain family icon size
const FAMILY_ICON_SIZE = 40

export type ContactAddressRowProps = {
    family: ChainFamily
    address: string
    right?: ReactNode
    /** Shown under the address, such as a warning. */
    footer?: ReactNode
    testID?: string
}

export const ContactAddressRow = ({
    family,
    address,
    right,
    footer,
    testID,
}: ContactAddressRowProps) => {
    const { label, truncate } = useChainFamily(family)
    const styles = useStyles()

    return (
        <PWListItemLayout
            style={styles.row}
            left={
                <ChainFamilyIcon
                    family={family}
                    size={FAMILY_ICON_SIZE}
                />
            }
            right={right}
            testID={testID}
        >
            <PWView>
                <PWText style={styles.label}>{label}</PWText>
                <PWText
                    variant='caption'
                    style={styles.address}
                >
                    {truncate(address)}
                </PWText>
                {footer}
            </PWView>
        </PWListItemLayout>
    )
}
