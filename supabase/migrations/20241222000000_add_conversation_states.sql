-- Add missing columns to chat_examples table
ALTER TABLE optimat.chat_examples
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS replay_config jsonb;

-- Create conversation_states table for replay functionality
CREATE TABLE IF NOT EXISTS optimat.conversation_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES optimat.conversations(id) ON DELETE CASCADE,
    example_id uuid REFERENCES optimat.chat_examples(id) ON DELETE CASCADE,
    sequence_number integer NOT NULL,
    state_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    ui_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
    show_providers boolean DEFAULT false,
    show_addresses boolean DEFAULT false,
    map_action text,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(conversation_id, sequence_number),
    UNIQUE(example_id, sequence_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_states_conversation ON optimat.conversation_states(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_example ON optimat.conversation_states(example_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_sequence ON optimat.conversation_states(example_id, sequence_number);

-- Add comments for documentation
COMMENT ON TABLE optimat.conversation_states IS 'Stores replay states for conversations to enable step-by-step playback';
COMMENT ON COLUMN optimat.conversation_states.sequence_number IS 'Order of the state in the replay sequence';
COMMENT ON COLUMN optimat.conversation_states.state_snapshot IS 'Complete state at this point including providers, addresses, etc.';
COMMENT ON COLUMN optimat.conversation_states.ui_hints IS 'UI hints for frontend display (show_providers, map_action, etc.)';
