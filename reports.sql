-- Users in 30 days
SELECT users.id, full_name FROM users
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days';

-- Groups in 7 days
SELECT study_groups.id, title FROM study_groups
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Avg users per group
SELECT 
    (SELECT COUNT(id)::NUMERIC FROM group_memberships) / 
    NULLIF((SELECT COUNT(*) FROM study_groups), 0) AS avg_users;

-- Files per group
SELECT 
    (SELECT COUNT(id)::NUMERIC FROM materials) / 
    NULLIF((SELECT COUNT(*) FROM study_groups), 0) AS avg_files;

-- Count of users in multiple groups vs single group
SELECT 
    COUNT(CASE WHEN group_count > 1 THEN 1 END) AS multi_group_users,
    COUNT(CASE WHEN group_count = 1 THEN 1 END) AS single_group_users
FROM (
    SELECT user_id, COUNT(group_id) AS group_count
    FROM group_memberships
    GROUP BY user_id
) user_group_stats;

-- Storage usage per group in MB
SELECT 
    sg.title,
    COUNT(m.id) AS file_count,
    ROUND(SUM(m.file_size_bytes)::NUMERIC / (1024 * 1024), 2) AS total_storage_mb
FROM study_groups sg
JOIN materials m ON sg.id = m.group_id
GROUP BY sg.id, sg.title
ORDER BY total_storage_mb DESC;