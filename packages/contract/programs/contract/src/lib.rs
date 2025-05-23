use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Game111111111111111111111111111111111111111");

#[program]
pub mod gaming_vault {
    use super::*;

    /// Initialize the contract configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_bps: u16,
        first_place_percentage: u8,
        second_place_percentage: u8,
        third_place_percentage: u8,
    ) -> Result<()> {
        require!(fee_bps <= 10000, GameError::InvalidFeeBps);
        require!(
            first_place_percentage + second_place_percentage + third_place_percentage == 100,
            GameError::InvalidPrizeDistribution
        );

        let config = &mut ctx.accounts.game_config;
        config.admin = ctx.accounts.admin.key();
        config.fee_receiver = ctx.accounts.fee_receiver.key();
        config.fee_bps = fee_bps;
        config.first_place_percentage = first_place_percentage;
        config.second_place_percentage = second_place_percentage;
        config.third_place_percentage = third_place_percentage;
        config.next_game_id = 1;
        config.bump = ctx.bumps.game_config;

        Ok(())
    }

    /// Create a new game
    pub fn create_game(
        ctx: Context<CreateGame>,
        game_type: GameType,
        tier: GameTier,
    ) -> Result<()> {
        let config = &mut ctx.accounts.game_config;
        let game = &mut ctx.accounts.game;

        let stake_amount = tier.to_lamports();
        let fee_amount = (stake_amount as u128 * config.fee_bps as u128 / 10000) as u64;
        let total_cost = stake_amount + fee_amount;

        // Validate player has enough funds
        require!(
            ctx.accounts.creator.lamports() >= total_cost,
            GameError::InsufficientFunds
        );

        // Initialize game
        game.id = config.next_game_id;
        game.creator = ctx.accounts.creator.key();
        game.game_type = game_type.clone();
        game.tier = tier.clone();
        game.stake_per_player = stake_amount;
        game.max_players = match game_type {
            GameType::OneVsOne => 2,
            GameType::Tournament { size } => size,
        };
        game.status = GameStatus::WaitingForPlayers;
        game.players = vec![PlayerStake {
            player: ctx.accounts.creator.key(),
            amount: stake_amount,
            joined_at: Clock::get()?.unix_timestamp,
        }];
        game.total_pot = stake_amount;
        game.created_at = Clock::get()?.unix_timestamp;
        game.bump = ctx.bumps.game;

        // Transfer stake and fee
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.fee_receiver.to_account_info(),
                },
            ),
            fee_amount,
        )?;

        // No need to update player state - backend handles this

        // Increment next game ID
        config.next_game_id += 1;

        emit!(GameCreated {
            game_id: game.id,
            creator: ctx.accounts.creator.key(),
            game_type: game_type,
            tier: tier,
            stake_amount,
        });

        Ok(())
    }

    /// Join an existing game
    pub fn join_game(ctx: Context<JoinGame>, game_id: u64) -> Result<()> {
        let config = &ctx.accounts.game_config;
        let game = &mut ctx.accounts.game;

        // Validate game state
        require!(game.id == game_id, GameError::InvalidGameId);
        require!(game.status == GameStatus::WaitingForPlayers, GameError::GameNotJoinable);
        require!(game.players.len() < game.max_players as usize, GameError::GameFull);

        // Check if player is already in this specific game
        require!(
            !game.players.iter().any(|p| p.player == ctx.accounts.player.key()),
            GameError::AlreadyInThisGame
        );

        // Backend handles all other eligibility checks (active games, eliminations, etc.)

        let stake_amount = game.stake_per_player;
        let fee_amount = (stake_amount as u128 * config.fee_bps as u128 / 10000) as u64;
        let total_cost = stake_amount + fee_amount;

        // Validate player has enough funds
        require!(
            ctx.accounts.player.lamports() >= total_cost,
            GameError::InsufficientFunds
        );

        // Add player to game
        game.players.push(PlayerStake {
            player: ctx.accounts.player.key(),
            amount: stake_amount,
            joined_at: Clock::get()?.unix_timestamp,
        });
        game.total_pot += stake_amount;

        // Transfer stake and fee
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.fee_receiver.to_account_info(),
                },
            ),
            fee_amount,
        )?;

        // No need to update player state - backend handles this

        // Auto-start game if full
        if game.players.len() == game.max_players as usize {
            game.status = GameStatus::Active;
            
            emit!(GameStarted {
                game_id: game.id,
                players: game.players.iter().map(|p| p.player).collect(),
            });
        }

        emit!(PlayerJoined {
            game_id: game.id,
            player: ctx.accounts.player.key(),
            players_count: game.players.len() as u8,
        });

        Ok(())
    }

    /// Admin function to withdraw a player before game starts
    pub fn admin_withdraw_player(
        ctx: Context<AdminWithdrawPlayer>,
        game_id: u64,
        player_pubkey: Pubkey,
        gas_fee: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.game_config;
        let game = &mut ctx.accounts.game;

        // Validate admin
        require!(ctx.accounts.admin.key() == config.admin, GameError::UnauthorizedAccess);
        require!(game.id == game_id, GameError::InvalidGameId);
        require!(game.status == GameStatus::WaitingForPlayers, GameError::GameAlreadyStarted);

        // Find and remove player
        let player_index = game.players
            .iter()
            .position(|p| p.player == player_pubkey)
            .ok_or(GameError::PlayerNotInGame)?;

        let player_stake = game.players.remove(player_index);
        game.total_pot -= player_stake.amount;

        // Calculate refund amount (stake minus gas fee)
        let refund_amount = player_stake.amount.saturating_sub(gas_fee);

        // Find player account in remaining accounts
        let player_account = ctx.remaining_accounts
            .iter()
            .find(|acc| acc.key() == player_pubkey)
            .ok_or(GameError::MissingPlayerAccount)?;

        // Transfer refund from vault
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
        **player_account.try_borrow_mut_lamports()? += refund_amount;

        // No need to update player state - backend handles eligibility

        emit!(PlayerWithdrawn {
            game_id: game.id,
            player: player_pubkey,
            refund_amount,
        });

        Ok(())
    }

    /// Admin function to cancel a game
    pub fn admin_cancel_game(
        ctx: Context<AdminCancelGame>,
        game_id: u64,
        gas_fee_per_player: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.game_config;
        let game = &mut ctx.accounts.game;

        // Validate admin
        require!(ctx.accounts.admin.key() == config.admin, GameError::UnauthorizedAccess);
        require!(game.id == game_id, GameError::InvalidGameId);
        require!(game.status != GameStatus::Cancelled, GameError::GameAlreadyCancelled);

        // Refund all players
        for (i, player_stake) in game.players.iter().enumerate() {
            let refund_amount = player_stake.amount.saturating_sub(gas_fee_per_player);
            
            let player_account = ctx.remaining_accounts
                .get(i) // Just player accounts, no player state accounts needed
                .ok_or(GameError::MissingPlayerAccount)?;

            // Transfer refund
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
            **player_account.try_borrow_mut_lamports()? += refund_amount;
        }

        // No need to update player states - backend handles eligibility

        game.status = GameStatus::Cancelled;

        emit!(GameCancelled {
            game_id: game.id,
            refunded_players: game.players.len() as u8,
        });

        Ok(())
    }

    /// Admin function to payout winners
    pub fn admin_payout_winners(
        ctx: Context<AdminPayoutWinners>,
        game_id: u64,
        winners: Vec<WinnerPayout>,
        gas_fee_per_winner: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.game_config;
        let game = &mut ctx.accounts.game;

        // Validate admin
        require!(ctx.accounts.admin.key() == config.admin, GameError::UnauthorizedAccess);
        require!(game.id == game_id, GameError::InvalidGameId);
        require!(game.status == GameStatus::Active, GameError::GameNotActive);

        let total_prize_pool = game.total_pot;

        // Validate and payout winners
        for (i, winner) in winners.iter().enumerate() {
            let prize_amount = match game.game_type {
                GameType::OneVsOne => total_prize_pool, // Winner takes all
                GameType::Tournament { .. } => {
                    match winner.place {
                        1 => (total_prize_pool as u128 * config.first_place_percentage as u128 / 100) as u64,
                        2 => (total_prize_pool as u128 * config.second_place_percentage as u128 / 100) as u64,
                        3 => (total_prize_pool as u128 * config.third_place_percentage as u128 / 100) as u64,
                        _ => return Err(GameError::InvalidPlace.into()),
                    }
                }
            };

            let payout_amount = prize_amount.saturating_sub(gas_fee_per_winner);

            let winner_account = ctx.remaining_accounts
                .get(i) // Just winner accounts, no player state accounts needed
                .ok_or(GameError::MissingWinnerAccount)?;

            // Transfer prize
            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= payout_amount;
            **winner_account.try_borrow_mut_lamports()? += payout_amount;
        }

        // No need to update player states - backend handles eligibility

        game.status = GameStatus::Completed;

        emit!(GameCompleted {
            game_id: game.id,
            winners: winners.clone(),
        });

        Ok(())
    }

    /// Admin emergency withdraw function
    pub fn admin_emergency_withdraw(
        ctx: Context<AdminEmergencyWithdraw>,
        recipient: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.game_config;

        // Validate admin
        require!(ctx.accounts.admin.key() == config.admin, GameError::UnauthorizedAccess);
        require!(ctx.accounts.vault.lamports() >= amount, GameError::InsufficientVaultBalance);

        let recipient_account = ctx.remaining_accounts
            .iter()
            .find(|acc| acc.key() == recipient)
            .ok_or(GameError::MissingRecipientAccount)?;

        // Transfer funds
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **recipient_account.try_borrow_mut_lamports()? += amount;

        emit!(EmergencyWithdraw {
            recipient,
            amount,
        });

        Ok(())
    }

    /// Update contract configuration (admin only)
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        first_place_percentage: Option<u8>,
        second_place_percentage: Option<u8>,
        third_place_percentage: Option<u8>,
        fee_receiver: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.game_config;

        // Validate admin
        require!(ctx.accounts.admin.key() == config.admin, GameError::UnauthorizedAccess);

        if let Some(fee) = fee_bps {
            require!(fee <= 10000, GameError::InvalidFeeBps);
            config.fee_bps = fee;
        }

        if let (Some(first), Some(second), Some(third)) = (first_place_percentage, second_place_percentage, third_place_percentage) {
            require!(first + second + third == 100, GameError::InvalidPrizeDistribution);
            config.first_place_percentage = first;
            config.second_place_percentage = second;
            config.third_place_percentage = third;
        }

        if let Some(receiver) = fee_receiver {
            config.fee_receiver = receiver;
        }

        Ok(())
    }
}

