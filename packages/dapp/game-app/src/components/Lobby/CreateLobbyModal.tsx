// packages/dapp/game-app/src/components/Lobby/CreateLobbyModal.tsx
import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toaster } from '../ui/toaster';
import { database } from '@/supabase/Database';

interface CreateLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLobbyCreated: () => void;
}

const stakeOptions = [
  { value: '100000000', label: '0.1 SOL' },
  { value: '250000000', label: '0.25 SOL' },
  { value: '500000000', label: '0.5 SOL' },
  { value: '750000000', label: '0.75 SOL' },
  { value: '1000000000', label: '1.0 SOL' },
];

const maxPlayersOptions = [
  { value: 2, label: '2 Players (1v1)' },
  { value: 4, label: '4 Players (Tournament)' },
  { value: 8, label: '8 Players (Tournament)' },
];

export const CreateLobbyModal: React.FC<CreateLobbyModalProps> = ({
  isOpen,
  onClose,
  onLobbyCreated,
}) => {
  // IMPORTANT: This conditional return must be at the top
  if (!isOpen) return null;

  const { publicKey, connected } = useWallet();
  const [lobbyName, setLobbyName] = useState('');
  const [stakeAmount, setStakeAmount] = useState<string>(stakeOptions[0].value);
  const [maxPlayers, setMaxPlayers] = useState<number>(maxPlayersOptions[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      if (publicKey) {
        const address = publicKey.toBase58();
        const user = await database.users.getByWallet(address);
        if (user) {
          setCurrentUserId(user.id);
        } else {
          setCurrentUserId(null);
        }
      }
    };
    fetchUserId();
  }, [publicKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey || isLoading || !currentUserId) {
      toaster.create({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet and ensure your user data is loaded.',
        type: 'error',
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:4000/api/v1/game/create-lobby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: lobbyName || null,
          created_by: currentUserId,
          stake_amount: (Number(stakeAmount)).toString(),
          max_players: maxPlayers,
        }),
      });
      console.log((Number(stakeAmount)).toString())
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create lobby');
      }

      toaster.create({
        title: 'Lobby Created! 🎉',
        description: `Lobby #${data.lobby.id} has been created.`,
        type: 'success',
        duration: 4000,
      });

      onLobbyCreated();
      onClose();
      setLobbyName('');
      setStakeAmount(stakeOptions[0].value);
      setMaxPlayers(maxPlayersOptions[0].value);

    } catch (error: any) {
      console.error('Error creating lobby:', error);
      toaster.create({
        title: 'Lobby Creation Failed',
        description: error.message || 'An unexpected error occurred.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Basic styles for the modal (ensure these are consistent with your CSS strategy)
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'white',
    border: '4px solid #333',
    borderRadius: '0',
    boxShadow: '8px 8px 0px rgba(0,0,0,0.8)',
    width: '90%',
    maxWidth: '500px',
    fontFamily: 'sans-serif',
    position: 'relative',
  };

  const modalHeaderStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '4px solid #333',
    backgroundColor: '#FF6B35',
    color: 'white',
    fontSize: '24px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '2px',
  };

  const modalBodyStyle: React.CSSProperties = {
    padding: '24px',
  };

  const modalFooterStyle: React.CSSProperties = {
    padding: '16px',
    borderTop: '4px solid #333',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  };

  const formControlStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  const formLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#4a4a4a',
    marginBottom: '8px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    border: '3px solid #333',
    borderRadius: '0',
    fontSize: '16px',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    backgroundColor: 'white',
    color: '#333',
  };

  const buttonBaseStyle: React.CSSProperties = {
    fontWeight: 'bold',
    fontSize: '18px',
    padding: '12px 24px',
    borderRadius: '0',
    border: '3px solid #333',
    boxShadow: '4px 4px 0px rgba(0,0,0,0.8)',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  };

  const cancelButtonHoverActiveStyle = connected && !isLoading ? {
    backgroundColor: "#B01030", // Darker red on hover
    transform: "translate(-2px, -2px)",
    boxShadow: "6px 6px 0px rgba(0,0,0,0.8)",
  } : {};

  const submitButtonHoverActiveStyle = connected && !isLoading && currentUserId ? {
    backgroundColor: "#04C28D", // Darker green on hover
    transform: "translate(-2px, -2px)",
    boxShadow: "6px 6px 0px rgba(0,0,0,0.8)",
  } : {};

  const disabledButtonStyle: React.CSSProperties = {
    opacity: 0.6,
    cursor: 'not-allowed',
    boxShadow: '2px 2px 0px rgba(0,0,0,0.8)',
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <div style={modalHeaderStyle}>
          Create New Game Lobby
        </div>

        <div style={modalBodyStyle}>
          <form onSubmit={handleSubmit}>
            <div style={formControlStyle}>
              <label htmlFor="lobby-name" style={formLabelStyle}>Lobby Name (Optional)</label>
              <input
                id="lobby-name"
                type="text"
                value={lobbyName}
                onChange={(e) => setLobbyName(e.target.value)}
                placeholder="e.g., Epic 1v1 Battle"
                style={inputStyle}
                disabled={isLoading}
              />
            </div>

            <div style={formControlStyle}>
              <label htmlFor="stake-amount" style={formLabelStyle}>Stake Amount (SOL)</label>
              <select
                id="stake-amount"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                style={selectStyle}
                disabled={isLoading}
                required
              >
                {stakeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={formControlStyle}>
              <label htmlFor="max-players" style={formLabelStyle}>Max Players</label>
              <select
                id="max-players"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                style={selectStyle}
                disabled={isLoading}
                required
              >
                {maxPlayersOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Note: 4 or 8 players automatically creates a Tournament lobby.
              </p>
            </div>
          </form>
        </div>

        <div style={modalFooterStyle}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              ...buttonBaseStyle,
              backgroundColor: '#DC143C', // Red color
              color: 'white',
              ...(isLoading ? disabledButtonStyle : {}),
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                Object.assign(e.currentTarget.style, cancelButtonHoverActiveStyle);
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                Object.assign(e.currentTarget.style, {
                  transform: "translate(0px, 0px)",
                  boxShadow: "4px 4px 0px rgba(0,0,0,0.8)",
                  backgroundColor: "#DC143C"
                });
              }
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!connected || isLoading || !currentUserId}
            style={{
              ...buttonBaseStyle,
              backgroundColor: '#06D6A0', // Green color
              color: 'white',
              ...(!connected || isLoading || !currentUserId ? disabledButtonStyle : {}),
            }}
            onMouseOver={(e) => {
              if (connected && !isLoading && currentUserId) {
                Object.assign(e.currentTarget.style, submitButtonHoverActiveStyle);
              }
            }}
            onMouseOut={(e) => {
              if (connected && !isLoading && currentUserId) {
                Object.assign(e.currentTarget.style, {
                  transform: "translate(0px, 0px)",
                  boxShadow: "4px 4px 0px rgba(0,0,0,0.8)",
                  backgroundColor: "#06D6A0"
                });
              }
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,.3)',
                  borderRadius: '50%',
                  borderTopColor: '#fff',
                  animation: 'spin 1s ease-in-out infinite',
                  marginRight: '8px'
                }}></span>
                Creating...
              </span>
            ) : (
              'Create Lobby'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};