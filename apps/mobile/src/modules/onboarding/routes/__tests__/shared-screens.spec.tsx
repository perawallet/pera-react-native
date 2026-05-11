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

import { Children, Fragment, isValidElement } from 'react'
import { describe, it, expect } from 'vitest'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import {
    IMPORT_FLOW_SCREEN_NAMES,
    renderImportFlowScreens,
} from '../shared-screens'
import type { ImportFlowParamList } from '../types'

type ScreenChild = {
    props: {
        name: string
        options?: { title?: string; headerShown?: boolean }
    }
}

const collectScreenChildren = (node: React.ReactNode): ScreenChild[] => {
    const children =
        isValidElement(node) && node.type === Fragment
            ? (node.props as { children: React.ReactNode }).children
            : node
    return Children.toArray(children)
        .filter(isValidElement)
        .map(child => child as unknown as ScreenChild)
}

describe('renderImportFlowScreens', () => {
    it('registers every screen named in IMPORT_FLOW_SCREEN_NAMES exactly once', () => {
        const Stack = createNativeStackNavigator<ImportFlowParamList>()

        const tree = renderImportFlowScreens(Stack)
        const names = collectScreenChildren(tree).map(child => child.props.name)
        const duplicates = names.filter(
            (name, index) => names.indexOf(name) !== index,
        )

        expect(duplicates).toEqual([])
        expect([...names].sort()).toEqual([...IMPORT_FLOW_SCREEN_NAMES].sort())
    })

    it('every screen has either title="" or headerShown:false', () => {
        const Stack = createNativeStackNavigator<ImportFlowParamList>()

        const screens = collectScreenChildren(renderImportFlowScreens(Stack))

        for (const screen of screens) {
            const options = screen.props.options ?? {}
            const isTitleEmpty = options.title === ''
            const isHeaderHidden = options.headerShown === false
            expect(
                isTitleEmpty || isHeaderHidden,
                `Screen "${screen.props.name}" must set options.title="" or options.headerShown=false`,
            ).toBe(true)
        }
    })
})
