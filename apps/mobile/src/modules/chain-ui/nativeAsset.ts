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

import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import {
    isNativeAsset,
    type AssetRef,
    type ChainDescriptor,
    type ChainFamily,
    type ChainId,
    type NativeAssetInfo,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    algorandNativeAssetGlyph,
    algorandNativeAssetIcon,
} from '@modules/algorand/chain-icons'
import { ethereumNativeAssetIcon } from '@modules/ethereum/chain-icons'

/** An inline font glyph amounts draw for a native coin, with its screen-reader label. */
export type NativeAssetGlyph = { glyph: string; label: string }

// Total, so a new family fails to compile until it has coin art.
const NATIVE_ASSET_ICONS: Record<
    ChainFamily,
    (chainId: ChainId) => Optional<ComponentType<SvgProps>>
> = {
    algorand: algorandNativeAssetIcon,
    evm: ethereumNativeAssetIcon,
}

// EVM has none: the bundled font only carries the Algo mark.
const NATIVE_ASSET_GLYPHS: Partial<Record<ChainFamily, NativeAssetGlyph>> = {
    algorand: algorandNativeAssetGlyph,
}

const nativeDescriptorOf = (ref: AssetRef): Optional<ChainDescriptor> => {
    const { chains } = getProvider()
    if (!chains.has(ref.chainId)) return undefined
    const { descriptor } = chains.get(ref.chainId)
    return isNativeAsset(ref, descriptor) ? descriptor : undefined
}

/** Undefined for a token, or for a chain this build doesn't register. */
export const nativeAssetInfoOf = (ref: AssetRef): Optional<NativeAssetInfo> =>
    nativeDescriptorOf(ref)?.nativeAsset

export const nativeAssetIconOf = (
    ref: AssetRef,
): Optional<ComponentType<SvgProps>> => {
    const descriptor = nativeDescriptorOf(ref)
    return descriptor && NATIVE_ASSET_ICONS[descriptor.family](ref.chainId)
}

export const nativeAssetGlyphOf = (
    ref: AssetRef,
): Optional<NativeAssetGlyph> => {
    const descriptor = nativeDescriptorOf(ref)
    return descriptor && NATIVE_ASSET_GLYPHS[descriptor.family]
}
