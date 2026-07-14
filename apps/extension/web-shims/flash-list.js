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

// Web shim for @shopify/flash-list v2. The real package renders its
// `AutoLayoutView` Fabric native component, which reaches into the legacy
// NativeModules bridge at import time and throws "__fbBatchedBridgeConfig is
// not set" in browser environments (FlashList v2 requires the new
// architecture and has no web target). `PWFlatList` (the only runtime
// consumer — every other import of this package in the codebase is
// `import type`, which Babel strips entirely) only relies on the FlatList
// subset of FlashList's props plus the `scrollToOffset`/`scrollToIndex`/
// `scrollToEnd` ref methods, all of which React Native's own `FlatList`
// (via react-native-web) already provides with matching signatures — so a
// thin FlatList wrapper is a real, working list on web, not an inert stub.
//
// Dropped, FlashList-only perf/layout hints that FlatList doesn't understand:
// `estimatedItemSize`, `overrideItemLayout`, `drawDistance`, `masonry`,
// `onLoad`. `renderScrollComponent` (used by PWFlatList inside bottom sheets
// to hand FlashList the sheet's own scrollable) is also dropped — FlatList
// always owns its internal ScrollView, so a FlatList nested in a web bottom
// sheet uses its own scroll view instead of the sheet's; revisit if that
// causes gesture conflicts in a bottom-sheet list on web.
//
// `onScrollToIndexFailed` gets a no-op default. FlashList tolerates
// `scrollToIndex` on an arbitrary (unmeasured, no `getItemLayout`) index —
// it estimates and corrects. RN's own FlatList/VirtualizedList does not: it
// throws an invariant ("scrollToIndex should be used in conjunction with
// getItemLayout or onScrollToIndexFailed…") unless the caller supplies the
// failure callback. `useSearchableList`/`SearchableListSheet` both call
// `scrollToIndex` without `getItemLayout`, so without this default the first
// out-of-range scroll on web would throw instead of silently no-op'ing (the
// real FlashList behavior those call sites were written against). A caller
// that passes its own `onScrollToIndexFailed` still wins — this is only a
// default.
import React, { forwardRef } from 'react'
import { FlatList } from 'react-native'

const noopOnScrollToIndexFailed = () => {}

export const FlashList = forwardRef((props, ref) => {
    const {
        estimatedItemSize: _estimatedItemSize,
        overrideItemLayout: _overrideItemLayout,
        renderScrollComponent: _renderScrollComponent,
        drawDistance: _drawDistance,
        masonry: _masonry,
        onLoad: _onLoad,
        ...flatListProps
    } = props

    return React.createElement(FlatList, {
        onScrollToIndexFailed: noopOnScrollToIndexFailed,
        ...flatListProps,
        ref,
    })
})
