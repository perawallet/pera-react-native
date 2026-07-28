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

import { makeStyles } from '@rneui/themed'

// Preserves the source aspect ratio of the Ledger searching animation
// (~137×39) while rendering it at a legible size in the header — matches
// the constrained content width (see CONTENT_MAX_WIDTH below).
const ANIMATION_WIDTH = 300
const ANIMATION_HEIGHT = Math.round((ANIMATION_WIDTH * 39) / 137)

// Matches ScanQRScreen's content cap — the only other screen in this app
// that renders in the wide "expanded" browser-tab surface. Unconstrained
// flex:1 content there spreads fixed-width elements (the header animation)
// to the literal edges of the viewport instead of reading like a normal,
// centered desktop page. A no-op in the 360px popup.
const CONTENT_MAX_WIDTH = 480

export const useStyles = makeStyles(theme => ({
    content: {
        flex: 1,
        width: '100%',
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: 'center',
    },
    headerAnimation: {
        width: ANIMATION_WIDTH,
        height: ANIMATION_HEIGHT,
        marginBottom: theme.spacing.md,
        alignSelf: 'center',
    },
    listContent: {
        paddingTop: theme.spacing.md,
    },
    errorContainer: {
        paddingTop: theme.spacing.xl,
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    errorText: {
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
