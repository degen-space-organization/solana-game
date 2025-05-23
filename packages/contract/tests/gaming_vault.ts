import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GamingVault } from "../target/types/gaming_vault";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("gaming_vault", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.GamingVault as Program<GamingVault>;
  const provider = anchor.getProvider();

  // Test accounts
  let adminKeypair: Keypair;
  let feeReceiverKeypair: Keypair;
  let player1Keypair: Keypair;
  let player2Keypair: Keypair;
  let player3Keypair: Keypair;
  let player4Keypair: Keypair;

  // PDAs
  let gameConfigPda: PublicKey;
  let vaultPda: PublicKey;

  // Game PDAs - will be set dynamically
  let game1Pda: PublicKey;
  let game2Pda: PublicKey;
  let game3Pda: PublicKey;

  before(async () => {
    // Create test keypairs
    adminKeypair = Keypair.generate();
    feeReceiverKeypair = Keypair.generate();
    player1Keypair = Keypair.generate();
    player2Keypair = Keypair.generate();
    player3Keypair = Keypair.generate();
    player4Keypair = Keypair.generate();

    // Airdrop SOL to test accounts
    const accounts = [
      adminKeypair.publicKey,
      player1Keypair.publicKey,
      player2Keypair.publicKey,
      player3Keypair.publicKey,
      player4Keypair.publicKey,
    ];

    for (const account of accounts) {
      await provider.connection.requestAirdrop(account, 100 * LAMPORTS_PER_SOL); // Increased to 100 SOL
    }

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find PDAs
    [gameConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_config")],
      program.programId
    );

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    console.log("Game config PDA:", gameConfigPda.toString());
    console.log("Vault PDA:", vaultPda.toString());
  });

  describe("Contract Initialization", () => {
    it("Initialize contract configuration", async () => {
      const tx = await program.methods
        .initialize(
          50, // 0.5% fee (50 basis points)
          50, // 50% first place
          30, // 30% second place
          20  // 20% third place
        )
        .accounts({
          gameConfig: gameConfigPda,
          admin: adminKeypair.publicKey,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([adminKeypair])
        .rpc();

      console.log("✅ Initialize transaction:", tx);

      // Verify configuration
      const config = await program.account.gameConfig.fetch(gameConfigPda);
      expect(config.admin.toString()).to.equal(adminKeypair.publicKey.toString());
      expect(config.feeReceiver.toString()).to.equal(feeReceiverKeypair.publicKey.toString());
      expect(config.feeBps).to.equal(50);
      expect(config.firstPlacePercentage).to.equal(50);
      expect(config.secondPlacePercentage).to.equal(30);
      expect(config.thirdPlacePercentage).to.equal(20);
      expect(config.nextGameId.toString()).to.equal("1");
    });
  });

  describe("Game Creation", () => {
    it("Create a 1v1 game (0.1 SOL tier)", async () => {
      // Get current next_game_id to derive correct PDA
      const config = await program.account.gameConfig.fetch(gameConfigPda);
      const gameId = config.nextGameId;

      [game1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), gameId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      console.log("Creating game with ID:", gameId.toString());
      console.log("Game1 PDA:", game1Pda.toString());

      const player1BalanceBefore = await provider.connection.getBalance(player1Keypair.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
      const feeReceiverBalanceBefore = await provider.connection.getBalance(feeReceiverKeypair.publicKey);

      const tx = await program.methods
        .createGame(
          { oneVsOne: {} },
          { pointOne: {} }
        )
        .accounts({
          game: game1Pda,
          gameConfig: gameConfigPda,
          creator: player1Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player1Keypair])
        .rpc();

      console.log("✅ Created 1v1 game:", tx);

      // Verify game state
      const game = await program.account.game.fetch(game1Pda);
      expect(game.id.toString()).to.equal(gameId.toString());
      expect(game.creator.toString()).to.equal(player1Keypair.publicKey.toString());
      expect(game.maxPlayers).to.equal(2);
      expect(game.stakePerPlayer.toString()).to.equal((0.1 * LAMPORTS_PER_SOL).toString());
      expect(game.players).to.have.length(1);
      expect(game.status).to.deep.equal({ waitingForPlayers: {} });

      // Verify balance changes
      const player1BalanceAfter = await provider.connection.getBalance(player1Keypair.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
      const feeReceiverBalanceAfter = await provider.connection.getBalance(feeReceiverKeypair.publicKey);

      const stakeAmount = 0.1 * LAMPORTS_PER_SOL;
      const feeAmount = Math.floor(stakeAmount * 50 / 10000);
      
      expect(player1BalanceBefore - player1BalanceAfter).to.be.greaterThan(stakeAmount + feeAmount);
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(stakeAmount);
      expect(feeReceiverBalanceAfter - feeReceiverBalanceBefore).to.equal(feeAmount);
    });

    it("Create a tournament game (0.5 SOL tier)", async () => {
      // Get current next_game_id after previous game creation
      const config = await program.account.gameConfig.fetch(gameConfigPda);
      const gameId = config.nextGameId;

      [game2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), gameId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      console.log("Creating tournament with ID:", gameId.toString());
      console.log("Game2 PDA:", game2Pda.toString());

      const tx = await program.methods
        .createGame(
          { tournament: { size: 4 } },
          { pointFive: {} }
        )
        .accounts({
          game: game2Pda,
          gameConfig: gameConfigPda,
          creator: player2Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player2Keypair])
        .rpc();

      console.log("✅ Created tournament game:", tx);

      // Verify game state
      const game = await program.account.game.fetch(game2Pda);
      expect(game.id.toString()).to.equal(gameId.toString());
      expect(game.creator.toString()).to.equal(player2Keypair.publicKey.toString());
      expect(game.maxPlayers).to.equal(4);
      expect(game.stakePerPlayer.toString()).to.equal((0.5 * LAMPORTS_PER_SOL).toString());
      expect(game.players).to.have.length(1);
      expect(game.status).to.deep.equal({ waitingForPlayers: {} });
    });
  });

  describe("Joining Games", () => {
    it("Join 1v1 game and trigger auto-start", async () => {
      // Get the actual game ID from the game state
      const game1 = await program.account.game.fetch(game1Pda);
      const gameId = game1.id;

      console.log("Joining game with ID:", gameId.toString());

      const tx = await program.methods
        .joinGame(gameId)
        .accounts({
          game: game1Pda,
          gameConfig: gameConfigPda,
          player: player2Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player2Keypair])
        .rpc();

      console.log("✅ Joined 1v1 game:", tx);

      // Verify game auto-started
      const game = await program.account.game.fetch(game1Pda);
      expect(game.players).to.have.length(2);
      expect(game.players[1].player.toString()).to.equal(player2Keypair.publicKey.toString());
      expect(game.status).to.deep.equal({ active: {} });
      expect(game.totalPot.toString()).to.equal((0.2 * LAMPORTS_PER_SOL).toString());
    });

    it("Join tournament game (partial fill)", async () => {
      // Get the actual game ID from the game state
      const game2 = await program.account.game.fetch(game2Pda);
      const gameId = game2.id;

      // Player 1 joins tournament
      await program.methods
        .joinGame(gameId)
        .accounts({
          game: game2Pda,
          gameConfig: gameConfigPda,
          player: player1Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player1Keypair])
        .rpc();

      // Verify game NOT started yet (2/4 players)
      let game = await program.account.game.fetch(game2Pda);
      expect(game.players).to.have.length(2);
      expect(game.status).to.deep.equal({ waitingForPlayers: {} });

      // Player 3 joins
      await program.methods
        .joinGame(gameId)
        .accounts({
          game: game2Pda,
          gameConfig: gameConfigPda,
          player: player3Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player3Keypair])
        .rpc();

      // Still not started (3/4 players)
      game = await program.account.game.fetch(game2Pda);
      expect(game.players).to.have.length(3);
      expect(game.status).to.deep.equal({ waitingForPlayers: {} });

      console.log("✅ Tournament partially filled (3/4 players)");
    });

    it("Complete tournament and auto-start", async () => {
      // Get the actual game ID from the game state
      const game2 = await program.account.game.fetch(game2Pda);
      const gameId = game2.id;

      // Player 4 joins to complete the tournament
      const tx = await program.methods
        .joinGame(gameId)
        .accounts({
          game: game2Pda,
          gameConfig: gameConfigPda,
          player: player4Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player4Keypair])
        .rpc();

      console.log("✅ Tournament completed and started:", tx);

      // Verify tournament auto-started
      const game = await program.account.game.fetch(game2Pda);
      expect(game.players).to.have.length(4);
      expect(game.status).to.deep.equal({ active: {} });
      expect(game.totalPot.toString()).to.equal((2.0 * LAMPORTS_PER_SOL).toString());
    });

    it("Cannot join the same game twice", async () => {
      // Try to join tournament again with player1 (who already joined)
      const game2 = await program.account.game.fetch(game2Pda);
      const gameId = game2.id;

      try {
        await program.methods
          .joinGame(gameId)
          .accounts({
            game: game2Pda,
            gameConfig: gameConfigPda,
            player: player1Keypair.publicKey, // Already in this game
            vault: vaultPda,
            feeReceiver: feeReceiverKeypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([player1Keypair])
          .rpc();
        
        expect.fail("Should have failed with AlreadyInThisGame");
      } catch (error) {
        expect(error.toString()).to.include("AlreadyInThisGame");
        console.log("✅ Correctly prevented duplicate join");
      }
    });
  });

  describe("Admin Functions", () => {
    it("Create game for admin tests", async () => {
      // Create a game for admin function testing
      const config = await program.account.gameConfig.fetch(gameConfigPda);
      const gameId = config.nextGameId;

      [game3Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game"), gameId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      console.log("Creating admin test game with ID:", gameId.toString());
      console.log("Game3 PDA:", game3Pda.toString());

      await program.methods
        .createGame(
          { oneVsOne: {} },
          { pointOne: {} }
        )
        .accounts({
          game: game3Pda,
          gameConfig: gameConfigPda,
          creator: player3Keypair.publicKey,
          vault: vaultPda,
          feeReceiver: feeReceiverKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([player3Keypair])
        .rpc();

      console.log("✅ Created game for admin tests");
    });

    it("Admin can withdraw player before game starts", async () => {
      // Get the actual game ID from the game state
      const game3 = await program.account.game.fetch(game3Pda);
      const gameId = game3.id;

      const player3BalanceBefore = await provider.connection.getBalance(player3Keypair.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

      const gasFee = 5000;
      const tx = await program.methods
        .adminWithdrawPlayer(
          gameId,
          player3Keypair.publicKey,
          new anchor.BN(gasFee)
        )
        .accounts({
          game: game3Pda,
          gameConfig: gameConfigPda,
          admin: adminKeypair.publicKey,
          vault: vaultPda,
        })
        .remainingAccounts([
          {
            pubkey: player3Keypair.publicKey,
            isWritable: true,
            isSigner: false,
          }
        ])
        .signers([adminKeypair])
        .rpc();

      console.log("✅ Admin withdrew player:", tx);

      // Verify game state
      const game = await program.account.game.fetch(game3Pda);
      expect(game.players).to.have.length(0);
      expect(game.totalPot.toString()).to.equal("0");

      // Verify balance changes
      const player3BalanceAfter = await provider.connection.getBalance(player3Keypair.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

      const stakeAmount = 0.1 * LAMPORTS_PER_SOL;
      const refundAmount = stakeAmount - gasFee;

      expect(player3BalanceAfter - player3BalanceBefore).to.equal(refundAmount);
      expect(vaultBalanceBefore - vaultBalanceAfter).to.equal(refundAmount);
    });

    it("Admin can payout winners (1v1 game)", async () => {
      // Get the actual game ID from the game state
      const game1 = await program.account.game.fetch(game1Pda);
      const gameId = game1.id;

      const winnerBalanceBefore = await provider.connection.getBalance(player1Keypair.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

      const gasFeePerWinner = 5000;
      const winners = [
        { player: player1Keypair.publicKey, place: 1 }
      ];

      const tx = await program.methods
        .adminPayoutWinners(
          gameId,
          winners,
          new anchor.BN(gasFeePerWinner)
        )
        .accounts({
          game: game1Pda,
          gameConfig: gameConfigPda,
          admin: adminKeypair.publicKey,
          vault: vaultPda,
        })
        .remainingAccounts([
          {
            pubkey: player1Keypair.publicKey,
            isWritable: true,
            isSigner: false,
          }
        ])
        .signers([adminKeypair])
        .rpc();

      console.log("✅ Admin paid out 1v1 winner:", tx);

      // Verify game completion
      const game = await program.account.game.fetch(game1Pda);
      expect(game.status).to.deep.equal({ completed: {} });

      // Verify payout
      const winnerBalanceAfter = await provider.connection.getBalance(player1Keypair.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

      const totalPot = 0.2 * LAMPORTS_PER_SOL;
      const payout = totalPot - gasFeePerWinner;

      expect(winnerBalanceAfter - winnerBalanceBefore).to.equal(payout);
      expect(vaultBalanceBefore - vaultBalanceAfter).to.equal(payout);
    });

    it("Non-admin cannot call admin functions", async () => {
      // Get the actual game ID from the game state
      const game2 = await program.account.game.fetch(game2Pda);
      const gameId = game2.id;

      try {
        await program.methods
          .adminWithdrawPlayer(
            gameId,
            player1Keypair.publicKey,
            new anchor.BN(5000)
          )
          .accounts({
            game: game2Pda,
            gameConfig: gameConfigPda,
            admin: player1Keypair.publicKey, // Non-admin
            vault: vaultPda,
          })
          .remainingAccounts([
            {
              pubkey: player1Keypair.publicKey,
              isWritable: true,
              isSigner: false,
            }
          ])
          .signers([player1Keypair])
          .rpc();
        
        expect.fail("Should have failed with UnauthorizedAccess");
      } catch (error) {
        expect(error.toString()).to.include("UnauthorizedAccess");
        console.log("✅ Correctly rejected non-admin access");
      }
    });
  });

  describe("Configuration Updates", () => {
    it("Admin can update contract configuration", async () => {
      const tx = await program.methods
        .updateConfig(
          100, // Change fee to 1%
          null, null, null, null
        )
        .accounts({
          gameConfig: gameConfigPda,
          admin: adminKeypair.publicKey,
        })
        .signers([adminKeypair])
        .rpc();

      console.log("✅ Updated config:", tx);

      // Verify configuration update
      const config = await program.account.gameConfig.fetch(gameConfigPda);
      expect(config.feeBps).to.equal(100);
      expect(config.firstPlacePercentage).to.equal(50); // Unchanged
    });

    it("Non-admin cannot update configuration", async () => {
      try {
        await program.methods
          .updateConfig(200, null, null, null, null)
          .accounts({
            gameConfig: gameConfigPda,
            admin: player1Keypair.publicKey, // Non-admin
          })
          .signers([player1Keypair])
          .rpc();
        
        expect.fail("Should have failed with UnauthorizedAccess");
      } catch (error) {
        expect(error.toString()).to.include("UnauthorizedAccess");
        console.log("✅ Correctly rejected non-admin config update");
      }
    });
  });
});