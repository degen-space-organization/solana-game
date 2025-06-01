CREATE TABLE tournament_participants (
    id SERIAL,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eliminated_at TIMESTAMP NULL,
    final_position INTEGER NULL, -- 1st, 2nd, 3rd, etc.
    is_ready BOOLEAN,
    has_staked BOOLEAN,
    
    -- Constraints
    CONSTRAINT tournament_participants_pkey PRIMARY KEY (id),
    CONSTRAINT tournament_participants_tournament_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT tournament_participants_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT tournament_participants_unique_entry UNIQUE (tournament_id, user_id),
    CONSTRAINT tournament_participants_final_position_positive CHECK (final_position IS NULL OR final_position > 0),
    CONSTRAINT tournament_participants_eliminated_after_joined CHECK (eliminated_at IS NULL OR eliminated_at >= joined_at)
);

--Indexes
CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_user ON tournament_participants(user_id);
-- CREATE UNIQUE INDEX idx_tournament_active_participants 
-- ON match_participants(user_id) WHERE EXISTS (
--     SELECT 1 FROM matches m 
--     WHERE m.id = match_participants.match_id 
--     AND m.tournament_id IS NOT NULL 
--     AND m.status IN ('in_progress', 'showing_results')
-- );
