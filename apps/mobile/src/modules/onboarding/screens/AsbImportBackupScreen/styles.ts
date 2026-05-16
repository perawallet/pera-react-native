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
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.background,
        marginBottom: insets.bottom,
    },
    content: {
        flex: 1,
        alignItems: 'stretch',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        gap: theme.spacing.lg,
    },
    title: {
        textAlign: 'left',
    },
    description: {
        textAlign: 'left',
        color: theme.colors.textGray,
    },
    // The whole picker area is grouped so the drop zone + paste link sit
    // vertically aligned, with the paste link visually anchored to the
    // bottom of the drop zone.
    dropZoneWrap: {
        flex: 1,
        justifyContent: 'center',
        gap: theme.spacing.lg,
    },
    dropZone: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.lg,
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
    },
    dropZoneLabel: {
        color: theme.colors.textMain,
    },
    pasteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
    },
    pasteLabel: {
        color: theme.colors.linkPrimary,
    },
    fileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
    },
    fileName: {
        flex: 1,
        color: theme.colors.textMain,
    },
    footer: {
        padding: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl,
    },
}))
