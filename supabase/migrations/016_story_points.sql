-- Migration 016: Story Points System
-- Replaces T-shirt sizing (XS-XXL) with Fibonacci story points (1,2,3,5,8,13)

ALTER TABLE tasks
ADD COLUMN story_points INTEGER;

ALTER TABLE tasks
ADD CONSTRAINT tasks_story_points_check
CHECK (story_points IN (1, 2, 3, 5, 8, 13));

UPDATE tasks
SET story_points = CASE
    WHEN size = 'XS'  THEN 1
    WHEN size = 'S'   THEN 2
    WHEN size = 'M'   THEN 3
    WHEN size = 'L'   THEN 5
    WHEN size = 'XL'  THEN 8
    WHEN size = 'XXL' THEN 13
    ELSE 3
END;

UPDATE tasks SET story_points = 3 WHERE story_points IS NULL;
