const express = require('express');
const { Connection, PublicKey } = require('@solana/web3.js');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());

const connection = new Connection('https://api.mainnet-beta.solana.com');

app.get('/get-balance/:pubkey', async (req, res) => {
  try {
    const publicKey = new PublicKey(req.params.pubkey);
    const balance = await connection.getBalance(publicKey);
    console.log(publicKey)
    console.log(balance)
    res.json({ balance: balance / 1e9 }); // SOL
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.listen(port, () => {
  console.log(`Solana backend server listening at http://localhost:${port}`);
});
