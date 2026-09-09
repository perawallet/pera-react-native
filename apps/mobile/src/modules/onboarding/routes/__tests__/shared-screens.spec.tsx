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

import React, { Children, Fragment, isValidElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

const { exitAccountFlowMock, capturedOnDone } = vi.hoisted(() => ({
    exitAccountFlowMock: vi.fn(),
    capturedOnDone: new Map<string, () => void>(),
}))

// Stubs: what is under test is the wiring the registration supplies, not what
// the restore screens render.
vi.mock('@modules/cloud-backup/screens/CloudBackupRestoreScanScreen', () => ({
    CloudBackupRestoreScanScreen: ({ onDone }: { onDone: () => void }) => {
        capturedOnDone.set('CloudBackupRestoreScan', onDone)
        return null
    },
}))
vi.mock(
    '@modules/cloud-backup/screens/CloudBackupRestoreEncryptionKeyScreen',
    () => ({
        CloudBackupRestoreEncryptionKeyScreen: ({
            onDone,
        }: {
            onDone: () => void
        }) => {
            capturedOnDone.set('CloudBackupRestoreEncryptionKey', onDone)
            return null
        },
    }),
)
vi.mock('@modules/onboarding/hooks/useExitAccountFlow', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: exitAccountFlowMock }),
}))

import {
    IMPORT_FLOW_SCREEN_NAMES,
    renderImportFlowScreens,
} from '../shared-screens'
import type { ImportFlowParamList } from '../types'

type ScreenChild = {
    props: {
        name: string
        component: React.ComponentType
        options?:
            | { title?: string; headerShown?: boolean }
            | ((arg: { route: { params: Record<string, unknown> } }) => {
                  title?: string
                  headerShown?: boolean
              })
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
    beforeEach(() => {
        vi.clearAllMocks()
        capturedOnDone.clear()
    })

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

    it('every screen has either title="" or headerShown:false or a dynamic title', () => {
        const Stack = createNativeStackNavigator<ImportFlowParamList>()

        const screens = collectScreenChildren(renderImportFlowScreens(Stack))

        for (const screen of screens) {
            const options = screen.props.options
            const isDynamic = typeof options === 'function'
            const staticOptions =
                typeof options === 'object' && options !== null ? options : {}
            const isTitleEmpty = staticOptions.title === ''
            const isHeaderHidden = staticOptions.headerShown === false
            expect(
                isDynamic || isTitleEmpty || isHeaderHidden,
                `Screen "${screen.props.name}" must set options.title="" or options.headerShown=false or use a dynamic options function`,
            ).toBe(true)
        }
    })
})

// `CloudBackupOverview`, the cloud-backup stack's own terminal reset, is not
// registered here and is owned by a sibling navigator, so a RESET naming it
// would find no handler and strand the user on the restore screen.
describe('cloud-backup restore screens registered in the import flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedOnDone.clear()
    })

    it.each([
        'CloudBackupRestoreScan',
        'CloudBackupRestoreEncryptionKey',
    ] as const)('exits %s through the import flow exit', name => {
        const Stack = createNativeStackNavigator<ImportFlowParamList>()
        const screens = collectScreenChildren(renderImportFlowScreens(Stack))
        const Registered = screens.find(screen => screen.props.name === name)
            ?.props.component

        expect(Registered).toBeDefined()
        render(React.createElement(Registered!))
        capturedOnDone.get(name)?.()

        expect(exitAccountFlowMock).toHaveBeenCalled()
    })
})
