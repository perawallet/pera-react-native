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

import React, { type ReactNode } from 'react'

import { PWText, PWView } from '@components/core'

import { useVariantPreviewStyles } from './styles'

type VariantPreviewItem = {
    label: string
    node: ReactNode
}

type VariantPreviewProps = {
    items: VariantPreviewItem[]
}

export const VariantPreview = ({ items }: VariantPreviewProps) => {
    const styles = useVariantPreviewStyles()

    return (
        <PWView style={styles.container}>
            {items.map(item => (
                <PWView
                    key={item.label}
                    style={styles.row}
                >
                    <PWText
                        variant='captionMedium'
                        style={styles.label}
                    >
                        {item.label}
                    </PWText>
                    {item.node}
                </PWView>
            ))}
        </PWView>
    )
}
