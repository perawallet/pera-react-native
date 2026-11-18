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

import { useCallback, useMemo } from 'react'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { IconName } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type FolderMenuChoice = 'rename' | 'rearrange' | 'delete'

export type FolderMenuItem = {
    choice: FolderMenuChoice
    labelKey: I18nKey
    icon: IconName
    isDestructive: boolean
}

export type UseFolderMenuSheetParams = { hasDapps: boolean }

export type UseFolderMenuSheetResult = {
    items: FolderMenuItem[]
    choose: (choice: FolderMenuChoice) => void
}

const ITEMS: FolderMenuItem[] = [
    {
        choice: 'rename',
        labelKey: i18nKey('discover.folders.menu.rename'),
        icon: 'edit-pen',
        isDestructive: false,
    },
    {
        choice: 'rearrange',
        labelKey: i18nKey('discover.folders.menu.rearrange'),
        icon: 'horizontal-line-stack',
        isDestructive: false,
    },
    {
        choice: 'delete',
        labelKey: i18nKey('discover.folders.menu.delete'),
        icon: 'trash',
        isDestructive: true,
    },
]

/** The folder menu's rows; an empty folder has nothing to rearrange. */
export const useFolderMenuSheet = ({
    hasDapps,
}: UseFolderMenuSheetParams): UseFolderMenuSheetResult => {
    const { resolve } = useBottomSheetResult<FolderMenuChoice>()
    const items = useMemo(
        () => ITEMS.filter(item => hasDapps || item.choice !== 'rearrange'),
        [hasDapps],
    )
    const choose = useCallback(
        (choice: FolderMenuChoice) => resolve(choice),
        [resolve],
    )
    return { items, choose }
}
