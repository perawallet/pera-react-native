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

import React from 'react'
import { Decimal } from 'decimal.js'

import { PWText, PWView } from '@components/core'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { ContactAvatar } from '@components/ContactAvatar'
import { CopyableText } from '@components/CopyableText'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { CurrencyInput } from '@components/CurrencyInput'
import { EmptyView } from '@components/EmptyView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { ExpandableText } from '@components/ExpandableText'
import { InfoButton } from '@components/InfoButton'
import { KeyValueRow } from '@components/KeyValueRow'
import { LoadingView } from '@components/LoadingView'
import { MultisigInfoCard } from '@components/MultisigInfoCard'
import { NameAccountForm } from '@components/NameAccountForm'
import { NumberPad } from '@components/NumberPad'
import { PanelButton } from '@components/PanelButton'
import { ParticipantCount } from '@components/ParticipantCount'
import { RoundButton } from '@components/RoundButton'
import { ScreenHeader } from '@components/ScreenHeader'
import { SearchInput } from '@components/SearchInput'
import { TabLabel } from '@components/TabLabel'
import { TrendIndicator } from '@components/TrendIndicator'
import { ZoomableImage } from '@components/ZoomableImage'

import { registerPreview } from './registry'

import type { GallerySection } from './types'

// ─── Shared — display ─────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-contact-avatar',
    render: () => (
        <PWView>
            <ContactAvatar
                size='md'
                contact={{ name: 'Alice', address: 'AAAAA', image: undefined }}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-copyable-text',
    render: () => (
        <CopyableText copyValue='AAABBBCCC111222333'>
            <PWText variant='body'>Long press to copy this text</PWText>
        </CopyableText>
    ),
})

registerPreview({
    id: 'comp-currency-display',
    render: () => (
        <PWView>
            <CurrencyDisplay
                currency='USD'
                value={new Decimal('1234.56')}
                precision={2}
                variant='h2'
            />
            <CurrencyDisplay
                currency='ALGO'
                value={new Decimal('42.5')}
                precision={6}
                variant='body'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-trend-indicator',
    render: () => (
        <PWView>
            <TrendIndicator percentage={new Decimal('3.47')} />
            <TrendIndicator percentage={new Decimal('-1.23')} />
            <TrendIndicator
                percentage={new Decimal('5.0')}
                absolute={{
                    amount: new Decimal('12.34'),
                    currency: 'USD',
                    precision: 2,
                }}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-participant-count',
    render: () => (
        <PWView>
            <ParticipantCount count={3} />
            <ParticipantCount
                count={5}
                size='h1'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-tab-label',
    render: () => (
        <PWView>
            <TabLabel
                i18nKey='common.assets'
                active={true}
            />
            <TabLabel
                i18nKey='common.activity'
                active={false}
            />
        </PWView>
    ),
})

// ─── Shared — layout & panels ─────────────────────────────────────────────────

registerPreview({
    id: 'comp-expandable-panel',
    render: () => (
        <ExpandablePanel isExpanded={true}>
            <PWText variant='body'>
                This content is revealed when the panel is expanded. It can contain
                any child nodes.
            </PWText>
        </ExpandablePanel>
    ),
})

registerPreview({
    id: 'comp-expandable-text',
    render: () => (
        <ExpandableText
            text='Pera Wallet is a non-custodial Algorand wallet that gives you full control of your assets. It supports standard accounts, hardware wallets, multi-signature accounts, and rich NFT/collectible browsing. This is a longer description to trigger the "Show more" truncation behaviour.'
            limit={100}
        />
    ),
})

registerPreview({
    id: 'comp-key-value-row',
    render: () => (
        <PWView>
            <KeyValueRow title='Account type'>
                <PWText variant='bodyCompact'>Standard</PWText>
            </KeyValueRow>
            <KeyValueRow title='Network'>
                <PWText variant='bodyCompact'>Algorand MainNet</PWText>
            </KeyValueRow>
        </PWView>
    ),
})

// ─── Shared — empty & loading states ──────────────────────────────────────────

registerPreview({
    id: 'comp-empty-view',
    render: () => (
        <EmptyView
            icon='magnifying-glass'
            title='No results found'
            body='Try adjusting your search or filters to find what you are looking for.'
        />
    ),
})

registerPreview({
    id: 'comp-loading-view',
    render: () => (
        <PWView>
            <LoadingView
                variant='circle'
                size='lg'
            />
        </PWView>
    ),
})

// ─── Shared — inputs & number entry ───────────────────────────────────────────

registerPreview({
    id: 'comp-search-input',
    render: () => (
        <SearchInput
            placeholder='Search accounts, assets…'
            value=''
            onChangeText={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-number-pad',
    render: () => (
        <NumberPad
            onPress={() => undefined}
            allowDecimal={true}
        />
    ),
})

registerPreview({
    id: 'comp-currency-input',
    render: () => (
        <CurrencyInput
            minPrecision={2}
            maxPrecision={6}
            value=''
            onChangeText={() => undefined}
        />
    ),
})

// ─── Shared — chart & period ───────────────────────────────────────────────────

registerPreview({
    id: 'comp-chart-period-selection',
    render: () => (
        <ChartPeriodSelection
            value='one-week'
            onChange={() => undefined}
        />
    ),
})

// ─── Shared — buttons ─────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-round-button',
    render: () => (
        <PWView>
            <RoundButton
                icon='transactions/send'
                title='Send'
                onPress={() => undefined}
            />
            <RoundButton
                icon='transactions/receive'
                title='Receive'
                variant='primary'
                onPress={() => undefined}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-panel-button',
    render: () => (
        <PWView>
            <PanelButton
                leftIcon='wallet'
                rightIcon='chevron-right'
                title='Connect Hardware Wallet'
                description='Use a Ledger device to keep your keys offline'
                titleWeight='h3'
                onPress={() => undefined}
            />
            <PanelButton
                leftIcon='trash'
                title='Remove account'
                titleWeight='h4'
                variant='error'
                onPress={() => undefined}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-info-button',
    render: () => (
        <PWView>
            <InfoButton
                variant='secondary'
                size='sm'
                title='Account type'
            >
                <PWText variant='body'>
                    A standard account is controlled by a single private key stored
                    on this device.
                </PWText>
            </InfoButton>
        </PWView>
    ),
})

// ─── Shared — screen header ────────────────────────────────────────────────────

registerPreview({
    id: 'comp-screen-header',
    render: () => (
        <ScreenHeader
            icon='ledger'
            title='Select Ledger account'
            description='Choose which account you want to import from your Ledger device.'
        />
    ),
})

// ─── Shared — multisig ────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-multisig-info-card',
    render: () => (
        <MultisigInfoCard
            totalParticipants={3}
            threshold={2}
            isUserIncluded={true}
        />
    ),
})

// ─── Shared — forms ───────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-name-account-form',
    render: () => (
        <NameAccountForm
            title='Name your account'
            description='Give this account a nickname so you can easily find it later.'
            finishButtonTitle='Save'
            loadingTitle='Saving…'
            value='My Main Wallet'
            onChangeText={() => undefined}
            onFinish={() => undefined}
            isLoading={false}
        />
    ),
})

// ─── Shared — media ───────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-zoomable-image',
    render: () => (
        <ZoomableImage uri='https://via.placeholder.com/300' />
    ),
})

