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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    content: {
        paddingTop: 0,
    },
    // Centers the empty component within the leftover viewport space (the
    // footer is sized to searchFooterHeight) instead of letting it sit at the
    // top. flexGrow is a fallback for the brief window before the space is
    // measured.
    emptyFill: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Opaque backing for the sticky search; without it rows scroll through the
    // transparent space around the pill (visible on iOS top overscroll).
    searchSticky: {
        backgroundColor: theme.colors.background,
    },
    // Wraps the list and the pinned search overlay floated on top of it.
    root: {
        flex: 1,
    },
    // The focusable search input, floated over the sticky bar while pinned.
    // Opaque so the rows beneath don't show through.
    searchOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        backgroundColor: theme.colors.background,
    },
    // Hidden (but kept mounted) when not pinned or while dragging.
    searchOverlayHidden: {
        opacity: 0,
    },
    // Display-only mirror of the search bar (the real input is the overlay).
    // Mirrors SearchInput's look so the overlay/sticky handoff is seamless.
    searchDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.sm,
        paddingHorizontal: theme.spacing.md,
    },
    searchDisplayText: {
        flex: 1,
        color: theme.colors.textMain,
    },
    searchDisplayPlaceholder: {
        flex: 1,
        color: theme.colors.textGray,
    },
}))