// Helper function removed - no longer needed since we don't track player states

// Account structs
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = GameConfig::SIZE,
        seeds = [b"game_config"],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: Fee receiver can be any account
    pub fee_receiver: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = creator,
        space = Game::SIZE,
        seeds = [b"game", game_config.next_game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(mut, seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
    
    #[account(mut)]
    /// CHECK: Fee receiver is validated in config
    pub fee_receiver: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
    
    #[account(mut)]
    /// CHECK: Fee receiver is validated in config
    pub fee_receiver: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct AdminWithdrawPlayer<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct AdminCancelGame<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct AdminPayoutWinners<'info> {
    #[account(
        mut,
        seeds = [b"game", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    
    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct AdminEmergencyWithdraw<'info> {
    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,
    
    pub admin: Signer<'info>,
}

// Data structures
#[account]
pub struct GameConfig {
    pub admin: Pubkey,
    pub fee_receiver: Pubkey,
    pub fee_bps: u16,
    pub first_place_percentage: u8,
    pub second_place_percentage: u8,
    pub third_place_percentage: u8,
    pub next_game_id: u64,
    pub bump: u8,
}

impl GameConfig {
    pub const SIZE: usize = 8 + 32 + 32 + 2 + 1 + 1 + 1 + 8 + 1;
}

#[account]
pub struct Game {
    pub id: u64,
    pub creator: Pubkey,
    pub game_type: GameType,
    pub tier: GameTier,
    pub stake_per_player: u64,
    pub max_players: u8,
    pub status: GameStatus,
    pub players: Vec<PlayerStake>,
    pub total_pot: u64,
    pub created_at: i64,
    pub bump: u8,
}

// impl Game {
//     pub const SIZE: usize = 8 + 8 + 32 + (1 + 1) + 1 + 8 + 1 + 1 + (4 + 16 * (32 + 8 + 8)) + 8 + 8 + 1;
// }


impl Game {
    pub const SIZE: usize = 8 + 8 + 32 + 2 + 1 + 8 + 1 + 1 + (4 + 16 * (32 + 8 + 8)) + 8 + 8 + 1 + 500; 
}

// PlayerState struct removed - backend handles all player eligibility

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlayerStake {
    pub player: Pubkey,
    pub amount: u64,
    pub joined_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GameType {
    OneVsOne,
    Tournament { size: u8 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GameTier {
    PointOne,
    PointTwoFive,
    PointFive,
    One,
}

impl GameTier {
    pub fn to_lamports(&self) -> u64 {
        match self {
            GameTier::PointOne => 100_000_000,      // 0.1 SOL
            GameTier::PointTwoFive => 250_000_000,  // 0.25 SOL
            GameTier::PointFive => 500_000_000,     // 0.5 SOL
            GameTier::One => 1_000_000_000,         // 1.0 SOL
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GameStatus {
    WaitingForPlayers,
    Active,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WinnerPayout {
    pub player: Pubkey,
    pub place: u8,
}

// Events
#[event]
pub struct GameCreated {
    pub game_id: u64,
    pub creator: Pubkey,
    pub game_type: GameType,
    pub tier: GameTier,
    pub stake_amount: u64,
}

#[event]
pub struct PlayerJoined {
    pub game_id: u64,
    pub player: Pubkey,
    pub players_count: u8,
}

#[event]
pub struct GameStarted {
    pub game_id: u64,
    pub players: Vec<Pubkey>,
}

#[event]
pub struct PlayerWithdrawn {
    pub game_id: u64,
    pub player: Pubkey,
    pub refund_amount: u64,
}

#[event]
pub struct GameCancelled {
    pub game_id: u64,
    pub refunded_players: u8,
}

#[event]
pub struct GameCompleted {
    pub game_id: u64,
    pub winners: Vec<WinnerPayout>,
}

#[event]
pub struct EmergencyWithdraw {
    pub recipient: Pubkey,
    pub amount: u64,
}

// Error codes
#[error_code]
pub enum GameError {
    #[msg("Invalid fee basis points")]
    InvalidFeeBps,
    #[msg("Invalid prize distribution - must sum to 100%")]
    InvalidPrizeDistribution,
    #[msg("Already joined this game")]
    AlreadyInThisGame,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid game ID")]
    InvalidGameId,
    #[msg("Game is not joinable")]
    GameNotJoinable,
    #[msg("Game is full")]
    GameFull,
    #[msg("Game already started")]
    GameAlreadyStarted,
    #[msg("Game already cancelled")]
    GameAlreadyCancelled,
    #[msg("Game is not active")]
    GameNotActive,
    #[msg("Player not in game")]
    PlayerNotInGame,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Missing player account")]
    MissingPlayerAccount,
    #[msg("Missing winner account")]
    MissingWinnerAccount,
    #[msg("Missing recipient account")]
    MissingRecipientAccount,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Invalid winner place")]
    InvalidPlace,
}