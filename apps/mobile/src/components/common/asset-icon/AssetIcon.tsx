// TODO: is this the right way to do it?
import { AssetSerializerResponse } from '@perawallet/core';
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';
import VestAssetIcon from '../../../../assets/icons/assets/vest.svg';
import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';
import { Image } from '@rneui/themed';
import { useIsDarkMode } from '../../../hooks/theme';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

export type AssetIconProps = {
  asset: AssetSerializerResponse;
  size?: number
} & SvgProps;

const AssetIcon = (props: AssetIconProps) => {
  const { asset, size, style, ...rest } = props
  const styles = useStyles(props)
  const isDarkMode = useIsDarkMode()


  const icon = useMemo(() => {
    if (!asset) return <></>
    if (asset.unit_name === 'ALGO') return <AlgoAssetIcon {...rest} style={styles.icon} width={size} height={size} />;
    if (asset.unit_name === 'USDC') return <USDCAssetIcon {...rest} style={styles.icon} width={size} height={size} />;
    if (asset.unit_name === 'VEST') return <VestAssetIcon {...rest} style={styles.icon} width={size} height={size} />;
    if (asset.logo) return <Image source={{uri: asset.logo}} style={styles.icon} width={size} height={size} />
    if (asset.labels) {
      const labelLogo =  isDarkMode ?
          asset.labels?.find(l => l.dark_theme_logo)?.dark_theme_logo : asset.labels?.find(l => l.light_theme_logo)?.light_theme_logo
      if (labelLogo) {
        return <Image source={{uri: labelLogo}} style={styles.icon} width={size} height={size}/>
      }
    }
    return <AlgoAssetIcon {...rest} width={size} height={size} />; //TODO: fallback to web URL?  Have a generic icon?
  }, [asset, rest]);

  return <PeraView style={style}>{icon}</PeraView>;
};

export default AssetIcon;
