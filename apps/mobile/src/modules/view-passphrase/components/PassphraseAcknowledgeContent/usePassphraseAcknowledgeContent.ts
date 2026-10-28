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

import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PWSheetLayoutScrollHandle } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePassphraseReach } from '../../hooks'

export type UsePassphraseAcknowledgeContentParams = {
    address: string
}

export type UsePassphraseAcknowledgeContentResult = {
    rowKeys: readonly I18nKey[]
    scopeText: Nullable<string>
    checked: boolean[]
    allChecked: boolean
    toggle: (index: number) => void
    scrollRef: RefObject<PWSheetLayoutScrollHandle | null>
}

const SINGLE_NETWORK_ROW_KEYS = [
    i18nKey('view_passphrase.acknowledge.row_screen'),
    i18nKey('view_passphrase.acknowledge.row_share'),
    i18nKey('view_passphrase.acknowledge.row_lose'),
    i18nKey('view_passphrase.acknowledge.row_pera'),
] as const

const MULTI_NETWORK_ROW_KEYS = [
    i18nKey('view_passphrase.acknowledge.row_screen'),
    i18nKey('view_passphrase.acknowledge.row_share_all_networks'),
    i18nKey('view_passphrase.acknowledge.row_lose'),
    i18nKey('view_passphrase.acknowledge.row_pera'),
] as const

const ROW_COUNT = SINGLE_NETWORK_ROW_KEYS.length

const buildInitialChecked = (rowCount: number): boolean[] =>
    Array.from({ length: rowCount }, () => false)

export const usePassphraseAcknowledgeContent = ({
    address,
}: UsePassphraseAcknowledgeContentParams): UsePassphraseAcknowledgeContentResult => {
    const { t } = useLanguage()
    const { isMultiNetwork, networkNames } = usePassphraseReach({ address })
    const [checked, setChecked] = useState<boolean[]>(() =>
        buildInitialChecked(ROW_COUNT),
    )
    const scrollRef = useRef<PWSheetLayoutScrollHandle>(null)

    const rowKeys = isMultiNetwork
        ? MULTI_NETWORK_ROW_KEYS
        : SINGLE_NETWORK_ROW_KEYS
    const scopeText = isMultiNetwork
        ? t('view_passphrase.acknowledge.scope', {
              networks: networkNames.join(', '),
          })
        : null

    const allChecked = useMemo(
        () => checked.length === ROW_COUNT && checked.every(Boolean),
        [checked],
    )

    const toggle = useCallback(
        (index: number) => {
            const isChecking = !checked[index]
            setChecked(previous =>
                previous.map((value, i) => (i === index ? !value : value)),
            )
            // On short viewports (the extension popup) the last rows sit below
            // the fold with no scroll cue; the rows end the body, so scrolling
            // to the end reveals whatever is still unticked.
            if (isChecking && checked.slice(index + 1).some(value => !value)) {
                scrollRef.current?.scrollToEnd({ animated: true })
            }
        },
        [checked],
    )

    return { rowKeys, scopeText, checked, allChecked, toggle, scrollRef }
}
