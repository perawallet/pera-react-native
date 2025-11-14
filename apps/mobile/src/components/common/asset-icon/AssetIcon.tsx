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

// TODO: is this the right way to do it?
import { PeraAsset } from '@perawallet/core';
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';
import VestAssetIcon from '../../../../assets/icons/assets/vest.svg';
import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';
import { Image } from '@rneui/themed';
import { useIsDarkMode } from '../../../hooks/theme';
import PWView from '../view/PWView';
import { useStyles } from './styles';

type LabelType = {
  dark_theme_logo: string;
  light_theme_logo: string;
};

export type AssetIconProps = {
  asset: PeraAsset;
  size?: number;
} & SvgProps;

const AssetIcon = (props: AssetIconProps) => {
  const { asset, size, style, ...rest } = props;
  const styles = useStyles(props);
  const isDarkMode = useIsDarkMode();

  const icon = useMemo(() => {
    if (!asset) return <></>;
    if (asset.unit_name === 'ALGO')
      return (
        <AlgoAssetIcon
          {...rest}
          style={styles.icon}
          width={size}
          height={size}
        />
      );
    if (asset.unit_name === 'USDC')
      return (
        <USDCAssetIcon
          {...rest}
          style={styles.icon}
          width={size}
          height={size}
        />
      );
    if (asset.unit_name === 'VEST')
      return (
        <VestAssetIcon
          {...rest}
          style={styles.icon}
          width={size}
          height={size}
        />
      );
    if (asset.logo)
      return (
        <Image
          source={{ uri: asset.logo }}
          style={styles.icon}
          width={size}
          height={size}
        />
      );
    if (asset.labels) {
      const labelLogo = isDarkMode
        ? asset.labels?.find((l: LabelType) => l.dark_theme_logo)
            ?.dark_theme_logo
        : asset.labels?.find((l: LabelType) => l.light_theme_logo)
            ?.light_theme_logo;
      if (labelLogo) {
        return (
          <Image
            source={{ uri: labelLogo }}
            style={styles.icon}
            width={size}
            height={size}
          />
        );
      }
    }
    return <AlgoAssetIcon {...rest} width={size} height={size} />; //TODO: fallback to web URL?  Have a generic icon?
  }, [asset, rest, isDarkMode, size, styles.icon]);

  return <PWView style={[style, styles.container]}>{icon}</PWView>;
};

export default AssetIcon;
