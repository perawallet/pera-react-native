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
import { type EdgeInsets } from 'react-native-safe-area-context'

const OVERLAY_TOP_OFFSET = -100

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
    return {
        container: {
            flex: 1,
            margin: 0,
            padding: 0,
        },
        camera: {
            flex: 1,
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        },
        overlay: {
            alignItems: 'center',
            position: 'absolute',
            top: OVERLAY_TOP_OFFSET,
            bottom: 0,
            left: 0,
            right: 0,
        },
        title: {
            color: theme.colors.textWhite,
            textAlign: 'center',
            marginTop: theme.spacing.xxl,
            marginBottom: theme.spacing.xl,
        },
        handlingOverlay: {
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            gap: theme.spacing.lg,
            // Dims the stilled camera frame so the spinner reads as the app
            // working rather than the preview having died.
            backgroundColor: theme.colors.backdropModalBg,
        },
        handlingLabel: {
            color: theme.colors.textWhite,
            textAlign: 'center',
        },
        icon: {
            marginTop: insets.top,
            marginLeft: theme.spacing.xl,
            justifyContent: 'center',
            alignItems: 'center',
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
        },
        emptyView: {
            flex: 1,
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: theme.spacing.xl,
            backgroundColor: theme.colors.background,
        },
        errorActions: {
            alignSelf: 'stretch',
            gap: theme.spacing.md,
        },
    }
})
