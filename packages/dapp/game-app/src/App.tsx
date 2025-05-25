import { useState } from 'react'
import SolanaWeb3App from './components/WalletConnection'
import ChatExample from './components/Chat'
import './index.css'


import { Button, HStack } from "@chakra-ui/react"



function App() {

  return (
    <>
      <HStack>
        <Button>Click me</Button>
        <Button>Click me</Button>
      </HStack>
      <SolanaWeb3App></SolanaWeb3App>
      <ChatExample></ChatExample>
    </>
  )
}

export default App
