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
import { useLanguage } from '@hooks/useLanguage'
import { ProjectVerificationIcon } from '@modules/projects'
import { type FlaggedRequestAddress } from '@modules/signing/hooks/useRequestAddressSafety'
import { useStyles } from '../styles'
import { ROLE_LABEL_KEYS } from '../roleLabelKeys'

export type ListedAddressProps = {
    flagged: FlaggedRequestAddress
    index: number
}

export const ListedAddress = ({ flagged, index }: ListedAddressProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.address}>
            <PWView style={styles.addressHeader}>
                <ProjectVerificationIcon
                    tier='suspicious'
                    size='sm'
                    testID={`request_address_listed_badge_${index}`}
                />
                <PWText
                    variant='caption'
                    style={styles.label}
                >
                    {t(ROLE_LABEL_KEYS[flagged.role])}
                </PWText>
            </PWView>
            <PWText
                style={styles.fullAddress}
                testID={`request_address_listed_${index}`}
            >
                {flagged.address}
            </PWText>
        </PWView>
    )
}
