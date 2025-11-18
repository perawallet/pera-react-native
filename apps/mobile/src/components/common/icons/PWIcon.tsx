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

import { SvgProps } from 'react-native-svg';
import { useTheme } from '@rneui/themed';

import AlgoIcon from '../../../../assets/icons/algo.svg';
import AppLogo from '../../../../assets/icons/app_logo.svg';
import ArrowUpIcon from '../../../../assets/icons/arrow-up.svg';
import ArrowDownIcon from '../../../../assets/icons/arrow-down.svg';
import BellIcon from '../../../../assets/icons/bell.svg';
import BellWithBadgeIcon from '../../../../assets/icons/bell-with-badge.svg';
import BuyIcon from '../../../../assets/icons/buy.svg';
import CameraIcon from '../../../../assets/icons/camera.svg';
import CardIcon from '../../../../assets/icons/card.svg';
import CardStackIcon from '../../../../assets/icons/card-stack.svg';
import ChevronDownIcon from '../../../../assets/icons/chevron-down.svg';
import ChevronLeftIcon from '../../../../assets/icons/chevron-left.svg';
import ChevronRightIcon from '../../../../assets/icons/chevron-right.svg';
import CopyIcon from '../../../../assets/icons/copy.svg';
import CrossIcon from '../../../../assets/icons/cross.svg';
import DeleteIcon from '../../../../assets/icons/delete.svg';
import DollarIcon from '../../../../assets/icons/dollar.svg';
import DotStackIcon from '../../../../assets/icons/dot-stack.svg';
import EditPenIcon from '../../../../assets/icons/edit-pen.svg';
import EllipsisIcon from '../../../../assets/icons/ellipsis.svg';
import EnvelopeLetterIcon from '../../../../assets/icons/envelope-letter.svg';
import EyeInCircleIcon from '../../../../assets/icons/eye-in-circle.svg';
import GearIcon from '../../../../assets/icons/gear.svg';
import GlobeIcon from '../../../../assets/icons/globe.svg';
import HorizontalLineStackIcon from '../../../../assets/icons/horizontal-line-stack.svg';
import HouseIcon from '../../../../assets/icons/house.svg';
import InflowIcon from '../../../../assets/icons/inflow.svg';
import InfoIcon from '../../../../assets/icons/info.svg';
import KeyIcon from '../../../../assets/icons/key.svg';
import LedgerInCircleIcon from '../../../../assets/icons/ledger-in-circle.svg';
import ListArrowDownIcon from '../../../../assets/icons/list-arrow-down.svg';
import MagnifyingGlassIcon from '../../../../assets/icons/magnifying-glass.svg';
import MoonIcon from '../../../../assets/icons/moon.svg';
import OutflowIcon from '../../../../assets/icons/outflow.svg';
import PersonMenuIcon from '../../../../assets/icons/person-menu.svg';
import PersonIcon from '../../../../assets/icons/person.svg';
import PlusWithBorderIcon from '../../../../assets/icons/plus-with-border.svg';
import PlusIcon from '../../../../assets/icons/plus.svg';
import SlidersIcon from '../../../../assets/icons/sliders.svg';
import SwapIcon from '../../../../assets/icons/swap.svg';
import SwitchIcon from '../../../../assets/icons/switch.svg';
import WalletInCircleIcon from '../../../../assets/icons/wallet-in-circle.svg';
import WalletWithAlgoIcon from '../../../../assets/icons/wallet-with-algo.svg';
import WalletIcon from '../../../../assets/icons/wallet.svg';
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import SuspiciousAssetIcon from '../../../../assets/icons/assets/suspicious.svg';
import TrustedAssetIcon from '../../../../assets/icons/assets/trusted.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';
import VerifiedAssetIcon from '../../../../assets/icons/assets/verified.svg';
import VestAssetIcon from '../../../../assets/icons/assets/vest.svg';
import GroupIcon from '../../../../assets/icons/transactions/group.svg';
import PaymentIcon from '../../../../assets/icons/transactions/payment.svg';

const ICON_LIBRARY = {
  algo: AlgoIcon,
  app_logo: AppLogo,
  'arrow-up': ArrowUpIcon,
  'arrow-down': ArrowDownIcon,
  bell: BellIcon,
  'bell-with-badge': BellWithBadgeIcon,
  buy: BuyIcon,
  camera: CameraIcon,
  card: CardIcon,
  'card-stack': CardStackIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  copy: CopyIcon,
  cross: CrossIcon,
  delete: DeleteIcon,
  dollar: DollarIcon,
  'dot-stack': DotStackIcon,
  'edit-pen': EditPenIcon,
  ellipsis: EllipsisIcon,
  'envelope-letter': EnvelopeLetterIcon,
  'eye-in-circle': EyeInCircleIcon,
  gear: GearIcon,
  globe: GlobeIcon,
  'horizontal-line-stack': HorizontalLineStackIcon,
  house: HouseIcon,
  inflow: InflowIcon,
  info: InfoIcon,
  key: KeyIcon,
  'ledger-in-circle': LedgerInCircleIcon,
  'list-arrow-down': ListArrowDownIcon,
  'magnifying-glass': MagnifyingGlassIcon,
  moon: MoonIcon,
  outflow: OutflowIcon,
  'person-menu': PersonMenuIcon,
  person: PersonIcon,
  'plus-with-border': PlusWithBorderIcon,
  plus: PlusIcon,
  sliders: SlidersIcon,
  swap: SwapIcon,
  switch: SwitchIcon,
  'wallet-in-circle': WalletInCircleIcon,
  'wallet-with-algo': WalletWithAlgoIcon,
  wallet: WalletIcon,
  'assets/algo': AlgoAssetIcon,
  'assets/suspicious': SuspiciousAssetIcon,
  'assets/trusted': TrustedAssetIcon,
  'assets/usdc': USDCAssetIcon,
  'assets/verified': VerifiedAssetIcon,
  'assets/vest': VestAssetIcon,
  'transactions/group': GroupIcon,
  'transactions/payment': PaymentIcon,
} as const;

export type IconName = keyof typeof ICON_LIBRARY;

export type PWIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type PWIconVariant =
  | 'primary'
  | 'secondary'
  | 'helper'
  | 'white'
  | 'link'
  | "error";

export type PWIconProps = {
  name: IconName;
  size?: PWIconSize;
  variant?: PWIconVariant;
} & Omit<SvgProps, 'color' | 'width' | 'height'>;

const PWIcon = ({
  name,
  size = 'md',
  variant = 'primary',
  ...rest
}: PWIconProps) => {
  const { theme } = useTheme();
  const IconComponent = ICON_LIBRARY[name];

  const sizeMap: Record<PWIconSize, number> = {
    xs: theme.spacing.md,
    sm: theme.spacing.lg,
    md: theme.spacing.xl,
    lg: theme.spacing.xl * 2,
    xl: theme.spacing.xl * 3
  };

  const variantColors: Record<PWIconVariant, string> = {
    primary: theme.colors.textMain,
    secondary: theme.colors.textGray,
    helper: theme.colors.buttonSquareText,
    white: theme.colors.textWhite,
    link: theme.colors.linkPrimary,
    error: theme.colors.error
  };

  if (!IconComponent) return null;

  const resolvedSize = sizeMap[size] ?? theme.spacing.xl;
  const resolvedColor = variantColors[variant];

  return (
    <IconComponent
      {...rest}
      width={resolvedSize}
      height={resolvedSize}
      color={resolvedColor}
    />
  );
};

export default PWIcon;
