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

import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from '../styles'

export type ExpandAllSignal = { expand: boolean; generation: number }

export const ExpandAllContext = createContext<ExpandAllSignal | null>(null)

export const useExpandableState = (initial: boolean) => {
    const ctx = useContext(ExpandAllContext)
    const [expanded, setExpanded] = useState(initial)
    const lastGen = useRef<number | null>(null)
    useEffect(() => {
        if (ctx && ctx.generation !== lastGen.current) {
            lastGen.current = ctx.generation
            setExpanded(ctx.expand)
        }
    }, [ctx])
    return [expanded, setExpanded] as const
}

type MigrationDataSectionProps = {
    title: string
    count?: number
    initiallyExpanded?: boolean
    children: ReactNode
}

export const MigrationDataSection = ({
    title,
    count,
    initiallyExpanded = false,
    children,
}: MigrationDataSectionProps) => {
    const styles = useStyles()
    const [expanded, setExpanded] = useExpandableState(initiallyExpanded)

    return (
        <PWView>
            <PWTouchableOpacity onPress={() => setExpanded(prev => !prev)}>
                <PWView style={styles.sectionHeader}>
                    <PWView style={styles.sectionHeaderLeft}>
                        <PWText
                            variant='h4'
                            style={styles.sectionTitle}
                        >
                            {title}
                        </PWText>
                        {count !== undefined && (
                            <PWView style={styles.countChip}>
                                <PWText
                                    variant='caption'
                                    style={styles.countChipText}
                                >
                                    {count}
                                </PWText>
                            </PWView>
                        )}
                    </PWView>
                    <PWIcon
                        name={expanded ? 'chevron-down' : 'chevron-right'}
                        size='sm'
                    />
                </PWView>
            </PWTouchableOpacity>
            {expanded && <PWView style={styles.sectionBody}>{children}</PWView>}
        </PWView>
    )
}
