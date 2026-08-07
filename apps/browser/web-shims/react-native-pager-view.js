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

// Web shim for react-native-pager-view. The real package requires a native
// `RNCViewPager` view manager and touches the legacy NativeModules bridge at
// import time, throwing "__fbBatchedBridgeConfig is not set" on web — it has
// no react-native-web build. There are 5 runtime consumers in this codebase:
// MediaCarousel, FullScreenMediaViewer, OnrampScreen, BannerCarousel and
// SpotBannerCarousel (OnrampScreen is off-capability on web today —
// `routeCapabilities.fundTab` is false — but the shim must still behave
// correctly if that ever changes, not just avoid crashing). All 5 use only
// `style`, `initialPage`, `onPageSelected` and plain children-as-pages;
// OnrampScreen additionally drives the pager imperatively via
// `ref.current?.setPage(index)`. A horizontal, paging-enabled ScrollView is
// a real, swipeable substitute rather than an inert stub.
//
// react-native-web's ScrollView never dispatches onMomentumScrollEnd (the
// prop isn't wired through to the underlying DOM scroll handler — see
// react-native-web/dist/exports/ScrollView/ScrollViewBase.js, whose
// `handleScroll`/`handleScrollEnd` only ever call `onScroll`) and it doesn't
// honor a `contentOffset` prop at all (no such handling anywhere in
// react-native-web/dist/exports/ScrollView/index.js). An earlier version of
// this shim wired page detection to `onMomentumScrollEnd` and passed
// `contentOffset` for `initialPage`, both silently dead on web. This version
// derives the selected page from `onScroll` instead (debounced and rounded
// to page width, mirroring how react-native-web's own ScrollViewBase
// debounces its scroll-end detection) and applies `initialPage` imperatively
// via `scrollTo` once real layout width is known.
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { ScrollView, View } from 'react-native'

// How long to wait after the last onScroll event before treating the
// current offset as "settled" on a page and firing onPageSelected. Native
// PagerView only fires once per landed page, not on every scroll tick.
const PAGE_SETTLE_DEBOUNCE_MS = 100

const PagerView = forwardRef((props, ref) => {
    const { children, style, initialPage = 0, onPageSelected, ...rest } = props

    const [pageWidth, setPageWidth] = useState(0)
    const lastPosition = useRef(initialPage)
    const scrollNodeRef = useRef(null)
    const settleTimeoutRef = useRef(null)
    const hasAppliedInitialPageRef = useRef(false)
    // Latest callback in a ref so the debounce timeout always invokes the
    // current handler without needing to reset itself when the prop changes.
    const onPageSelectedRef = useRef(onPageSelected)
    useEffect(() => {
        onPageSelectedRef.current = onPageSelected
    }, [onPageSelected])

    useEffect(
        () => () => {
            if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
        },
        [],
    )

    const scrollToPage = useCallback(
        (page, animated) => {
            if (pageWidth <= 0) return
            lastPosition.current = page
            scrollNodeRef.current?.scrollTo({
                x: page * pageWidth,
                y: 0,
                animated,
            })
        },
        [pageWidth],
    )

    // Imperative parity with the real PagerView ref API. OnrampScreen calls
    // `setPage`; `setPageWithoutAnimation` is exposed for the same reason
    // even though nothing here calls it yet.
    useImperativeHandle(
        ref,
        () => ({
            setPage: page => scrollToPage(page, true),
            setPageWithoutAnimation: page => scrollToPage(page, false),
        }),
        [scrollToPage],
    )

    const handleLayout = useCallback(
        event => {
            const { width } = event.nativeEvent.layout
            setPageWidth(width)
            // react-native-web's ScrollView doesn't honor `contentOffset`, so
            // `initialPage` has to be applied by scrolling once real layout
            // width is known. Only on the first layout that yields a usable
            // width — later relayouts (e.g. window resize) must not re-snap
            // the user back to `initialPage`.
            if (
                !hasAppliedInitialPageRef.current &&
                initialPage > 0 &&
                width > 0
            ) {
                hasAppliedInitialPageRef.current = true
                scrollNodeRef.current?.scrollTo({
                    x: initialPage * width,
                    y: 0,
                    animated: false,
                })
            }
        },
        [initialPage],
    )

    const handleScroll = useCallback(
        event => {
            if (pageWidth <= 0) return
            const position = Math.round(
                event.nativeEvent.contentOffset.x / pageWidth,
            )
            if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
            settleTimeoutRef.current = setTimeout(() => {
                if (position === lastPosition.current) return
                lastPosition.current = position
                onPageSelectedRef.current?.({ nativeEvent: { position } })
            }, PAGE_SETTLE_DEBOUNCE_MS)
        },
        [pageWidth],
    )

    const pages = React.Children.toArray(children)

    return React.createElement(
        ScrollView,
        {
            ref: node => {
                scrollNodeRef.current = node
            },
            horizontal: true,
            pagingEnabled: true,
            showsHorizontalScrollIndicator: false,
            onLayout: handleLayout,
            onScroll: handleScroll,
            scrollEventThrottle: 16,
            style,
            ...rest,
        },
        pages.map((page, index) =>
            React.createElement(
                View,
                { key: index, style: { width: pageWidth || '100%' } },
                page,
            ),
        ),
    )
})

export default PagerView
