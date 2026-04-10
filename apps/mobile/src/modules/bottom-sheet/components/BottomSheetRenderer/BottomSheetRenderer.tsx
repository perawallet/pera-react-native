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

import React from 'react'
import { PWBottomSheet } from '@components/core'
import { useBottomSheetStack } from '../../hooks'

/**
 * BottomSheetRenderer renders bottom sheets from the centralized store stack.
 * Place this component at the app root level to enable stack-based bottom sheets.
 * Use the `useBottomSheet` hook to open sheets from anywhere in the app.
 */
export const BottomSheetRenderer = () => {
    const { stack, removeSheet } = useBottomSheetStack()

    return (
        <>
            {stack.map(entry => {
                const Component = entry.component
                return (
                    <PWBottomSheet
                        key={entry.id}
                        isVisible={true}
                        onDismiss={() => removeSheet(entry.id)}
                        {...entry.options}
                    >
                        <Component
                            {...entry.props}
                            onClose={() => removeSheet(entry.id)}
                        />
                    </PWBottomSheet>
                )
            })}
        </>
    )
}
