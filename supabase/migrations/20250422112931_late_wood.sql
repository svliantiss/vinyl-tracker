/*
  # Create recordings table

  1. New Tables
    - `recordings`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `name` (text)
      - `bpm` (numeric)
      - `key` (text)
      - `audio_url` (text)
      - `image_url` (text, nullable)
      - `user_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on `recordings` table
    - Add policies for authenticated users to manage their own recordings
*/

CREATE TABLE IF NOT EXISTS recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  bpm numeric NOT NULL,
  key text NOT NULL,
  audio_url text NOT NULL,
  image_url text,
  user_id uuid REFERENCES auth.users NOT NULL
);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recordings"
  ON recordings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);