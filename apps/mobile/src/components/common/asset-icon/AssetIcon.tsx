
// TODO: is this the right way to do it?
import AlgoAssetIcon from '../../../../assets/icons/assets/algo.svg';
import USDCAssetIcon from '../../../../assets/icons/assets/usdc.svg';
import VestAssetIcon from '../../../../assets/icons/assets/vest.svg';
import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';

type AssetIconProps = {
  asset: string
} & SvgProps

const AssetIcon = ({ asset, ...rest }: AssetIconProps) => {
  const icon = useMemo(() => {
    if (asset === 'ALGO') return <AlgoAssetIcon {...rest} />
    if (asset === 'USDC') return <USDCAssetIcon {...rest} /> 
    if (asset === 'VEST') return <VestAssetIcon {...rest} /> 
    return <AlgoAssetIcon />  //TODO: fallback to web URL?  Have a generic icon?
  }, [asset, rest])

  return (
    <>{icon}</>
  );
};

export default AssetIcon;
