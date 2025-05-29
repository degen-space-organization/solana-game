import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "@/components/ui/provider.tsx"
import { WalletContextProvider } from './web3/provider.tsx'

import { ChakraProvider } from '@chakra-ui/react'

// import { ChakraProvider } from '@chakra-ui/react'


import App from './App.tsx'

import { BrowserRouter } from 'react-router-dom'
import { neobrutalistSystem } from './theme/neobrutalism.ts'



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* <Provider defaultTheme='light' attribute='class'> */}
      <ChakraProvider value={neobrutalistSystem}> 
        <WalletContextProvider>
          <App />
        </WalletContextProvider>
      </ChakraProvider>
      {/* </Provider> */}
    </BrowserRouter>
  </StrictMode>,
)
