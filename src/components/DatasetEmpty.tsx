import { Box, BoxProps } from '@mui/material';
import { styled } from '@mui/material/styles';

export const DatasetEmpty = styled((props) => <Box {...props} />)<BoxProps>(
  () => ({
    display: 'flex',
    marginTop: '20%',
    height: '100%',
    justifyContent: 'center',
  }),
);