// ─── Sections ─────────────────────────────────────────────────────────────────

export const getSharedComponentSections = (): GallerySection[] => [
    {
        title: 'Shared — display',
        items: [
            { id: 'comp-contact-avatar', label: 'ContactAvatar', launch: { kind: 'preview' } },
            { id: 'comp-copyable-text', label: 'CopyableText', launch: { kind: 'preview' } },
            { id: 'comp-currency-display', label: 'CurrencyDisplay', launch: { kind: 'preview' } },
            { id: 'comp-trend-indicator', label: 'TrendIndicator', launch: { kind: 'preview' } },
            { id: 'comp-participant-count', label: 'ParticipantCount', launch: { kind: 'preview' } },
            { id: 'comp-tab-label', label: 'TabLabel', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — layout & panels',
        items: [
            { id: 'comp-expandable-panel', label: 'ExpandablePanel', launch: { kind: 'preview' } },
            { id: 'comp-expandable-text', label: 'ExpandableText', launch: { kind: 'preview' } },
            { id: 'comp-key-value-row', label: 'KeyValueRow', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — empty & loading states',
        items: [
            { id: 'comp-empty-view', label: 'EmptyView', launch: { kind: 'preview' } },
            { id: 'comp-loading-view', label: 'LoadingView', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — inputs & number entry',
        items: [
            { id: 'comp-search-input', label: 'SearchInput', launch: { kind: 'preview' } },
            { id: 'comp-number-pad', label: 'NumberPad', launch: { kind: 'preview' } },
            { id: 'comp-currency-input', label: 'CurrencyInput', launch: { kind: 'preview' } },
            { id: 'comp-chart-period-selection', label: 'ChartPeriodSelection', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — buttons',
        items: [
            { id: 'comp-round-button', label: 'RoundButton', launch: { kind: 'preview' } },
            { id: 'comp-panel-button', label: 'PanelButton', launch: { kind: 'preview' } },
            { id: 'comp-info-button', label: 'InfoButton', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — screen chrome',
        items: [
            { id: 'comp-screen-header', label: 'ScreenHeader', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — multisig',
        items: [
            { id: 'comp-multisig-info-card', label: 'MultisigInfoCard', launch: { kind: 'preview' } },
        ],
    },
    {
        title: 'Shared — forms',
        items: [
            { id: 'comp-name-account-form', label: 'NameAccountForm', launch: { kind: 'preview' } },
            { id: 'comp-contact-form', label: 'ContactForm (needs RHF control + QR)', launch: { kind: 'action', run: () => undefined } },
        ],
    },
    {
        title: 'Shared — media',
        items: [
            { id: 'comp-zoomable-image', label: 'ZoomableImage', launch: { kind: 'preview' } },
            { id: 'comp-audio-player', label: 'AudioPlayer (needs expo-audio)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-video-player', label: 'VideoPlayer (needs expo-video)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-media-carousel', label: 'MediaCarousel (needs expo-audio/video)', launch: { kind: 'action', run: () => undefined } },
        ],
    },
    {
        title: 'Shared — address & search',
        items: [
            { id: 'comp-address-display', label: 'AddressDisplay (needs live state)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-address-entry-field', label: 'AddressEntryField (needs live state)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-address-search-view', label: 'AddressSearchView (needs live state)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-searchable-list', label: 'SearchableList (needs live state)', launch: { kind: 'action', run: () => undefined } },
        ],
    },
    {
        title: 'Shared — wealth & account',
        items: [
            { id: 'comp-account-header-menu', label: 'AccountHeaderMenu (needs live state)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-preferred-currency-display', label: 'PreferredCurrencyDisplay (needs live state)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-wealth-chart', label: 'WealthChart (needs live query)', launch: { kind: 'action', run: () => undefined } },
            { id: 'comp-wealth-trend', label: 'WealthTrend (needs live query)', launch: { kind: 'action', run: () => undefined } },
        ],
    },
]
