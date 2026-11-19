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
import { useStyles } from './styles'
import { useInitialsIcon } from './useInitialsIcon'

export type InitialsIconProps = {
    /** The name the initials come from; also the accessibility label. */
    label: string
    /** px */
    size: number
    testID?: string
}

/** A grey circle with a name's initials, for a chain or network with no art. */
export const InitialsIcon = ({ label, size, testID }: InitialsIconProps) => {
    const styles = useStyles(size)
    const { initials } = useInitialsIcon({ label, size })

    return (
        <PWView
            style={styles.placeholder}
            accessibilityLabel={label}
            testID={testID}
        >
            <PWText
                variant='captionSmall'
                style={styles.initials}
            >
                {initials}
            </PWText>
        </PWView>
    )
}
