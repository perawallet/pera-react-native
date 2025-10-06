import { Text } from '@rneui/themed';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

import ChevronRight from '../../../../assets/icons/chevron-right.svg';
import AssetIcon from '../asset-icon/AssetIcon';
import { AssetSerializerResponse } from '@perawallet/core';

export type AssetSelectionProps = {
  asset: AssetSerializerResponse;
};

const AssetSelection = ({ asset }: AssetSelectionProps) => {
  const styles = useStyles();

  return (
    <PeraView style={styles.container}>
      <AssetIcon asset={asset} style={styles.icon} />
      <Text h4Style={styles.text} h4>
        {asset.unit_name}
      </Text>
      <ChevronRight />
    </PeraView>
  );
};

export default AssetSelection;
