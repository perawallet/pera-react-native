import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles((theme, dimensions: number) => {
  return {
    container: {
      width: dimensions,
      height: dimensions,
      borderRadius: dimensions,
      overflow: 'hidden',
      backgroundColor: theme.colors.layerGrayLighter,
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});
