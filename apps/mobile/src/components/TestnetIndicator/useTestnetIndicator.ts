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

import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'

type UseTestnetIndicatorResult = {
    isVisible: boolean
    label: string
}

// Web has no OS status bar to host native's full-width testnet bar
// (RootComponent.tsx), and a persistent in-flow banner would eat too much of
// the 360x600 popup viewport. This surfaces the same "you're on TestNet"
// signal as a small absolutely-positioned badge instead — see
// TestnetIndicator.tsx / styles.ts.
export const useTestnetIndicator = (): UseTestnetIndicatorResult => {
    const { isTestnet } = useNetwork()
    const { t } = useLanguage()

    return {
        isVisible: isTestnet,
        label: t('common.testnet_indicator'),
    }
}
