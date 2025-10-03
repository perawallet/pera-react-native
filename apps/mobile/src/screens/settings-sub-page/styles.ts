import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles((theme) => {
  return {
    container: {
      flex: 1,
      flexDirection: 'column',
      gap: theme.spacing.xl
    }
  };
});
