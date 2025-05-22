CREATE TABLE tournament_participants (
    id SERIAL,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eliminated_at TIMESTAMP NULL,
    final_position INTEGER NULL, -- 1st, 2nd, 3rd, etc.
    
    -- Constraints
    CONSTRAINT tournament_participants_pkey PRIMARY KEY (id),
    CONSTRAINT tournament_participants_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT tournament_participants_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT tournament_participants_unique_entry UNIQUE (tournament_id, user_id),
    CONSTRAINT tournament_participants_final_position_positive CHECK (final_position IS NULL OR final_position > 0),
    CONSTRAINT tournament_participants_eliminated_after_joined CHECK (eliminated_at IS NULL OR eliminated_at >= joined_at)
);