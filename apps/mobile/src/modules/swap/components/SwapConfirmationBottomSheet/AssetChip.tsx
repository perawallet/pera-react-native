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

import { PWIcon, PWText, PWView } from '@components/core'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import { useStyles } from './styles'

type AssetChipProps = {
    unitName?: string
    verificationTier: string
}

export const AssetChip = ({ unitName, verificationTier }: AssetChipProps) => {
    const styles = useStyles()
    const icon = getVerificationIcon(verificationTier)

    return (
        <PWView style={styles.assetChip}>
            <PWText
                variant='body'
                style={styles.assetChipText}
            >
                {unitName ?? ''}
            </PWText>
            {icon && (
                <PWIcon
                    name={icon}
                    size='xs'
                />
            )}
        </PWView>
    )
}
