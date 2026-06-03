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
        flex: 1,
        alignItems: 'stretch',
        gap: theme.spacing.md,
        width: '100%',
        minWidth: 0,
    },
    dropZoneWrap: {
        flex: 1,
        justifyContent: 'flex-start',
        gap: theme.spacing.lg,
        width: '100%',
        minWidth: 0,
    },
    dropZone: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.lg,
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        width: '100%',
        minWidth: 0,
    },
    dropZoneLabel: {
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    pasteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        width: '100%',
        minWidth: 0,
    },
    pasteLabel: {
        color: theme.colors.linkPrimary,
        flexShrink: 1,
    },
    fileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
        width: '100%',
        minWidth: 0,
    },
    fileName: {
        flex: 1,
        minWidth: 0,
        color: theme.colors.textMain,
    },
}))
