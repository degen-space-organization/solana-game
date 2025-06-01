// src/components/ui/provider.tsx
"use client"

import { ChakraProvider } from "@chakra-ui/react"
import { neobrutalistSystem } from "@/theme/neobrutalism"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"

import { Toaster } from "./toaster";


export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={neobrutalistSystem}>
      <ColorModeProvider {...props} />
      <Toaster />
    </ChakraProvider>
  )
}