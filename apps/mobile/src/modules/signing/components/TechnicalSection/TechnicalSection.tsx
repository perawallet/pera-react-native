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

import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

export type TechnicalSectionProps = {
    title: string
    /** One block per child, divided from the next. */
    children: ReactNode
    testID?: string
}

/** A titled card of technical facts, for the details a reviewer only checks when they want to. */
export const TechnicalSection = ({
    title,
    children,
    testID,
}: TechnicalSectionProps) => {
    const styles = useStyles()
    const blocks = Children.toArray(children).filter(isValidElement)

    if (blocks.length === 0) return null

    return (
        <PWView
            style={styles.section}
            testID={testID}
        >
            <PWText
                variant='bodySemibold'
                style={styles.title}
            >
                {title}
            </PWText>
            <PWView style={styles.card}>
                {blocks.map((block, index) => (
                    <Fragment key={block.key ?? index}>
                        {index > 0 && <PWView style={styles.divider} />}
                        {block}
                    </Fragment>
                ))}
            </PWView>
        </PWView>
    )
}
