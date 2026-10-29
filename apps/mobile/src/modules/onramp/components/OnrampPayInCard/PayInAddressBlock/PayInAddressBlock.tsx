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

import { PWText, PWTouchableIcon, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useStyles } from './styles'
import { useClipboard } from '@hooks/useClipboard'

export type PayInAddressBlockProps = {
    label: string
    value: string
}

export const PayInAddressBlock = ({ label, value }: PayInAddressBlockProps) => {
    const styles = useStyles()
    const { copyToClipboard } = useClipboard()

    return (
        <PWView style={styles.addressBlock}>
            <PWText
                variant='footnoteMedium'
                style={styles.addressLabel}
            >
                {label}
            </PWText>
            <CopyableText
                copyValue={value}
                style={styles.addressRow}
            >
                <PWText
                    variant='body'
                    style={styles.addressValue}
                >
                    {value}
                </PWText>
                <PWTouchableIcon
                    name='copy'
                    size='sm'
                    variant='secondary'
                    onPress={() => void copyToClipboard(value)}
                />
            </CopyableText>
        </PWView>
    )
}
