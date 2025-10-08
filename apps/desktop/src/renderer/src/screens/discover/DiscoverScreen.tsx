import DiscoverHeader from '../../components/discover/DiscoverHeader';
import DiscoverCards from '../../components/discover/DiscoverCards';
import DiscoverFeatured from '../../components/discover/DiscoverFeatured';
import { DiscoverScreenContainer } from './DiscoverScreen.styles';

const DiscoverScreen = () => {
  return (
    <DiscoverScreenContainer>
      <DiscoverHeader />
      <DiscoverCards />
      <DiscoverFeatured />
    </DiscoverScreenContainer>
  );
};

export default DiscoverScreen;
