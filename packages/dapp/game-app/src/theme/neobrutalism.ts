// src/theme/neobrutalism.ts
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
    // Neobrutalism color palette with violet as primary
    violet: {
      50: { value: "#f5f3ff" },
      100: { value: "#ede9fe" },
      200: { value: "#ddd6fe" },
      300: { value: "#c4b5fd" },
      400: { value: "#a78bfa" },
      500: { value: "#8b5cf6" }, // Primary violet
      600: { value: "#7c3aed" },
      700: { value: "#6d28d9" },
      800: { value: "#5b21b6" },
      900: { value: "#4c1d95" },
    },
    // Brutalist supporting colors
    brutalist: {
      black: { value: "#000000" },
      white: { value: "#ffffff" },
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
      // Accent colors for variety
      orange: { value: "#ff6b35" },
      green: { value: "#06d6a0" },
      blue: { value: "#118ab2" },
      red: { value: "#ef4444" },
      yellow: { value: "#fbbf24" },
    },
  },
  shadows: {
    // Neobrutalism signatures: bold, offset shadows
    brutalist: {
      sm: { value: "2px 2px 0px #000000" },
      md: { value: "4px 4px 0px #000000" },
      lg: { value: "6px 6px 0px #000000" },
      xl: { value: "8px 8px 0px #000000" },
      "2xl": { value: "12px 12px 0px #000000" },
      "3xl": { value: "16px 16px 0px #000000" },
    },
    // Colored shadows for special elements
    violet: { value: "4px 4px 0px #8b5cf6" },
    orange: { value: "4px 4px 0px #ff6b35" },
    green: { value: "4px 4px 0px #06d6a0" },
    blue: { value: "4px 4px 0px #118ab2" },
  },
  borders: {
    // All borders should be bold and black
    brutalist: { value: "3px solid #000000" },
    thick: { value: "4px solid #000000" },
    thicker: { value: "5px solid #000000" },
  },
  radii: {
    // Neobrutalism = no rounded corners, but we need to override defaults
    none: { value: "0px" },
    sm: { value: "0px" },
    md: { value: "0px" },
    lg: { value: "0px" },
    xl: { value: "0px" },
    full: { value: "0px" },
  },
  spacing: {
    // Additional spacing tokens
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

// Define semantic tokens for consistent theming
const semanticTokens = defineSemanticTokens({
  colors: {
    // Primary brand colors
    primary: {
      solid: { value: "{colors.violet.500}" },
      contrast: { value: "{colors.brutalist.white}" },
      subtle: { value: "{colors.violet.100}" },
      muted: { value: "{colors.violet.300}" },
    },
    // Background system
    bg: {
      canvas: { value: "{colors.brutalist.white}" },
      default: { value: "{colors.brutalist.white}" },
      subtle: { value: "{colors.brutalist.gray.50}" },
      muted: { value: "{colors.brutalist.gray.100}" },
      emphasized: { value: "{colors.brutalist.black}" },
    },
    // Foreground/text system
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
    // Status colors
    success: { value: "{colors.brutalist.green}" },
    warning: { value: "{colors.brutalist.yellow}" },
    error: { value: "{colors.brutalist.red}" },
    info: { value: "{colors.brutalist.blue}" },
  },
})

// Define button recipe with correct syntax
const buttonRecipe = defineRecipe({
  base: {
    fontFamily: "body",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    border: "{borders.brutalist}",
    borderRadius: "none",
    transition: "all 0.1s ease",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    _hover: {
      transform: "translate(-2px, -2px)",
    },
    _active: {
      transform: "translate(0px, 0px)",
    },
  },
  variants: {
    variant: {
      primary: {
        bg: "{colors.violet.500}",
        color: "{colors.brutalist.white}",
        boxShadow: "{shadows.brutalist.md}",
        _hover: {
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
      secondary: {
        bg: "{colors.brutalist.white}",
        color: "{colors.brutalist.black}",
        boxShadow: "{shadows.brutalist.md}",
        _hover: {
          bg: "{colors.brutalist.gray.50}",
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
      accent: {
        bg: "{colors.brutalist.orange}",
        color: "{colors.brutalist.white}",
        boxShadow: "{shadows.orange}",
        _hover: {
          boxShadow: "{shadows.brutalist.lg}",
        },
        _active: {
          boxShadow: "{shadows.brutalist.sm}",
        },
      },
      destructive: {
        bg: "{colors.brutalist.red}",
        color: "{colors.brutalist.white}",
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
      sm: {
        px: "4",
        py: "2",
        fontSize: "sm",
      },
      md: {
        px: "6",
        py: "3",
        fontSize: "md",
      },
      lg: {
        px: "8",
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

// Define input recipe
const inputRecipe = defineRecipe({
  base: {
    fontFamily: "body",
    border: "{borders.brutalist}",
    borderRadius: "none",
    bg: "{colors.brutalist.white}",
    color: "{colors.brutalist.black}",
    _focus: {
      outline: "none",
      borderColor: "{colors.violet.500}",
      boxShadow: "{shadows.violet}",
    },
    _placeholder: {
      color: "{colors.brutalist.gray.500}",
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

// Define the main theme configuration with correct structure
const config = defineConfig({
  // Global CSS at root level
  globalCss: {
    "*": {
      boxSizing: "border-box",
    },
    body: {
      fontFamily: "{fonts.body}",
      color: "{colors.brutalist.black}",
      bg: "{colors.brutalist.white}",
      lineHeight: "1.6",
      // Custom cursor
      cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="16" height="16" x="2" y="2" fill="none" stroke="%23000" stroke-width="2"/><rect width="6" height="6" x="7" y="7" fill="%23000"/></svg>'), auto`,
    },
    // Grid background pattern
    "body::before": {
      content: '""',
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
      `,
      backgroundSize: "24px 24px",
      pointerEvents: "none",
      zIndex: -1,
      opacity: 0.8,
    },
    // Interactive elements get pointer cursor
    "button, [role='button'], input[type='submit'], input[type='button']": {
      cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="16" height="16" x="2" y="2" fill="none" stroke="%238b5cf6" stroke-width="2"/><rect width="6" height="6" x="7" y="7" fill="%238b5cf6"/></svg>'), pointer`,
    },
    // Links
    "a, [role='link']": {
      cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="16" height="16" x="2" y="2" fill="none" stroke="%23118ab2" stroke-width="2"/><rect width="6" height="6" x="7" y="7" fill="%23118ab2"/></svg>'), pointer`,
    },
  },
  // Theme configuration
  theme: {
    tokens,
    semanticTokens,
    // Component recipes
    recipes: {
      button: buttonRecipe,
      input: inputRecipe,
    },
  },
})

// Create and export the system
export const neobrutalistSystem = createSystem(defaultConfig, config)

// Export individual theme parts for customization
export { tokens, semanticTokens, config, buttonRecipe, inputRecipe }