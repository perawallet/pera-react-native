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

import type { ReactNode } from 'react'
import { PWDrawer } from '@components/core'

import { AccountDrawerContext } from '../AccountDrawerContext'
import { useAccountDrawerHost } from '../useAccountDrawerHost'

export type AccountDrawerHostProps = {
    children: ReactNode
}

export const AccountDrawerHost = ({ children }: AccountDrawerHostProps) => {
    const { isOpen, progress, controls, markOpen, markClosed, renderContent } =
        useAccountDrawerHost()

    return (
        <AccountDrawerContext.Provider value={controls}>
            <PWDrawer
                isOpen={isOpen}
                onOpen={markOpen}
                onClose={markClosed}
                renderContent={renderContent}
                variant='back'
                progress={progress}
                // Every screen that can open this drives it from a PWPager pan;
                // an edge gesture here would compete with those and claim the
                // platform back-swipe for the entire tab shell.
                hasOwnOpenGesture={false}
            >
                {children}
            </PWDrawer>
        </AccountDrawerContext.Provider>
    )
}
