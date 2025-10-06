import { useStyles } from './styles';
import PeraView from '../../common/view/PeraView';
import { ViewStyle } from 'react-native';
import { Text } from '@rneui/themed';
import AssetIcon from '../../common/asset-icon/AssetIcon';
import { AssetDetailSerializerResponse } from '@perawallet/core';

type SwapPairItemProps = {
  fromAsset: AssetDetailSerializerResponse;
  toAsset: AssetDetailSerializerResponse;
  style: ViewStyle;
};

const SwapPair = (props: SwapPairItemProps) => {
  const themeStyle = useStyles();

  return (
    <PeraView style={props.style}>
      <PeraView style={themeStyle.itemIconContainer}>
        <AssetIcon asset={props.fromAsset} style={themeStyle.fromIcon} />
        <AssetIcon asset={props.toAsset} style={themeStyle.toIcon} />
      </PeraView>
      <Text h4>
        {props.fromAsset?.unit_name} to {props.toAsset?.unit_name}
      </Text>
    </PeraView>
  );
};
export default SwapPair;
