import { useState } from 'react'
import ChatExample from './components/Chat'
import './index.css'

import { Avatar, Button, Card } from "@chakra-ui/react"
import SolanaWeb3App from './components/WalletConnection'


const Demo = () => {
  return (
    <Card.Root width="320px">
      <Card.Body gap="2">
        <Avatar.Root size="lg" shape="rounded">
          <Avatar.Image src="https://picsum.photos/200/300" />
          <Avatar.Fallback name="Nue Camp" />
        </Avatar.Root>
        <Card.Title mt="2">Nue Camp</Card.Title>
        <Card.Description>
          This is the card body. Lorem ipsum dolor sit amet, consectetur
          adipiscing elit. Curabitur nec odio vel dui euismod fermentum.
          Curabitur nec odio vel dui euismod fermentum.
        </Card.Description>
      </Card.Body>
      <Card.Footer justifyContent="flex-end">
        <Button variant="outline">View</Button>
        <Button>Join</Button>
      </Card.Footer>
    </Card.Root>
  )
}


function App() {

  return (
    <>
      {/* <Demo /> */}
      {/* <Button>Click me</Button> */}
      {/* <Button>Click me</Button> */}
      <SolanaWeb3App/>
      {/* <SolanaWeb3App></SolanaWeb3App> */}
      {/* <ChatExample></ChatExample> */}
    </>
  )
}

export default App
