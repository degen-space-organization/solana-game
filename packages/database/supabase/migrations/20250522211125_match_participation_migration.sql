-- Match participants (exactly 2 players per match)
CREATE TABLE match_participants (
    id SERIAL,
    match_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    position INTEGER NOT NULL, -- Player 1 or Player 2
    
    -- Constraints
    CONSTRAINT match_participants_pkey PRIMARY KEY (id),
    CONSTRAINT match_participants_match_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    CONSTRAINT match_participants_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT match_participants_position_valid CHECK (position IN (1, 2)),
    CONSTRAINT match_participants_unique_user_per_match UNIQUE (match_id, user_id),
    CONSTRAINT match_participants_unique_position_per_match UNIQUE (match_id, position)
);

--Indexes 
CREATE INDEX idx_match_participants_match ON match_participants(match_id);
CREATE INDEX idx_match_participants_user ON match_participants(user_id);

-- Triggers
CREATE TRIGGER trg_prevent_concurrent_match
    BEFORE INSERT OR UPDATE ON match_participants
    FOR EACH ROW EXECUTE FUNCTION prevent_concurrent_participation();