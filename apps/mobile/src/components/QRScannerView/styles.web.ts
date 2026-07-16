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

// Bundler resolves `./styles` to this file for the web build (mirrors
// QRScannerView.web.tsx overriding QRScannerView.tsx). The native styles.ts
// lays out a full-screen camera + overlay + safe-area insets that don't
// apply here: the web view renders inside a PWBottomSheet (size='auto'),
// which hugs this content's height rather than filling the screen.
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: theme.spacing.md,
    },
    title: {
        marginBottom: theme.spacing.lg,
    },
    video: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
        objectFit: 'cover',
        marginBottom: theme.spacing.lg,
    },
    unavailable: {
        textAlign: 'center',
        marginBottom: theme.spacing.lg,
    },
    scanWithCamera: {
        marginBottom: theme.spacing.lg,
    },
    pasteLabel: {
        marginBottom: theme.spacing.sm,
    },
    pasteRow: {
        gap: theme.spacing.md,
    },
}))
