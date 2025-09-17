import MainScreenLayout from '../../layouts/MainScreenLayout';
import PeraView from '../../components/view/PeraView';
import { Text } from '@rneui/themed';

const DiscoverScreen = () => {
  return (
    <MainScreenLayout>
      <PeraView>
        <Text>This will be the discover screen</Text>
      </PeraView>
    </MainScreenLayout>
  );
};

export default DiscoverScreen;
