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

import React from 'react'
import { makeStyles } from '@rneui/themed'

import {
    PWBadge,
    PWBottomSheet,
    PWButton,
    PWCheckbox,
    PWChip,
    PWDivider,
    PWDropdown,
    PWFlatList,
    PWHeader,
    PWIcon,
    PWImage,
    PWInfoView,
    PWInput,
    PWListItem,
    PWLoadingOverlay,
    PWLottie,
    PWNumpad,
    PWOverlay,
    PWPinCircles,
    PWRadioButton,
    PWResultView,
    PWRoundIcon,
    PWScreen,
    PWScrollView,
    PWSkeleton,
    PWSlideToConfirm,
    PWSwipeable,
    PWSwitch,
    PWTabView,
    PWText,
    PWToolbar,
    PWTouchableIcon,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import peraTransactionLoading from '@assets/animations/pera-transaction-loading.json'

import { registerPreview } from './registry'
import { VariantPreview } from './VariantPreview'

const useLottiePreviewStyles = makeStyles(theme => ({
    media: { width: theme.spacing['4xl'], height: theme.spacing['4xl'] },
}))

const LottiePreview = () => {
    const styles = useLottiePreviewStyles()
    return (
        <PWLottie
            source={peraTransactionLoading}
            autoPlay
            loop
            style={styles.media}
        />
    )
}

import type { GallerySection } from './types'

registerPreview({
    id: 'comp-pw-button',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'primary',
                    node: (
                        <PWButton
                            title='Primary button'
                            variant='primary'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'secondary',
                    node: (
                        <PWButton
                            title='Secondary button'
                            variant='secondary'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'helper',
                    node: (
                        <PWButton
                            title='Helper button'
                            variant='helper'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'destructive',
                    node: (
                        <PWButton
                            title='Destructive button'
                            variant='destructive'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'link',
                    node: (
                        <PWButton
                            title='Link button'
                            variant='link'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'primary + icon left',
                    node: (
                        <PWButton
                            title='Send'
                            variant='primary'
                            icon='transactions/send'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'primary + isDisabled',
                    node: (
                        <PWButton
                            title='Disabled'
                            variant='primary'
                            isDisabled
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'primary + isLoading',
                    node: (
                        <PWButton
                            title='Loading…'
                            variant='primary'
                            isLoading
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'primary + long title',
                    node: (
                        <PWButton
                            title='This is a very long button title that should truncate gracefully'
                            variant='primary'
                            onPress={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-slide-to-confirm',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'idle',
                    node: (
                        <PWSlideToConfirm
                            title='Slide to confirm'
                            onConfirm={() => undefined}
                        />
                    ),
                },
                {
                    label: 'isDisabled',
                    node: (
                        <PWSlideToConfirm
                            title='Slide to confirm (disabled)'
                            onConfirm={() => undefined}
                            isDisabled
                        />
                    ),
                },
                {
                    label: 'isConfirmed',
                    node: (
                        <PWSlideToConfirm
                            title='Slide to confirm (confirmed)'
                            onConfirm={() => undefined}
                            isConfirmed
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-touchable-opacity',
    render: () => (
        <PWTouchableOpacity onPress={() => undefined}>
            <PWText variant='body'>Touchable area</PWText>
        </PWTouchableOpacity>
    ),
})

registerPreview({
    id: 'comp-pw-touchable-icon',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'bell / md / primary',
                    node: (
                        <PWTouchableIcon
                            name='bell'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'copy / sm / secondary',
                    node: (
                        <PWTouchableIcon
                            name='copy'
                            size='sm'
                            variant='secondary'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'trash / lg / error',
                    node: (
                        <PWTouchableIcon
                            name='trash'
                            size='lg'
                            variant='error'
                            onPress={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-input',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'empty with placeholder',
                    node: (
                        <PWInput
                            value=''
                            onChangeText={() => undefined}
                            placeholder='Enter text…'
                            label='Label'
                        />
                    ),
                },
                {
                    label: 'filled value',
                    node: (
                        <PWInput
                            value='My Wallet Account'
                            onChangeText={() => undefined}
                            label='Account name'
                        />
                    ),
                },
                {
                    label: 'with error message',
                    node: (
                        <PWInput
                            value='bad!'
                            onChangeText={() => undefined}
                            label='Amount'
                            errorMessage='Amount must be greater than zero'
                            renderErrorMessage
                        />
                    ),
                },
                {
                    label: 'not editable (read-only)',
                    node: (
                        <PWInput
                            value='AAABBBCCC111222333444555666'
                            onChangeText={() => undefined}
                            label='Address'
                            editable={false}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-checkbox',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'checked',
                    node: (
                        <PWCheckbox
                            checked={true}
                            onPress={() => undefined}
                            title='Accept terms and conditions'
                        />
                    ),
                },
                {
                    label: 'unchecked',
                    node: (
                        <PWCheckbox
                            checked={false}
                            onPress={() => undefined}
                            title='Subscribe to newsletter'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-radio-button',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'selected',
                    node: (
                        <PWRadioButton
                            isSelected={true}
                            onPress={() => undefined}
                            title='Option A — selected'
                        />
                    ),
                },
                {
                    label: 'unselected',
                    node: (
                        <PWRadioButton
                            isSelected={false}
                            onPress={() => undefined}
                            title='Option B — unselected'
                        />
                    ),
                },
                {
                    label: 'disabled + selected',
                    node: (
                        <PWRadioButton
                            isSelected={true}
                            isDisabled
                            onPress={() => undefined}
                            title='Option C — disabled selected'
                        />
                    ),
                },
                {
                    label: 'disabled + unselected',
                    node: (
                        <PWRadioButton
                            isSelected={false}
                            isDisabled
                            onPress={() => undefined}
                            title='Option D — disabled unselected'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-switch',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'on',
                    node: (
                        <PWSwitch
                            value={true}
                            onValueChange={() => undefined}
                        />
                    ),
                },
                {
                    label: 'off',
                    node: (
                        <PWSwitch
                            value={false}
                            onValueChange={() => undefined}
                        />
                    ),
                },
                {
                    label: 'disabled + on',
                    node: (
                        <PWSwitch
                            value={true}
                            onValueChange={() => undefined}
                            disabled
                        />
                    ),
                },
                {
                    label: 'disabled + off',
                    node: (
                        <PWSwitch
                            value={false}
                            onValueChange={() => undefined}
                            disabled
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-numpad',
    render: () => (
        <PWNumpad
            mode='pin'
            onKeyPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-pw-pin-circles',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'empty (0 / 6)',
                    node: (
                        <PWPinCircles
                            length={6}
                            filledCount={0}
                        />
                    ),
                },
                {
                    label: 'partial (3 / 6)',
                    node: (
                        <PWPinCircles
                            length={6}
                            filledCount={3}
                        />
                    ),
                },
                {
                    label: 'full (6 / 6)',
                    node: (
                        <PWPinCircles
                            length={6}
                            filledCount={6}
                        />
                    ),
                },
                {
                    label: 'error state (3 / 6 + hasError)',
                    node: (
                        <PWPinCircles
                            length={6}
                            filledCount={3}
                            hasError
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-text',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'h1',
                    node: <PWText variant='h1'>Heading 1 — large title</PWText>,
                },
                {
                    label: 'h2',
                    node: (
                        <PWText variant='h2'>Heading 2 — section title</PWText>
                    ),
                },
                {
                    label: 'h3',
                    node: <PWText variant='h3'>Heading 3 — subsection</PWText>,
                },
                {
                    label: 'h4',
                    node: <PWText variant='h4'>Heading 4 — label bold</PWText>,
                },
                {
                    label: 'body',
                    node: (
                        <PWText variant='body'>
                            Body — regular prose text
                        </PWText>
                    ),
                },
                {
                    label: 'bodyLarge',
                    node: (
                        <PWText variant='bodyLarge'>
                            Body large — slightly larger prose
                        </PWText>
                    ),
                },
                {
                    label: 'bodySemibold',
                    node: (
                        <PWText variant='bodySemibold'>
                            Body semibold — emphasis
                        </PWText>
                    ),
                },
                {
                    label: 'bodyCompact',
                    node: (
                        <PWText variant='bodyCompact'>
                            Body compact — tight line height
                        </PWText>
                    ),
                },
                {
                    label: 'caption',
                    node: (
                        <PWText variant='caption'>Caption — small label</PWText>
                    ),
                },
                {
                    label: 'captionMedium',
                    node: (
                        <PWText variant='captionMedium'>
                            Caption medium — chip text
                        </PWText>
                    ),
                },
                {
                    label: 'captionSmall',
                    node: (
                        <PWText variant='captionSmall'>
                            Caption small — tiny annotation
                        </PWText>
                    ),
                },
                {
                    label: 'footnoteMedium',
                    node: (
                        <PWText variant='footnoteMedium'>
                            Footnote medium — metadata
                        </PWText>
                    ),
                },
                {
                    label: 'mono',
                    node: (
                        <PWText variant='mono'>
                            AAABBBCCC111222333444555666 — monospace address
                        </PWText>
                    ),
                },
                {
                    label: 'body + long wrapping text',
                    node: (
                        <PWText variant='body'>
                            This is a longer paragraph of body text to
                            demonstrate how PWText wraps gracefully across
                            multiple lines when the content exceeds the
                            available horizontal width.
                        </PWText>
                    ),
                },
                {
                    label: 'body + truncate (single line)',
                    node: (
                        <PWText
                            variant='body'
                            truncate
                        >
                            This very long line should be truncated with an
                            ellipsis when it runs out of space on a single line
                        </PWText>
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-badge',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'primary',
                    node: (
                        <PWBadge
                            value='3'
                            variant='primary'
                        />
                    ),
                },
                {
                    label: 'alert',
                    node: (
                        <PWBadge
                            value='!'
                            variant='alert'
                        />
                    ),
                },
                {
                    label: 'positive',
                    node: (
                        <PWBadge
                            value='✓'
                            variant='positive'
                        />
                    ),
                },
                {
                    label: 'secondary',
                    node: (
                        <PWBadge
                            value='99'
                            variant='secondary'
                        />
                    ),
                },
                {
                    label: 'testnet',
                    node: (
                        <PWBadge
                            value='T'
                            variant='testnet'
                        />
                    ),
                },
                {
                    label: 'new',
                    node: (
                        <PWBadge
                            value='NEW'
                            variant='new'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-chip',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'helper',
                    node: (
                        <PWChip
                            title='Trusted'
                            variant='helper'
                        />
                    ),
                },
                {
                    label: 'secondary',
                    node: (
                        <PWChip
                            title='Verified'
                            variant='secondary'
                        />
                    ),
                },
                {
                    label: 'outline',
                    node: (
                        <PWChip
                            title='Outline chip'
                            variant='outline'
                        />
                    ),
                },
                {
                    label: 'secondary + long label',
                    node: (
                        <PWChip
                            title='This is a much longer chip label'
                            variant='secondary'
                        />
                    ),
                },
                {
                    label: 'secondary + dense padding',
                    node: (
                        <PWChip
                            title='Dense'
                            variant='secondary'
                            paddingStyle='dense'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-icon',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'bell / xs / primary',
                    node: (
                        <PWIcon
                            name='bell'
                            size='xs'
                            variant='primary'
                        />
                    ),
                },
                {
                    label: 'bell / md / primary',
                    node: (
                        <PWIcon
                            name='bell'
                            size='md'
                            variant='primary'
                        />
                    ),
                },
                {
                    label: 'bell / xl / primary',
                    node: (
                        <PWIcon
                            name='bell'
                            size='xl'
                            variant='primary'
                        />
                    ),
                },
                {
                    label: 'check / lg / positive',
                    node: (
                        <PWIcon
                            name='check'
                            size='lg'
                            variant='positive'
                        />
                    ),
                },
                {
                    label: 'trash / md / error',
                    node: (
                        <PWIcon
                            name='trash'
                            size='md'
                            variant='error'
                        />
                    ),
                },
                {
                    label: 'copy / sm / secondary',
                    node: (
                        <PWIcon
                            name='copy'
                            size='sm'
                            variant='secondary'
                        />
                    ),
                },
                {
                    label: 'globe / md / link',
                    node: (
                        <PWIcon
                            name='globe'
                            size='md'
                            variant='link'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-round-icon',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'bell / sm / primary',
                    node: (
                        <PWRoundIcon
                            icon='bell'
                            size='sm'
                            variant='primary'
                        />
                    ),
                },
                {
                    label: 'bell / lg / secondary',
                    node: (
                        <PWRoundIcon
                            icon='bell'
                            size='lg'
                            variant='secondary'
                        />
                    ),
                },
                {
                    label: 'check / xl / positive',
                    node: (
                        <PWRoundIcon
                            icon='check'
                            size='xl'
                            variant='positive'
                        />
                    ),
                },
                {
                    label: 'trash / lg / error',
                    node: (
                        <PWRoundIcon
                            icon='trash'
                            size='lg'
                            variant='error'
                        />
                    ),
                },
                {
                    label: 'algo25 glyph / md / accountTurquoise',
                    node: (
                        <PWRoundIcon
                            icon='accounts/glyph/algo25-account'
                            size='md'
                            variant='accountTurquoise'
                        />
                    ),
                },
                {
                    label: 'ledger glyph / sm / accountPurple',
                    node: (
                        <PWRoundIcon
                            icon='accounts/glyph/ledger-account'
                            size='sm'
                            variant='accountPurple'
                        />
                    ),
                },
                {
                    label: 'quantum glyph / md / accountQuantum',
                    node: (
                        <PWRoundIcon
                            icon='accounts/glyph/quantum-account'
                            size='md'
                            variant='accountQuantum'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-image',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'cover / 80×80',
                    node: (
                        <PWImage
                            source={{ uri: 'https://via.placeholder.com/80' }}
                            width={80}
                            height={80}
                        />
                    ),
                },
                {
                    label: 'contain / 120×60',
                    node: (
                        <PWImage
                            source={{
                                uri: 'https://via.placeholder.com/120x60',
                            }}
                            width={120}
                            height={60}
                            resizeMode='contain'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-skeleton',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'pulse / single row / height 20',
                    node: (
                        <PWSkeleton
                            animation='pulse'
                            height={20}
                        />
                    ),
                },
                {
                    label: 'pulse / 3 rows / height 16',
                    node: (
                        <PWSkeleton
                            animation='pulse'
                            height={16}
                            count={3}
                        />
                    ),
                },
                {
                    label: 'pulse / circle / 48×48',
                    node: (
                        <PWSkeleton
                            animation='pulse'
                            height={48}
                            width={48}
                            circle
                        />
                    ),
                },
                {
                    label: 'wave / 2 rows / height 20',
                    node: (
                        <PWSkeleton
                            animation='wave'
                            height={20}
                            count={2}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-lottie',
    render: () => <LottiePreview />,
})

registerPreview({
    id: 'comp-pw-view',
    render: () => (
        <PWView>
            <PWText variant='body'>Content inside PWView</PWText>
        </PWView>
    ),
})

registerPreview({
    id: 'comp-pw-divider',
    render: () => (
        <PWView>
            <PWText variant='body'>Above</PWText>
            <PWDivider />
            <PWText variant='body'>Below</PWText>
        </PWView>
    ),
})

registerPreview({
    id: 'comp-pw-scroll-view',
    render: () => (
        <PWScrollView>
            <PWText variant='body'>Scrollable content</PWText>
        </PWScrollView>
    ),
})

registerPreview({
    id: 'comp-pw-flat-list',
    render: () => (
        <PWFlatList
            data={['Item 1', 'Item 2', 'Item 3']}
            keyExtractor={item => item}
            renderItem={({ item }) => <PWText variant='body'>{item}</PWText>}
        />
    ),
})

registerPreview({
    id: 'comp-pw-swipeable',
    render: () => (
        <PWSwipeable renderRightActions={() => <PWView />}>
            <PWText variant='body'>Swipe me left</PWText>
        </PWSwipeable>
    ),
})

registerPreview({
    id: 'comp-pw-screen',
    render: () => (
        <PWScreen scroll='never'>
            <PWText variant='body'>Screen body content</PWText>
        </PWScreen>
    ),
})

// PWTabView is a navigator factory, not an inline-renderable component.
void PWTabView // keep the import live

registerPreview({
    id: 'comp-pw-tab-view',
    render: () => (
        <PWView>
            <PWText variant='caption'>
                PWTabView.createNavigator() — navigator factory, not
                inline-renderable
            </PWText>
        </PWView>
    ),
})

registerPreview({
    id: 'comp-pw-header',
    render: () => (
        <PWHeader
            title='Header title'
            leftIcon='chevron-left'
            rightIcon='bell'
            onLeftPress={() => undefined}
            onRightPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-pw-toolbar',
    render: () => (
        <PWToolbar
            left={<PWText variant='body'>Left</PWText>}
            center={<PWText variant='body'>Title</PWText>}
            right={<PWText variant='body'>Right</PWText>}
        />
    ),
})

registerPreview({
    id: 'comp-pw-list-item',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'short title',
                    node: (
                        <PWListItem
                            icon='bell'
                            title='Notifications'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'long title (truncation)',
                    node: (
                        <PWListItem
                            icon='wallet'
                            title='This is a very long list item title that should be truncated by the component'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'gear icon',
                    node: (
                        <PWListItem
                            icon='gear'
                            title='Settings'
                            onPress={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-info-view',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'with primary action only',
                    node: (
                        <PWInfoView
                            title='No items found'
                            body='Try adjusting your filters to find what you are looking for.'
                            primaryAction={{
                                label: 'Refresh',
                                onPress: () => undefined,
                            }}
                        />
                    ),
                },
                {
                    label: 'with primary + secondary actions',
                    node: (
                        <PWInfoView
                            title='Something went wrong'
                            body='We could not load your data. Please try again or contact support.'
                            primaryAction={{
                                label: 'Retry',
                                onPress: () => undefined,
                            }}
                            secondaryAction={{
                                label: 'Contact support',
                                onPress: () => undefined,
                            }}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-result-view',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'success',
                    node: (
                        <PWResultView
                            variant='success'
                            title='Transaction sent'
                            body='Your transaction has been submitted successfully.'
                            primaryAction={{
                                label: 'Done',
                                onPress: () => undefined,
                            }}
                        />
                    ),
                },
                {
                    label: 'error',
                    node: (
                        <PWResultView
                            variant='error'
                            title='Transaction failed'
                            body='The transaction could not be submitted. Please try again.'
                            primaryAction={{
                                label: 'Retry',
                                onPress: () => undefined,
                            }}
                            secondaryAction={{
                                label: 'Cancel',
                                onPress: () => undefined,
                            }}
                        />
                    ),
                },
                {
                    label: 'warning',
                    node: (
                        <PWResultView
                            variant='warning'
                            title='Proceed with caution'
                            body='This action cannot be undone. Please review before continuing.'
                            primaryAction={{
                                label: 'Continue',
                                onPress: () => undefined,
                            }}
                            secondaryAction={{
                                label: 'Go back',
                                onPress: () => undefined,
                            }}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-dropdown',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'default items (tap to open)',
                    node: (
                        <PWDropdown
                            items={[
                                {
                                    label: 'Copy',
                                    icon: 'copy',
                                    onPress: () => undefined,
                                },
                                { label: 'Share', onPress: () => undefined },
                            ]}
                        >
                            <PWText variant='body'>Open menu ▾</PWText>
                        </PWDropdown>
                    ),
                },
                {
                    label: 'with destructive item (tap to open)',
                    node: (
                        <PWDropdown
                            items={[
                                {
                                    label: 'Edit',
                                    icon: 'edit-pen',
                                    onPress: () => undefined,
                                },
                                {
                                    label: 'Delete',
                                    icon: 'trash',
                                    variant: 'destructive',
                                    onPress: () => undefined,
                                },
                            ]}
                        >
                            <PWText variant='body'>Actions ▾</PWText>
                        </PWDropdown>
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-pw-overlay',
    render: () => (
        <PWOverlay
            isVisible={true}
            onBackdropPress={() => undefined}
        >
            <PWText variant='body'>Overlay content</PWText>
        </PWOverlay>
    ),
})

registerPreview({
    id: 'comp-pw-loading-overlay',
    render: () => (
        <PWLoadingOverlay
            isVisible={true}
            title='Loading…'
        />
    ),
})

registerPreview({
    id: 'comp-pw-bottom-sheet',
    render: () => (
        <PWBottomSheet isVisible={true}>
            <PWText variant='body'>Bottom sheet content</PWText>
        </PWBottomSheet>
    ),
})

export const getComponentSections = (): GallerySection[] => [
    {
        title: 'Core — buttons & actions',
        items: [
            {
                id: 'comp-pw-button',
                label: 'PWButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-slide-to-confirm',
                label: 'PWSlideToConfirm',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-touchable-opacity',
                label: 'PWTouchableOpacity',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-touchable-icon',
                label: 'PWTouchableIcon',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — inputs',
        items: [
            {
                id: 'comp-pw-input',
                label: 'PWInput',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-checkbox',
                label: 'PWCheckbox',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-radio-button',
                label: 'PWRadioButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-switch',
                label: 'PWSwitch',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-numpad',
                label: 'PWNumpad',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-pin-circles',
                label: 'PWPinCircles',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — display',
        items: [
            {
                id: 'comp-pw-text',
                label: 'PWText',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-badge',
                label: 'PWBadge',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-chip',
                label: 'PWChip',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-icon',
                label: 'PWIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-round-icon',
                label: 'PWRoundIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-image',
                label: 'PWImage',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-skeleton',
                label: 'PWSkeleton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-lottie',
                label: 'PWLottie',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — layout & structure',
        items: [
            {
                id: 'comp-pw-view',
                label: 'PWView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-divider',
                label: 'PWDivider',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-scroll-view',
                label: 'PWScrollView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-flat-list',
                label: 'PWFlatList',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-swipeable',
                label: 'PWSwipeable',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-screen',
                label: 'PWScreen',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — navigation chrome',
        items: [
            {
                id: 'comp-pw-header',
                label: 'PWHeader',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-toolbar',
                label: 'PWToolbar',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-tab-view',
                label: 'PWTabView (factory — not inline-renderable)',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — list items',
        items: [
            {
                id: 'comp-pw-list-item',
                label: 'PWListItem',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — info & result',
        items: [
            {
                id: 'comp-pw-info-view',
                label: 'PWInfoView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-result-view',
                label: 'PWResultView',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — dropdown',
        items: [
            {
                id: 'comp-pw-dropdown',
                label: 'PWDropdown',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Core — overlays & portals',
        items: [
            {
                id: 'comp-pw-overlay',
                label: 'PWOverlay (portal — may not display inline)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-loading-overlay',
                label: 'PWLoadingOverlay (portal — may not display inline)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-bottom-sheet',
                label: 'PWBottomSheet (portal — may not display inline)',
                launch: { kind: 'preview' },
            },
        ],
    },
]
