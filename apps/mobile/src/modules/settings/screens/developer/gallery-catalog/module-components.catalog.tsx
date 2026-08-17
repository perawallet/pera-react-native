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
import { Decimal } from 'decimal.js'
import { makeStyles, useTheme } from '@rneui/themed'

import { PWView } from '@components/core'

import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { ConfettiAnimation } from '@modules/accounts/components/ConfettiAnimation'
import { NftEmptyState } from '@modules/accounts/components/NftEmptyState'
import { SelectableAccountCheckboxRow } from '@modules/accounts/components/SelectableAccountCheckboxRow'

import { AssetFavoriteButton } from '@modules/assets/components/AssetFavoriteButton'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { AssetNameBadge } from '@modules/assets/components/AssetNameBadge'
import { AssetNotificationButton } from '@modules/assets/components/AssetNotificationButton'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import { AssetSelection } from '@modules/assets/components/AssetSelection'
import { AssetTierChip } from '@modules/assets/components/AssetTierChip'
import { AssetTitle } from '@modules/assets/components/AssetTitle'
import { CollectibleGridItem as AssetsCollectibleGridItem } from '@modules/assets/components/CollectibleGridItem'
import { CollectibleListItem as AssetsCollectibleListItem } from '@modules/assets/components/CollectibleListItem'
import { CollectibleThumbnail as AssetsCollectibleThumbnail } from '@modules/assets/components/CollectibleThumbnail'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem'

import { TransactionDateHeader } from '@modules/transactions/components/TransactionDateHeader'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import { TransactionListItem } from '@modules/transactions/components/TransactionListItem'
import { TransactionStatusBadge } from '@modules/transactions/components/TransactionStatusBadge'

import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import { SwapProviderDisplay } from '@modules/swap/components/SwapProviderDisplay'
import { SwapProviderRow } from '@modules/swap/components/SwapProviderRow'
import { SwapQuoteDetails } from '@modules/swap/components/SwapQuoteDetails'

import { SourceMetadataBadge } from '@modules/signing/components/SourceMetadataBadge'
import { SourceMetadataView } from '@modules/signing/components/SourceMetadataView'

import { ParticipantListItem } from '@modules/multisig/components/ParticipantListItem'
import { SignerStatusListItem } from '@modules/multisig/components/SignerStatusListItem'
import { ThresholdStepper } from '@modules/multisig/components/ThresholdStepper'

import { StakingProjectCard } from '@modules/staking/components/StakingProjectCard'
import { StakingTypeBadge } from '@modules/staking/components/StakingTypeBadge'

import { InboxItem } from '@modules/messages/components/InboxItem'
import { UnreadIndicator } from '@modules/messages/components/UnreadIndicator'

import { LedgerCompositeIcon } from '@modules/ledger/components/LedgerCompositeIcon'
import { LedgerDeviceItem } from '@modules/ledger/components/LedgerDeviceItem'

import { BannerCard } from '@modules/banners/components/BannerCard'
import { BannerIcon } from '@modules/banners/components/BannerIcon'
import { CompactBanner } from '@modules/banners/components/CompactBanner'

import { AppVersion } from '@modules/settings/components/AppVersion'

import { PermissionItem } from '@modules/walletconnect/components/PermissionItem'

import { NumberedList } from '@components/NumberedList'
import { RekeySummaryRow } from '@modules/rekey/components/RekeySummaryRow'

import { PinEntry } from '@modules/security/components/PinEntry'

import { PinSecurityPrompt } from '@modules/prompts/components/PinSecurityPrompt/PinSecurityPrompt'

import { ProjectVerificationIcon } from '@modules/projects/components/ProjectVerificationIcon'

import { MnemonicSuggestionBar } from '@modules/onboarding/components/MnemonicSuggestionBar'

import { BackupQuizItem } from '@modules/backup/components/BackupQuizItem'

import { PWWebView } from '@modules/webview/components/PWWebView'

import {
    mockAlgo25Account,
    mockAsset,
    mockCollectible,
    mockTransaction,
    MOCK_ASSET_ID,
    MOCK_ADDRESS,
    mockAsaInbox,
} from '@perawallet/wallet-core-dev-fixtures'

import { registerPreview } from './registry'

