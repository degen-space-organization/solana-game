import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from "@/components/ui/provider.tsx"
import { WalletContextProvider } from './web3/provider.tsx'


// import { ChakraProvider } from '@chakra-ui/react'


import App from './App.tsx'

import './index.css'



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider defaultTheme='light' attribute='class'>
      <WalletContextProvider>
        <App />
      </WalletContextProvider>
    </Provider>
  </StrictMode>,
)
