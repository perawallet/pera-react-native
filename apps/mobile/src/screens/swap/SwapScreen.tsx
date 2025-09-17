import { Text } from '@rneui/themed';
import PeraView from '../../components/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';

const SwapScreen = () => {
  return (
    <MainScreenLayout>
      <PeraView>
        <Text>This will be the swap screen</Text>
      </PeraView>
    </MainScreenLayout>
  );
};

export default SwapScreen;
