import { useState } from 'react'
import SolanaWeb3App from './components/WalletConnection'
import ChatExample from './components/Chat'
import './index.css'

function App() {

  return (
    <>
      <SolanaWeb3App></SolanaWeb3App> 
      <ChatExample></ChatExample>
    </>
  )
}

export default App
