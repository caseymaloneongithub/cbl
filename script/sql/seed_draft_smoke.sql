-- Deterministic seed data for draft smoke tests.
-- Safe to run multiple times.

INSERT INTO users (
  id,
  email,
  password_hash,
  first_name,
  last_name,
  team_name,
  team_abbreviation,
  is_commissioner,
  is_super_admin,
  must_reset_password
)
VALUES
  (
    '4c9fe418-8147-4da6-aad3-8652c788897e',
    'admin@test.local',
    '$2b$12$Lnd1TPUrTRQl.lr0HUajB.T03Jy8XVziTW2NruSLBkvWFn0TuVARe',
    'Admin',
    'User',
    'Admins',
    'ADM',
    true,
    true,
    false
  ),
  (
    '99f8e9fe-f193-45aa-8390-c7981233b028',
    'owner1@test.local',
    '$2b$12$Lnd1TPUrTRQl.lr0HUajB.T03Jy8XVziTW2NruSLBkvWFn0TuVARe',
    'Owner',
    'One',
    'Team One',
    'ONE',
    false,
    false,
    false
  ),
  (
    '859ef435-57b5-4c01-a8d3-f2ef742f1e19',
    'owner2@test.local',
    '$2b$12$Lnd1TPUrTRQl.lr0HUajB.T03Jy8XVziTW2NruSLBkvWFn0TuVARe',
    'Owner',
    'Two',
    'Team Two',
    'TWO',
    false,
    false,
    false
  )
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  team_name = EXCLUDED.team_name,
  team_abbreviation = EXCLUDED.team_abbreviation,
  is_commissioner = EXCLUDED.is_commissioner,
  is_super_admin = EXCLUDED.is_super_admin,
  must_reset_password = EXCLUDED.must_reset_password;

INSERT INTO mlb_players (
  mlb_id,
  full_name,
  first_name,
  last_name,
  primary_position,
  position_name,
  position_type,
  current_team_id,
  current_team_name,
  parent_org_id,
  parent_org_name,
  sport_id,
  sport_level,
  season
)
VALUES
  (900001, 'Alpha One', 'Alpha', 'One', 'SS', 'Shortstop', 'Infielder', 1, 'OrgA MLB', 101, 'OrgA', 1, 'AAA', 2026),
  (900002, 'Alpha Two', 'Alpha', 'Two', 'OF', 'Outfielder', 'Outfielder', 1, 'OrgA MLB', 101, 'OrgA', 1, 'AA', 2026),
  (900003, 'Alpha Three', 'Alpha', 'Three', 'P', 'Pitcher', 'Pitcher', 1, 'OrgA MLB', 101, 'OrgA', 1, 'A+', 2026),
  (900004, 'Beta One', 'Beta', 'One', 'C', 'Catcher', 'Catcher', 2, 'OrgB MLB', 202, 'OrgB', 1, 'AAA', 2026),
  (900005, 'Beta Two', 'Beta', 'Two', '1B', 'First Base', 'Infielder', 2, 'OrgB MLB', 202, 'OrgB', 1, 'AA', 2026)
ON CONFLICT (mlb_id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  primary_position = EXCLUDED.primary_position,
  position_name = EXCLUDED.position_name,
  position_type = EXCLUDED.position_type,
  current_team_id = EXCLUDED.current_team_id,
  current_team_name = EXCLUDED.current_team_name,
  parent_org_id = EXCLUDED.parent_org_id,
  parent_org_name = EXCLUDED.parent_org_name,
  sport_id = EXCLUDED.sport_id,
  sport_level = EXCLUDED.sport_level,
  season = EXCLUDED.season;
