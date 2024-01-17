import { ThemeOptions, createTheme } from "@mui/material/styles";
import { createContext } from "react";

export const ColorModeContext = createContext({
  toggleColorMode: () => {},
});

const initTheme: (mode: "dark" | "light") => ThemeOptions = (mode) => ({
  spacing: 4,
  // @ts-ignore
  shadows: [...Array(25).fill("none")],
  palette: {
    mode,
  },
  typography: {
    fontFamily: "Consolas",
    fontSize: 12,
    body1: {},
  },
  components: {
    MuiButton: {
      defaultProps: {
        size: "small",
      },
    },
    MuiFilledInput: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiFormControl: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiFormHelperText: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: "small",
      },
    },
    MuiInputBase: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiInputLabel: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiListItem: {
      defaultProps: {
        dense: true,
      },
    },
    MuiOutlinedInput: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiFab: {
      defaultProps: {
        size: "small",
      },
    },
    MuiMenuList: {
      defaultProps: {
        dense: true,
      },
    },
    MuiMenuItem: {
      defaultProps: {
        dense: true,
      },
    },
    MuiTable: {
      defaultProps: {
        size: "small",
      },
    },
    MuiTab: {
      defaultProps: {},
    },
    MuiTextField: {
      defaultProps: {
        margin: "dense",
      },
    },
    MuiToolbar: {
      defaultProps: {
        variant: "dense",
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#6b6b6b #2b2b2b",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            width: "9px",
            height: "12px",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 0,
            backgroundColor: "#bdbdbd",
            minHeight: 12,
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
        },
      },
    },
  },
});

export const lightTheme = createTheme(initTheme("light"), {
  palette: {
    mode: "light",
    divider: "#ebecf0",
    background: {
      default: "#f7f8fa",
    },
    text: {
      primary: "#1e1e1e",
      secondary: "#1e1e1e",
    },
    action: {
      disabled: "#b2b2b2",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#6b6b6b #2b2b2b",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#f7f8fa",
            width: "0.6em",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 0,
            minHeight: 12,
            backgroundColor: "#d2d3d4",
          },
          "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
            backgroundColor: "#f7f8fa",
          },
        },
      },
    },
  },
} as ThemeOptions);

export const darkTheme = createTheme(initTheme("dark"), {
  palette: {
    mode: "dark",
    background: {
      default: "#2b2d30", // "#181818",
    },
    text: {
      primary: "#ced0d6",
      secondary: "#ced0d6",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: "#6b6b6b #2b2b2b",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#2b2d30",
            width: "0.6em",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 0,
            minHeight: 12,
            backgroundColor: "#4d4e51",
          },
          "&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner": {
            backgroundColor: "#2b2b2b",
          },
        },
      },
    },
  },
});
