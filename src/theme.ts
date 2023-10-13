import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  // @ts-ignore
  shadows: [...Array(25).fill("none")],
  palette: {
    mode: "light",
    // mode: "dark",
  },
  typography: {
    fontFamily: "Consolas",
    fontSize: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#6b6b6b #2b2b2b",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            // backgroundColor: "#2b2b2b",
            backgroundColor: "#fcfcfc",
            width: "0.6em",
            height: "0.6em",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 0,
            // backgroundColor: "#6b6b6b",
            backgroundColor: "#bdbdbd",
            minHeight: 12,
            // border: "2px solid #2b2b2b",
          },
          "&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus":
            {
              backgroundColor: "#959595",
            },
          "&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active":
            {
              backgroundColor: "#959595",
            },
          "&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover":
            {
              backgroundColor: "#959595",
            },
          "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
            backgroundColor: "#2b2b2b",
          },
        },
      },
    },
  },
});

export default theme;
