CREATE TABLE chat_messages (
    id SERIAL,
    match_id INTEGER NULL,
    lobby_id INTEGER NULL,
    tournament_id INTEGER NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT chat_messages_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_lobby_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_message_not_empty CHECK (LENGTH(TRIM(message)) > 0),
    -- Ensure message belongs to exactly one context
    CONSTRAINT chat_messages_single_context CHECK (
        (match_id IS NOT NULL AND lobby_id IS NULL AND tournament_id IS NULL) OR
        (match_id IS NULL AND lobby_id IS NOT NULL AND tournament_id IS NULL) OR
        (match_id IS NULL AND lobby_id IS NULL AND tournament_id IS NOT NULL) OR
        (match_id IS NULL AND lobby_id IS NULL AND tournament_id IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_chat_messages_match ON chat_messages(match_id);
CREATE INDEX idx_chat_messages_lobby ON chat_messages(lobby_id);
CREATE INDEX idx_chat_messages_tournament ON chat_messages(tournament_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);