import type { Banner } from '@perawallet/wallet-core-banners'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import type { StakingProject } from '@perawallet/wallet-core-staking'
import type { DexSwapAsset, SwapQuote } from '@perawallet/wallet-core-swaps'
import type { GallerySection } from './types'

const useThumbPreviewStyles = makeStyles(theme => ({
    thumb: { width: theme.spacing['4xl'], height: theme.spacing['4xl'] },
}))

const AssetsCollectibleThumbnailPreview = () => {
    const styles = useThumbPreviewStyles()
    return (
        <PWView>
            <AssetsCollectibleThumbnail
                thumbnailUrl='https://perawallet.app/static/nft-thumb.png'
                imageStyle={styles.thumb}
                placeholderStyle={styles.thumb}
                iconSize='md'
            />
            <AssetsCollectibleThumbnail
                thumbnailUrl={null}
                imageStyle={styles.thumb}
                placeholderStyle={styles.thumb}
                iconSize='md'
            />
        </PWView>
    )
}

registerPreview({
    id: 'comp-account-display',
    render: () => (
        <AccountDisplay
            account={mockAlgo25Account}
            showChevron={false}
        />
    ),
})

registerPreview({
    id: 'comp-account-icon',
    render: () => (
        <PWView>
            <AccountIcon
                account={mockAlgo25Account}
                size='md'
            />
            <AccountIcon
                account={mockAlgo25Account}
                size='lg'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-confetti-animation',
    render: () => (
        <ConfettiAnimation
            play={true}
            onFinish={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-nft-empty-state',
    render: () => <NftEmptyState onOptInPress={() => undefined} />,
})

registerPreview({
    id: 'comp-selectable-account-checkbox-row',
    render: () => (
        <PWView>
            <SelectableAccountCheckboxRow
                title={mockAlgo25Account.name ?? 'Mock Algo25 Account'}
                subtitle={mockAlgo25Account.address}
                isSelected={true}
                onToggle={() => undefined}
            />
            <SelectableAccountCheckboxRow
                title='Unselected Account'
                subtitle='ABCDE...FGHIJ'
                isSelected={false}
                onToggle={() => undefined}
                isImported={false}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-icon',
    render: () => (
        <PWView>
            <AssetIcon
                asset={mockAsset}
                size='sm'
            />
            <AssetIcon
                asset={mockAsset}
                size='md'
            />
            <AssetIcon
                asset={mockAsset}
                size='lg'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-name-badge',
    render: () => (
        <PWView>
            <AssetNameBadge
                name='USD Coin'
                verificationTier='verified'
                isFavorited={false}
                textVariant='h4'
            />
            <AssetNameBadge
                name='Suspicious Token'
                verificationTier='suspicious'
                isFavorited={true}
                textVariant='body'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-tier-chip',
    render: () => (
        <PWView>
            <AssetTierChip
                unitName='USDC'
                verificationTier='verified'
                size='sm'
            />
            <AssetTierChip
                unitName='USDC'
                verificationTier='verified'
                size='md'
            />
            <AssetTierChip
                unitName='ALGO'
                verificationTier='unverified'
                size='sm'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-title',
    render: () => (
        <AssetTitle
            asset={mockAsset}
            showId={true}
        />
    ),
})

registerPreview({
    id: 'comp-asset-favorite-button',
    render: () => (
        <PWView>
            <AssetFavoriteButton
                assetId={MOCK_ASSET_ID}
                isFavorite={false}
            />
            <AssetFavoriteButton
                assetId={MOCK_ASSET_ID}
                isFavorite={true}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-notification-button',
    render: () => (
        <PWView>
            <AssetNotificationButton
                assetId={MOCK_ASSET_ID}
                isNotificationsEnabled={false}
            />
            <AssetNotificationButton
                assetId={MOCK_ASSET_ID}
                isNotificationsEnabled={true}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-search-item',
    render: () => (
        <AssetSearchItem
            item={{
                assetId: MOCK_ASSET_ID,
                name: 'USD Coin',
                unitName: 'USDC',
                peraMetadata: {
                    logo: 'https://perawallet.app/static/usdc-logo.png',
                    verificationTier: 'verified',
                },
            }}
            isOptedIn={false}
            isOptingIn={false}
            onAdd={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-asset-selection',
    render: () => <AssetSelection asset={mockAsset} />,
})

registerPreview({
    id: 'comp-assets-collectible-grid-item',
    render: () => (
        <AssetsCollectibleGridItem
            item={{
                assetId: mockCollectible.assetId,
                asset: mockCollectible,
                amount: new Decimal('1'),
            }}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-assets-collectible-list-item',
    render: () => (
        <AssetsCollectibleListItem
            item={{
                assetId: mockCollectible.assetId,
                asset: mockCollectible,
                amount: new Decimal('2'),
            }}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-assets-collectible-thumbnail',
    render: () => <AssetsCollectibleThumbnailPreview />,
})

registerPreview({
    id: 'comp-account-asset-item-view',
    render: () => (
        <AccountAssetItemView
            accountBalance={{
                assetId: MOCK_ASSET_ID,
                asset: mockAsset,
                amount: new Decimal('1234.56'),
                algoValue: new Decimal('120.0'),
                isFrozen: false,
            }}
            usdPrice={new Decimal('1.00')}
            showBalance={true}
        />
    ),
})

registerPreview({
    id: 'comp-transaction-date-header',
    render: () => <TransactionDateHeader title='May 25, 2025' />,
})

registerPreview({
    id: 'comp-transaction-icon',
    render: () => (
        <PWView>
            <TransactionIcon
                type='payment'
                size='sm'
            />
            <TransactionIcon
                type='swap'
                size='md'
            />
            <TransactionIcon
                type='receive'
                size='lg'
            />
            <TransactionIcon
                type='asset-opt-in'
                size='sm'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-transaction-list-item',
    render: () => (
        <TransactionListItem
            transaction={mockTransaction}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-transaction-status-badge',
    render: () => (
        <PWView>
            <TransactionStatusBadge status='completed' />
            <TransactionStatusBadge status='pending' />
            <TransactionStatusBadge status='failed' />
        </PWView>
    ),
})

const mockDexAssetAlgo: DexSwapAsset = {
    assetId: '0',
    name: 'Algorand',
    unitName: 'ALGO',
    decimals: 6,
    verificationTier: 'verified',
}

const mockDexAssetUsdc: DexSwapAsset = {
    assetId: '31566704',
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
    verificationTier: 'verified',
}

const mockSwapQuote: SwapQuote = {
    provider: 'Tinyman',
    providerDisplayName: 'Tinyman',
    assetIn: mockDexAssetAlgo,
    assetOut: mockDexAssetUsdc,
    amountIn: new Decimal('5000000'),
    amountOut: new Decimal('4850000'),
    price: new Decimal('0.97'),
    priceImpact: new Decimal('0.01'),
    peraFeeAmount: new Decimal('50000'),
    slippage: new Decimal('0.005'),
}

const SwapAssetPairIconPreview = () => {
    const { theme } = useTheme()
    return (
        <SwapAssetPairIcon
            assetIn={mockDexAssetAlgo}
            assetOut={mockDexAssetUsdc}
            surfaceColor={theme.colors.background}
        />
    )
}

registerPreview({
    id: 'comp-swap-asset-pair-icon',
    render: () => <SwapAssetPairIconPreview />,
})

registerPreview({
    id: 'comp-swap-provider-display',
    render: () => (
        <SwapProviderDisplay
            providerName='Tinyman'
            providerDisplayName='Tinyman'
        />
    ),
})

registerPreview({
    id: 'comp-swap-provider-row',
    render: () => (
        <SwapProviderRow
            quote={mockSwapQuote}
            selectionMode='auto'
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-swap-quote-details',
    render: () => (
        <SwapQuoteDetails
            quote={mockSwapQuote}
            isLoading={false}
        />
    ),
})

const mockSignRequestSource: SignRequestSource = {
    name: 'Pera Demo DApp',
    description: 'A sample decentralized application',
    url: 'https://demo.perawallet.app',
    icons: ['https://demo.perawallet.app/icon.png'],
}

registerPreview({
    id: 'comp-source-metadata-badge',
    render: () => <SourceMetadataBadge metadata={mockSignRequestSource} />,
})

registerPreview({
    id: 'comp-source-metadata-view',
    render: () => <SourceMetadataView metadata={mockSignRequestSource} />,
})

registerPreview({
    id: 'comp-threshold-stepper',
    render: () => (
        <ThresholdStepper
            value={2}
            min={1}
            max={4}
            onIncrement={() => undefined}
            onDecrement={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-participant-list-item',
    render: () => (
        <ParticipantListItem
            participant={{ address: MOCK_ADDRESS, name: 'Alice' }}
            index={0}
            isInWallet={false}
            onEdit={() => undefined}
            onRemove={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-signer-status-list-item',
    render: () => (
        <SignerStatusListItem
            address={MOCK_ADDRESS}
            status='signed'
        />
    ),
})

const mockStakingProject: StakingProject = {
    id: 'mock-staking-project',
    title: 'Folks Finance',
    description: 'Liquid staking on Algorand',
    logoUrl: 'https://perawallet.app/static/folks-finance.png',
    link: 'https://folks.finance',
    type: 'liquid',
    tvlInAlgo: new Decimal('12500000'),
    tvlInUsd: new Decimal('3750000'),
}

registerPreview({
    id: 'comp-staking-type-badge',
    render: () => <StakingTypeBadge type='liquid' />,
})

registerPreview({
    id: 'comp-staking-project-card',
    render: () => (
        <StakingProjectCard
            project={mockStakingProject}
            isLast={false}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-inbox-item-asa',
    render: () => (
        <InboxItem
            item={{
                type: 'asa_inbox',
                data: mockAsaInbox,
                createdAt: new Date(),
            }}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-unread-indicator',
    render: () => (
        <PWView>
            <UnreadIndicator isUnread={true} />
            <UnreadIndicator isUnread={false} />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-ledger-composite-icon',
    render: () => <LedgerCompositeIcon testID='gallery-ledger-composite' />,
})

const mockLedgerDevice: HardwareWalletDevice = {
    id: 'mock-ledger-device',
    name: 'Ledger Nano X',
    manufacturer: 'ledger',
    transportType: 'ble',
    model: 'nanoX',
    rssi: -70,
}

registerPreview({
    id: 'comp-ledger-device-item',
    render: () => (
        <LedgerDeviceItem
            device={mockLedgerDevice}
            onPress={() => undefined}
        />
    ),
})

const mockBanner: Banner = {
    id: '1',
    type: 'governance',
    title: 'Algorand Governance',
    subtitle: 'Participate and earn rewards',
    buttonLabel: 'Learn more',
    buttonUrl: 'https://governance.algorand.foundation',
    isButtonUrlExternal: true,
    autoOpenMode: null,
    backgroundImageUrl: null,
}

registerPreview({
    id: 'comp-banner-icon',
    render: () => (
        <PWView>
            <BannerIcon
                type='generic'
                size='md'
            />
            <BannerIcon
                type='governance'
                size='md'
            />
            <BannerIcon
                type='staking'
                size='md'
            />
            <BannerIcon
                type='card'
                size='md'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-banner-card',
    render: () => (
        <BannerCard
            banner={mockBanner}
            onPressCTA={() => undefined}
            onDismiss={() => undefined}
            isDismissable={true}
        />
    ),
})

registerPreview({
    id: 'comp-compact-banner',
    render: () => (
        <CompactBanner
            primary={mockBanner}
            additionalCount={2}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-app-version',
    render: () => <AppVersion enableSecretTaps={false} />,
})

registerPreview({
    id: 'comp-permission-item',
    render: () => (
        <PWView>
            <PermissionItem permission='algo_signTxn' />
            <PermissionItem permission='algo_signData' />
            <PermissionItem permission='algo_getAccounts' />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-numbered-list',
    render: () => (
        <NumberedList
            items={[
                'Open your Algorand wallet application on your device.',
                'Navigate to Settings and select Rekey Account.',
                'Confirm the rekey by signing the transaction.',
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-rekey-summary-row',
    render: () => (
        <RekeySummaryRow
            account={mockAlgo25Account}
            ignoreRekey={false}
        />
    ),
})

registerPreview({
    id: 'comp-pin-entry',
    render: () => (
        <PinEntry
            title='Enter your PIN'
            onPinComplete={() => undefined}
            isDisabled={false}
            hasError={false}
        />
    ),
})

registerPreview({
    id: 'comp-pin-security-prompt',
    render: () => (
        <PinSecurityPrompt
            onDismiss={() => undefined}
            onHide={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-project-verification-icon',
    render: () => (
        <PWView>
            <ProjectVerificationIcon
                tier='verified'
                size='md'
            />
            <ProjectVerificationIcon
                tier='suspicious'
                size='md'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-mnemonic-suggestion-bar',
    render: () => (
        <MnemonicSuggestionBar
            suggestions={['abandon', 'ability', 'able', 'about']}
            onSelectSuggestion={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-backup-quiz-item',
    render: () => (
        <BackupQuizItem
            position={2}
            options={['abandon', 'ability', 'able']}
            selectedWord='able'
            onSelect={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-pw-webview',
    render: () => (
        <PWWebView
            url='https://perawallet.app'
            enablePeraConnect={false}
            showControls={false}
        />
    ),
})

export const getModuleComponentSections = (): GallerySection[] => [
    {
        title: 'Accounts (module)',
        items: [
            {
                id: 'comp-account-display',
                label: 'AccountDisplay',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-account-icon',
                label: 'AccountIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-account-info-card',
                label: 'AccountInfoCard (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-with-balance',
                label: 'AccountWithBalance (needs live balances query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-overview',
                label: 'AccountOverview (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-selection',
                label: 'AccountSelection (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-backup-reminder-banner',
                label: 'BackupReminderBanner (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-button-panel',
                label: 'ButtonPanel (needs navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-confetti-animation',
                label: 'ConfettiAnimation',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-nft-empty-state',
                label: 'NftEmptyState',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-no-funds-button-panel',
                label: 'NoFundsButtonPanel (needs navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-portfolio-view',
                label: 'PortfolioView (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-selectable-account-checkbox-row',
                label: 'SelectableAccountCheckboxRow',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-selectable-account-row',
                label: 'SelectableAccountRow (needs live balances query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-watch-account-button-panel',
                label: 'WatchAccountButtonPanel (needs navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-asset-list',
                label: 'AccountAssetList (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-history',
                label: 'AccountHistory (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-nfts',
                label: 'AccountNfts (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-menu',
                label: 'AccountMenu (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Assets (module)',
        items: [
            {
                id: 'comp-account-asset-selection-list',
                label: 'AccountAssetSelectionList (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-add-asset-view',
                label: 'AddAssetView (needs live query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-asset-favorite-button',
                label: 'AssetFavoriteButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-icon',
                label: 'AssetIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-account-asset-item-view',
                label: 'AccountAssetItemView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-name-badge',
                label: 'AssetNameBadge',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-notification-button',
                label: 'AssetNotificationButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-search-item',
                label: 'AssetSearchItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-selection',
                label: 'AssetSelection',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-tier-chip',
                label: 'AssetTierChip',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-title',
                label: 'AssetTitle',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-assets-collectible-grid-item',
                label: 'CollectibleGridItem (assets)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-assets-collectible-list-item',
                label: 'CollectibleListItem (assets)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-assets-collectible-thumbnail',
                label: 'CollectibleThumbnail (assets)',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Transactions (module)',
        items: [
            {
                id: 'comp-transaction-date-header',
                label: 'TransactionDateHeader',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-display',
                label: 'TransactionDisplay (needs live transaction data)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-transaction-icon',
                label: 'TransactionIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-list-item',
                label: 'TransactionListItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-status-badge',
                label: 'TransactionStatusBadge',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Swap (module)',
        items: [
            {
                id: 'comp-swap-amount-section',
                label: 'SwapAmountSection (needs live swap store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-asset-pair-icon',
                label: 'SwapAssetPairIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-asset-selector',
                label: 'AssetSelector (needs live assets query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-form',
                label: 'SwapForm (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-history-list',
                label: 'SwapHistoryList (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-pair-history-widget',
                label: 'SwapPairHistoryWidget (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-provider-display',
                label: 'SwapProviderDisplay',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-provider-row',
                label: 'SwapProviderRow',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-quote-details',
                label: 'SwapQuoteDetails',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-to-asset-selection-list',
                label: 'SwapToAssetSelectionList (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-top-pairs',
                label: 'SwapTopPairs (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Signing (module)',
        items: [
            {
                id: 'comp-arbitrary-data-signing-view',
                label: 'ArbitraryDataSigningView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-arc60-data-signing-view',
                label: 'Arc60DataSigningView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-fee-display',
                label: 'FeeDisplay (needs signing + navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-multiple-arbitrary-sign-request-view',
                label: 'MultipleArbitrarySignRequestView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-sign-request-view',
                label: 'SignRequestView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-signing-account-display',
                label: 'SigningAccountDisplay (needs live accounts store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-signing-action-buttons',
                label: 'SigningActionButtons (needs signing pipeline)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-signing-warnings',
                label: 'SigningWarnings (needs signing pipeline)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-single-arbitrary-sign-request-view',
                label: 'SingleArbitrarySignRequestView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-source-metadata-badge',
                label: 'SourceMetadataBadge',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-source-metadata-view',
                label: 'SourceMetadataView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-signing-view',
                label: 'TransactionSigningView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-transaction-summary-header',
                label: 'TransactionSummaryHeader (needs PeraDisplayableTransaction)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Multisig (module)',
        items: [
            {
                id: 'comp-multisig-decline-button',
                label: 'MultisigDeclineButton (needs signing store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-participant-list-item',
                label: 'ParticipantListItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-signer-status-list-item',
                label: 'SignerStatusListItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-threshold-stepper',
                label: 'ThresholdStepper',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Staking (module)',
        items: [
            {
                id: 'comp-staking-project-card',
                label: 'StakingProjectCard',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-staking-type-badge',
                label: 'StakingTypeBadge',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Messages (module)',
        items: [
            {
                id: 'comp-inbox-item-asa',
                label: 'InboxItem (asa_inbox)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-notification-item',
                label: 'NotificationItem (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-notifications-icon',
                label: 'NotificationsIcon (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-unread-indicator',
                label: 'UnreadIndicator',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Ledger (module)',
        items: [
            {
                id: 'comp-ledger-composite-icon',
                label: 'LedgerCompositeIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-ledger-device-item',
                label: 'LedgerDeviceItem',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Banners (module)',
        items: [
            {
                id: 'comp-banner-card',
                label: 'BannerCard',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-banner-carousel',
                label: 'BannerCarousel (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-banner-icon',
                label: 'BannerIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-compact-banner',
                label: 'CompactBanner',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-home-banners-strip',
                label: 'HomeBannersStrip (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-messages-spot-banners',
                label: 'MessagesSpotBanners (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-spot-banner-carousel',
                label: 'SpotBannerCarousel (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Settings (module)',
        items: [
            {
                id: 'comp-app-version',
                label: 'AppVersion',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-feature-flag-overrides',
                label: 'FeatureFlagOverrides (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-notification-settings-list',
                label: 'NotificationSettingsList (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-settings-walletconnect',
                label: 'WalletConnect (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'WalletConnect (module)',
        items: [
            {
                id: 'comp-permission-item',
                label: 'PermissionItem',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Rekey (module)',
        items: [
            {
                id: 'comp-numbered-list',
                label: 'NumberedList',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-rekey-summary-row',
                label: 'RekeySummaryRow',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Security (module)',
        items: [
            {
                id: 'comp-pin-entry',
                label: 'PinEntry',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pin-edit-view',
                label: 'PinEditView (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Prompts (module)',
        items: [
            {
                id: 'comp-pin-security-prompt',
                label: 'PinSecurityPrompt',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-prompt-container',
                label: 'PromptContainer (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Projects (module)',
        items: [
            {
                id: 'comp-application-display',
                label: 'ApplicationDisplay (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-project-verification-icon',
                label: 'ProjectVerificationIcon',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Onboarding (module)',
        items: [
            {
                id: 'comp-mnemonic-suggestion-bar',
                label: 'MnemonicSuggestionBar',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Misc (module)',
        items: [
            {
                id: 'comp-backup-quiz-item',
                label: 'BackupQuizItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-pw-webview',
                label: 'PWWebView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-webview-overlay',
                label: 'WebViewOverlay (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
]
