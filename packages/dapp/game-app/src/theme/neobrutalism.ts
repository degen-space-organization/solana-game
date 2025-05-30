
import { 
  createSystem, 
  defaultConfig,
  defineConfig, 
  defineTokens, 
  defineSemanticTokens,
  defineRecipe 
} from "@chakra-ui/react"

// Define design tokens
const tokens = defineTokens({
  fonts: {
    heading: { value: `'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif` },
    body: { value: `'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif` },
  },
  fontSizes: {
    xs: { value: "0.75rem" },
    sm: { value: "0.875rem" },
    md: { value: "1rem" },
    lg: { value: "1.125rem" },
    xl: { value: "1.25rem" },
    "2xl": { value: "1.5rem" },
    "3xl": { value: "1.875rem" },
    "4xl": { value: "2.25rem" },
    "5xl": { value: "3rem" },
  },
  fontWeights: {
    normal: { value: "400" },
    medium: { value: "500" },
    semibold: { value: "600" },
    bold: { value: "700" },
    extrabold: { value: "800" },
    black: { value: "900" },
  },
  colors: {
    // Muted violet palette for better readability with black text
    violet: {
      50: { value: "#faf8ff" },
      100: { value: "#f3f0ff" },
      200: { value: "#e9e5ff" },
      300: { value: "#d4c7ff" }, // Lighter/muted primary
      400: { value: "#b794f6" },
      500: { value: "#9f7aea" }, // Muted primary violet
      600: { value: "#805ad5" },
      700: { value: "#6b46c1" },
      800: { value: "#553c9a" },
      900: { value: "#44337a" },
    },
    // Neobrutalism accent colors
    brutalist: {
      black: { value: "#000000" },
      white: { value: "#ffffff" },
      orange: { value: "#FF8A5B" }, // Slightly muted
      green: { value: "#2DD4BF" }, // Slightly muted  
      blue: { value: "#3B82F6" }, // Slightly muted
      purple: { value: "#A855F7" }, // Slightly muted
      red: { value: "#EF4444" },
      yellow: { value: "#F59E0B" },
      gray: {
        50: { value: "#f9fafb" },
        100: { value: "#f3f4f6" },
        200: { value: "#e5e7eb" },
        300: { value: "#d1d5db" },
        400: { value: "#9ca3af" },
        500: { value: "#6b7280" },
        600: { value: "#4b5563" },
        700: { value: "#374151" },
        800: { value: "#1f2937" },
        900: { value: "#111827" },
      },
    },
  },
  shadows: {
    brutalist: {
      sm: { value: "1px 1px 0px #000000" },
      md: { value: "2px 2px 0px #000000" },
      lg: { value: "3px 3px 0px #000000" },
      xl: { value: "4px 4px 0px #000000" },
      "2xl": { value: "6px 6px 0px #000000" },
    },
    // Colored shadows (muted)
    violet: { value: "2px 2px 0px #9f7aea" },
    orange: { value: "2px 2px 0px #FF8A5B" },
    green: { value: "2px 2px 0px #2DD4BF" },
    blue: { value: "2px 2px 0px #3B82F6" },
  },
  borders: {
    brutalist: { value: "2px solid #000000" },
    thick: { value: "3px solid #000000" },
    thicker: { value: "4px solid #000000" },
  },
  radii: {
    none: { value: "0px" },
    sm: { value: "2px" }, // Slightly rounded
    md: { value: "4px" },
    lg: { value: "6px" },
    xl: { value: "8px" },
    full: { value: "9999px" },
  },
  spacing: {
    xs: { value: "0.5rem" },
    sm: { value: "0.75rem" },
    md: { value: "1rem" },
    lg: { value: "1.5rem" },
    xl: { value: "2rem" },
    "2xl": { value: "2.5rem" },
    "3xl": { value: "3rem" },
    "4xl": { value: "4rem" },
  },
})

