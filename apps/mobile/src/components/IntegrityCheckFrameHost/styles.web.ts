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
import {
    INTEGRITY_CHECK_HIDDEN_SIZE,
    INTEGRITY_CHECK_MODAL_HEIGHT,
    INTEGRITY_CHECK_MODAL_WIDTH,
} from '@constants/ui'

export const useStyles = makeStyles(theme => ({
    // Tiny and transparent, never display: none, which would stop Turnstile.
    // Absolute with no positioned ancestor pins to the viewport, as neither
    // surface scrolls its body; React Native's style types reject fixed.
    hidden: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: INTEGRITY_CHECK_HIDDEN_SIZE,
        height: INTEGRITY_CHECK_HIDDEN_SIZE,
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: theme.zIndex.integrityCheck,
    },
    hiddenFrame: {
        width: INTEGRITY_CHECK_HIDDEN_SIZE,
        height: INTEGRITY_CHECK_HIDDEN_SIZE,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.backdropModalBg,
        zIndex: theme.zIndex.integrityCheck,
    },
    modal: {
        width: INTEGRITY_CHECK_MODAL_WIDTH,
        height: INTEGRITY_CHECK_MODAL_HEIGHT,
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
    },
}))
