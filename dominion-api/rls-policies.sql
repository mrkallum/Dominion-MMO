-- Enable Row Level Security on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own profile
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Policy: Users can only update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile (for initial creation)
CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Note: Delete policy not needed unless allowing profile deletion

-- Ensure the profiles table has the correct structure
-- Assuming columns: id (uuid, primary key), email (text), username (text), level (int), xp (int), faction (text), corruption_alignment (text), race (text), appearance (jsonb)