// Semantic tokens for easy component usage
const semanticTokens = defineSemanticTokens({
  colors: {
    // Primary system - muted violet with black text
    primary: {
      solid: { value: "{colors.violet.300}" }, // Lighter for black text
      muted: { value: "{colors.violet.200}" },
      subtle: { value: "{colors.violet.100}" },
      emphasis: { value: "{colors.violet.500}" },
    },
    // Background system
    bg: {
      canvas: { value: "{colors.brutalist.white}" },
      default: { value: "{colors.brutalist.white}" },
      subtle: { value: "{colors.brutalist.gray.50}" },
      muted: { value: "{colors.brutalist.gray.100}" },
      emphasized: { value: "{colors.brutalist.black}" },
    },
    // Foreground/text system - black text throughout
    fg: {
      default: { value: "{colors.brutalist.black}" },
      muted: { value: "{colors.brutalist.gray.600}" },
      subtle: { value: "{colors.brutalist.gray.500}" },
      inverted: { value: "{colors.brutalist.white}" },
    },
    // Border system
    border: {
      default: { value: "{colors.brutalist.black}" },
      subtle: { value: "{colors.brutalist.gray.300}" },
      muted: { value: "{colors.brutalist.gray.200}" },
    },
    // Status colors (muted)
    success: { value: "{colors.brutalist.green}" },
    warning: { value: "{colors.brutalist.yellow}" },
    error: { value: "{colors.brutalist.red}" },
    info: { value: "{colors.brutalist.blue}" },
  },
})

// Button recipe with neobrutalism style
const buttonRecipe = defineRecipe({
  base: {
    fontFamily: "body",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    border: "{borders.brutalist}",
    borderRadius: "md", // Slightly rounded
    transition: "all 0.1s ease",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    _hover: {
      transform: "translate(-1px, -1px)",
    },
    _active: {
      transform: "translate(0px, 0px)",
    },
  },
  variants: {
    variant: {
      primary: {
        bg: "primary.solid",
        color: "fg.default", // Black text
        boxShadow: "{shadows.brutalist.md}",
        _hover: {
          bg: "primary.muted",
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
      secondary: {
        bg: "bg.default",
        color: "fg.default",
        boxShadow: "{shadows.brutalist.md}",
        _hover: {
          bg: "bg.subtle",
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
      accent: {
        bg: "brutalist.orange",
        color: "fg.default", // Black text
        boxShadow: "{shadows.orange}",
        _hover: {
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
      destructive: {
        bg: "error",
        color: "fg.inverted", // White text for red background
        boxShadow: "{shadows.brutalist.md}",
        _hover: {
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
    },
    size: {
      xs: {
        px: "2",
        py: "1",
        fontSize: "xs",
      },
      sm: {
        px: "3",
        py: "2",
        fontSize: "sm",
      },
      md: {
        px: "4",
        py: "3",
        fontSize: "md",
      },
      lg: {
        px: "6",
        py: "4",
        fontSize: "lg",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
})

const inputRecipe = defineRecipe({
  base: {
    fontFamily: "body",
    border: "{borders.brutalist}",
    borderRadius: "sm",
    bg: "bg.default",
    color: "fg.default",
    _focus: {
      outline: "none",
      borderColor: "primary.emphasis",
      boxShadow: "{shadows.violet}",
    },
    _placeholder: {
      color: "fg.subtle",
    },
  },
  variants: {
    size: {
      sm: {
        px: "3",
        py: "2",
        fontSize: "sm",
      },
      md: {
        px: "4",
        py: "3",
        fontSize: "md",
      },
      lg: {
        px: "6",
        py: "4",
        fontSize: "lg",
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
})


// Configuration
const config = defineConfig({
  globalCss: {
    "*": {
      boxSizing: "border-box",
    },
    body: {
      fontFamily: "{fonts.body}",
      color: "fg.default",
      // bg: "bg.canvas",
      lineHeight: "1.6",
      margin: 0,
      padding: 0,
    },
    // Subtle grid background
    "body::before": {
      bg: 'violet.100',
      content: '""',
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
      `,
      backgroundSize: "32px 32px",
      pointerEvents: "none",
      zIndex: -1,
      opacity: 0.6,
    },
  },
  theme: {
    tokens,
    semanticTokens,
    recipes: {
      button: buttonRecipe,
      input: inputRecipe,
    },
  },
})

export const neobrutalistSystem = createSystem(defaultConfig, config)
// #endregion