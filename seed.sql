-- PostgreSQL Seed Data for Study Groups Web Application

-- 1. INSERT SAMPLE USERS
INSERT INTO users (id, email, password_hash, full_name, avatar_url, bio, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'alice@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Alice Smith', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 'CS Major & Algorithms Enthusiast', '2025-11-05 08:30:00+00', '2025-11-05 08:30:00+00'),
('22222222-2222-2222-2222-222222222222', 'bob@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Bob Jones', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', 'Software Enthusiast & Web Developer', '2025-11-12 10:15:00+00', '2025-11-12 10:15:00+00'),
('33333333-3333-3333-3333-333333333333', 'charlie@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Charlie Brown', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', 'Math & CS Double Major', '2025-12-01 14:00:00+00', '2025-12-01 14:00:00+00'),
('44444444-4444-4444-4444-444444444444', 'david@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'David Wilson', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', 'Pre-Med Student & Organic Chem Tutor', '2025-12-15 09:45:00+00', '2025-12-15 09:45:00+00'),
('55555555-5555-5555-5555-555555555555', 'elena@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Elena Rostova', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb', 'Data Science & Machine Learning Specialist', '2026-01-10 11:20:00+00', '2026-01-10 11:20:00+00'),
('66666666-6666-6666-6666-666666666666', 'frank@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Frank Miller', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7', 'Physics & Astronomy Undergrad', '2026-02-01 13:10:00+00', '2026-02-01 13:10:00+00'),
('77777777-7777-7777-7777-777777777777', 'grace@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Grace Hopper', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', 'AI Researcher & Robotics Club Lead', '2026-02-20 16:50:00+00', '2026-02-20 16:50:00+00'),
('88888888-8888-8888-8888-888888888888', 'hannah@example.com', '$2b$12$eImiTXuWVxfM37uY4JANjO...hash', 'Hannah Abbott', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2', 'Biochemistry & Genetics Scholar', '2026-03-05 10:05:00+00', '2026-03-05 10:05:00+00');


-- 2. INSERT SAMPLE STUDY GROUPS
INSERT INTO study_groups (id, title, description, is_public, created_by, created_at, updated_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CS 101 Study Group', 'Introductory Computer Science, Trees, Graphs & Data Structures.', TRUE, '11111111-1111-1111-1111-111111111111', '2025-11-10 10:00:00+00', '2025-11-10 10:00:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Organic Chemistry', 'Reaction mechanisms, stereochemistry, synthesis, and lab reviews.', TRUE, '44444444-4444-4444-4444-444444444444', '2025-12-18 14:30:00+00', '2025-12-18 14:30:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Linear Algebra & Proofs', 'Vectors, matrices, linear transformations, eigenvalues, and mathematical proofs.', TRUE, '33333333-3333-3333-3333-333333333333', '2026-01-15 09:15:00+00', '2026-01-15 09:15:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Data Structures & Algorithms', 'Advanced algorithms, dynamic programming, search trees, and complexity analysis.', TRUE, '55555555-5555-5555-5555-555555555555', '2026-01-28 11:00:00+00', '2026-01-28 11:00:00+00'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Quantum Mechanics & Physics', 'Quantum state vectors, wave mechanics, Schrödinger equation, and atomic models.', TRUE, '66666666-6666-6666-6666-666666666666', '2026-02-14 15:45:00+00', '2026-02-14 15:45:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Machine Learning & AI Lab', 'Supervised learning, deep neural networks, computer vision, and PyTorch.', TRUE, '77777777-7777-7777-7777-777777777777', '2026-03-10 16:00:00+00', '2026-03-10 16:00:00+00'),
('11111111-2222-3333-4444-555555555555', 'Web Development & Full-Stack Node.js', 'Modern REST APIs, Express, Next.js, WebSockets, and database design.', TRUE, '22222222-2222-2222-2222-222222222222', '2026-03-15 10:00:00+00', '2026-03-15 10:00:00+00'),
('22222222-3333-4444-5555-666666666666', 'Biochemistry & Genetics Research', 'DNA replication, RNA transcription, protein structures, and CRISPR editing.', TRUE, '88888888-8888-8888-8888-888888888888', '2026-03-18 11:30:00+00', '2026-03-18 11:30:00+00'),
('33333333-4444-5555-6666-777777777777', 'Astrophysics & Relativity Seminar', 'Black holes, gravitational waves, cosmological expansion, and stellar evolution.', TRUE, '66666666-6666-6666-6666-666666666666', '2026-03-22 14:15:00+00', '2026-03-22 14:15:00+00'),
('44444444-5555-6666-7777-888888888888', 'Microeconomics & Game Theory', 'Nash equilibrium, market efficiency, supply/demand curves, and behavioral econ.', TRUE, '33333333-3333-3333-3333-333333333333', '2026-03-25 09:00:00+00', '2026-03-25 09:00:00+00');


-- 3. INSERT GROUP MEMBERSHIPS
INSERT INTO group_memberships (group_id, user_id, role, joined_at) VALUES
-- CS 101 Memberships
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'host', '2025-11-10 10:00:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member', '2025-11-14 11:20:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', '2025-12-05 16:40:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member', '2025-12-20 09:30:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member', '2026-01-12 14:15:00+00'),

-- Organic Chemistry Memberships
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'host', '2025-12-18 14:30:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', 'member', '2026-03-08 08:50:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'member', '2026-03-15 13:10:00+00'),

-- Linear Algebra Memberships
('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'host', '2026-01-15 09:15:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'admin', '2026-01-16 10:00:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', 'member', '2026-01-20 15:30:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'member', '2026-02-05 12:45:00+00'),

-- Data Structures & Algorithms Memberships
('dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'host', '2026-01-28 11:00:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'member', '2026-02-02 10:20:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'member', '2026-02-10 14:00:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '77777777-7777-7777-7777-777777777777', 'member', '2026-02-25 17:15:00+00'),

-- Quantum Mechanics Memberships
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-6666-6666-6666-666666666666', 'host', '2026-02-14 15:45:00+00'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'member', '2026-02-18 09:30:00+00'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '77777777-7777-7777-7777-777777777777', 'member', '2026-03-01 11:00:00+00'),

-- Machine Learning Memberships
('ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'host', '2026-03-10 16:00:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '55555555-5555-5555-5555-555555555555', 'admin', '2026-03-12 09:40:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'member', '2026-03-15 14:25:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'member', '2026-04-01 10:10:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'member', '2026-04-10 16:50:00+00'),

-- Web Development Memberships
('11111111-2222-3333-4444-555555555555', '22222222-2222-2222-2222-222222222222', 'host', '2026-03-15 10:00:00+00'),
('11111111-2222-3333-4444-555555555555', '11111111-1111-1111-1111-111111111111', 'member', '2026-03-16 11:00:00+00'),
('11111111-2222-3333-4444-555555555555', '33333333-3333-3333-3333-333333333333', 'member', '2026-03-17 14:00:00+00'),

-- Biochemistry Memberships
('22222222-3333-4444-5555-666666666666', '88888888-8888-8888-8888-888888888888', 'host', '2026-03-18 11:30:00+00'),
('22222222-3333-4444-5555-666666666666', '44444444-4444-4444-4444-444444444444', 'member', '2026-03-19 12:00:00+00'),
('22222222-3333-4444-5555-666666666666', '77777777-7777-7777-7777-777777777777', 'member', '2026-03-20 15:00:00+00'),

-- Astrophysics Memberships
('33333333-4444-5555-6666-777777777777', '66666666-6666-6666-6666-666666666666', 'host', '2026-03-22 14:15:00+00'),
('33333333-4444-5555-6666-777777777777', '77777777-7777-7777-7777-777777777777', 'member', '2026-03-23 09:30:00+00'),
('33333333-4444-5555-6666-777777777777', '33333333-3333-3333-3333-333333333333', 'member', '2026-03-24 16:00:00+00'),

-- Microeconomics Memberships
('44444444-5555-6666-7777-888888888888', '33333333-3333-3333-3333-333333333333', 'host', '2026-03-25 09:00:00+00'),
('44444444-5555-6666-7777-888888888888', '55555555-5555-5555-5555-555555555555', 'member', '2026-03-26 10:30:00+00'),
('44444444-5555-6666-7777-888888888888', '22222222-2222-2222-2222-222222222222', 'member', '2026-03-27 13:45:00+00');


-- 4. INSERT GROUP INVITE LINKS
INSERT INTO group_invites (group_id, token, created_by, expires_at, created_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cs101-invite-2025-fall', '11111111-1111-1111-1111-111111111111', '2025-12-31 23:59:59+00', '2025-11-20 12:00:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'chem-pass-2026-spring', '44444444-4444-4444-4444-444444444444', '2026-06-30 23:59:59+00', '2026-01-05 15:30:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'linalg-join-spring2026', '33333333-3333-3333-3333-333333333333', '2026-05-31 23:59:59+00', '2026-02-01 09:00:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'algo-squad-2026-spring', '55555555-5555-5555-5555-555555555555', '2026-08-31 23:59:59+00', '2026-02-15 14:00:00+00'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'quantum-realm-v1-key', '66666666-6666-6666-6666-666666666666', '2026-09-30 23:59:59+00', '2026-03-01 10:15:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'ai-lab-future-2026-join', '77777777-7777-7777-7777-777777777777', '2026-12-31 23:59:59+00', '2026-04-15 11:45:00+00');


-- 5. INSERT MATERIALS / DOCUMENTS
INSERT INTO materials (group_id, uploaded_by, title, file_format, file_size_bytes, file_url, created_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Lecture Notes - Week 1 Trees & Graphs', 'PDF', 2516582, 'https://storage.example.com/cs101_week1.pdf', '2025-11-15 14:00:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Practice Homework 2 Problems', 'DOCX', 1153433, 'https://storage.example.com/cs101_hw2.docx', '2025-11-28 16:20:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Midterm Algorithms Review Guide', 'PDF', 3984588, 'https://storage.example.com/cs101_review.pdf', '2025-12-10 11:30:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'Reaction Mechanisms Cheat Sheet', 'PDF', 4821092, 'https://storage.example.com/orgchem_mech.pdf', '2026-01-08 10:15:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', 'Lab Experiment 4 Summary & Results', 'DOCX', 2094182, 'https://storage.example.com/orgchem_lab4.docx', '2026-03-22 15:40:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Eigenvalues & Eigenvectors Proofs', 'PDF', 1892011, 'https://storage.example.com/linalg_eigen.pdf', '2026-01-25 13:00:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Vector Spaces Matrix Transformations', 'PDF', 3104928, 'https://storage.example.com/linalg_vectors.pdf', '2026-02-14 09:50:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'B-Trees and AVL Balance Algorithms', 'PDF', 5210922, 'https://storage.example.com/dsa_trees.pdf', '2026-02-10 14:10:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Graph Traversal BFS DFS Code Samples', 'ZIP', 1420912, 'https://storage.example.com/dsa_graphs.zip', '2026-03-05 16:00:00+00'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-6666-6666-6666-666666666666', 'Schrödinger Equation Derivations', 'PDF', 3410921, 'https://storage.example.com/quantum_schrodinger.pdf', '2026-02-22 11:25:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'Deep Learning & PyTorch Tutorial', 'PDF', 8912044, 'https://storage.example.com/ml_pytorch.pdf', '2026-03-20 14:30:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '55555555-5555-5555-5555-555555555555', 'Convolutional Neural Nets Slide Deck', 'PNG', 6720194, 'https://storage.example.com/ml_cnn_slides.png', '2026-04-12 17:15:00+00'),
(NULL, '33333333-3333-3333-3333-333333333333', 'LaTeX Resume & CS Paper Template', 'ZIP', 891044, 'https://storage.example.com/global_latex_template.zip', '2026-05-01 10:00:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Transformer Architectures & Attention Paper', 'PDF', 4120955, 'https://storage.example.com/ml_attention.pdf', '2026-06-18 12:40:00+00');


-- 6. INSERT EVENTS / STUDY SESSIONS
INSERT INTO events (id, group_id, created_by, title, description, location, start_time, end_time, created_at) VALUES
('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Fall Semester Final Review - Trees & Graphs', 'Group problem solving and review session for upcoming exams.', 'Library Study Room 2', '2025-11-25 14:00:00+00', '2025-11-25 16:30:00+00', '2025-11-18 10:00:00+00'),
('e2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'CS 101 Exam Retrospective & Code Walkthrough', 'Discussion of final exam solutions and tree traversals.', 'Virtual Room 1', '2025-12-15 15:00:00+00', '2025-12-15 17:00:00+00', '2025-12-08 12:00:00+00'),
('e3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'Stereochemistry & Chiral Centers Session', 'Hands-on molecular modeling and enantiomer practice.', 'Science Building Lab 304', '2026-01-20 13:00:00+00', '2026-01-20 15:00:00+00', '2026-01-10 09:00:00+00'),
('e4444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Matrix Transformation & Subspaces Workshop', 'Solving past exam problems together and working on proofs.', 'Math Hall Room 101', '2026-02-08 11:00:00+00', '2026-02-08 13:00:00+00', '2026-01-30 14:00:00+00'),
('e5555555-5555-5555-5555-555555555555', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'Dynamic Programming & Recursion Sprint', 'Whiteboard problem practice for DP memoization.', 'Engineering Lounge', '2026-02-22 16:00:00+00', '2026-02-22 18:30:00+00', '2026-02-12 11:00:00+00'),
('e6666666-6666-6666-6666-666666666666', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-6666-6666-6666-666666666666', 'Wave-Particle Duality & Quantum Tunneling', 'Seminar and group debate on quantum phenomena.', 'Physics Lab 202', '2026-03-14 14:00:00+00', '2026-03-14 16:00:00+00', '2026-03-02 08:30:00+00'),
('e7777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'Midterm Organic Synthesis Review', 'Focusing on electrophilic additions and reaction pathways.', 'Virtual Room 2', '2026-03-28 10:00:00+00', '2026-03-28 12:00:00+00', '2026-03-18 15:00:00+00'),
('e8888888-8888-8888-8888-888888888888', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'Intro to Neural Nets & Gradient Descent', 'Live coding session using PyTorch and Jupyter notebooks.', 'Computer Lab 4', '2026-04-18 15:00:00+00', '2026-04-18 17:30:00+00', '2026-04-05 10:00:00+00'),
('e9999999-9999-9999-9999-999999999999', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'Graph Algorithms: Dijkstra & A* Search', 'Deep dive into pathfinding algorithms and shortest path.', 'Virtual Room 1', '2026-05-12 13:00:00+00', '2026-05-12 15:00:00+00', '2026-05-01 09:00:00+00'),
('eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'Computer Vision & CNN Architectures', 'Paper discussion and hands-on image classification model training.', 'AI Innovation Lab', '2026-06-25 14:00:00+00', '2026-06-25 16:30:00+00', '2026-06-10 11:00:00+00'),
('ebbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Summer Coding Challenge Prep', 'Mock technical interview practice and algorithmic thinking.', 'Virtual Room 3', '2026-07-28 16:00:00+00', '2026-07-28 18:00:00+00', '2026-07-15 12:00:00+00'),
('eccccccc-cccc-cccc-cccc-cccccccccccc', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'Large Language Model Workshop', 'Fine-tuning open weights models and prompt engineering.', 'Engineering Auditorium', '2026-08-15 10:00:00+00', '2026-08-15 14:00:00+00', '2026-07-20 09:00:00+00');


-- 7. INSERT EVENT ATTENDEES
INSERT INTO event_attendees (event_id, user_id, created_at) VALUES
-- Event 1 attendees (CS 101 Nov 2025)
('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2025-11-18 10:05:00+00'),
('e1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '2025-11-19 14:15:00+00'),
('e1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2025-11-21 09:30:00+00'),

-- Event 2 attendees (CS 101 Dec 2025)
('e2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2025-12-08 12:05:00+00'),
('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '2025-12-09 11:00:00+00'),
('e2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', '2025-12-10 16:45:00+00'),

-- Event 3 attendees (Org Chem Jan 2026)
('e3333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '2026-01-10 09:05:00+00'),

-- Event 4 attendees (Linear Alg Feb 2026)
('e4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '2026-01-30 14:05:00+00'),
('e4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '2026-02-01 10:20:00+00'),
('e4444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '2026-02-02 15:10:00+00'),

-- Event 5 attendees (Data Structs Feb 2026)
('e5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', '2026-02-12 11:05:00+00'),
('e5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '2026-02-14 08:30:00+00'),
('e5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', '2026-02-15 13:40:00+00'),

-- Event 6 attendees (Quantum Physics Mar 2026)
('e6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', '2026-03-02 08:35:00+00'),
('e6666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '2026-03-05 12:00:00+00'),
('e6666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', '2026-03-08 17:15:00+00'),

-- Event 7 attendees (Org Chem Mar 2026)
('e7777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', '2026-03-18 15:05:00+00'),
('e7777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888', '2026-03-20 10:45:00+00'),

-- Event 8 attendees (ML Lab Apr 2026)
('e8888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', '2026-04-05 10:05:00+00'),
('e8888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', '2026-04-06 14:20:00+00'),
('e8888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '2026-04-08 09:10:00+00'),
('e8888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', '2026-04-10 11:30:00+00'),

-- Event 9 attendees (Data Structs May 2026)
('e9999999-9999-9999-9999-999999999999', '55555555-5555-5555-5555-555555555555', '2026-05-01 09:05:00+00'),
('e9999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', '2026-05-03 16:00:00+00'),

-- Event 10 attendees (ML Lab Jun 2026)
('eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', '2026-06-10 11:05:00+00'),
('eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '2026-06-12 13:40:00+00'),

-- Event 11 attendees (CS 101 Jul 2026)
('ebbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '2026-07-15 12:05:00+00'),
('ebbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '2026-07-18 10:15:00+00'),

-- Event 12 attendees (ML Lab Aug 2026)
('eccccccc-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', '2026-07-20 09:05:00+00'),
('eccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', '2026-07-21 14:00:00+00'),
('eccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', '2026-07-22 11:30:00+00');


-- 8. INSERT GROUP CHAT MESSAGES
INSERT INTO group_messages (group_id, sender_id, content, created_at) VALUES
-- CS 101 Chat
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Welcome everyone! Please check out the Midterm Review Guide in the Materials tab.', '2025-11-16 09:15:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Thanks Alice! Looking forward to tomorrow''s review session.', '2025-11-16 10:30:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Does anyone have recommendations for graph traversal visualization tools?', '2025-12-02 14:20:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'VisuAlgo is super helpful for step-by-step DFS and BFS execution!', '2025-12-02 14:45:00+00'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Glad to join the group! Excited to review tree algorithms together.', '2026-01-13 11:00:00+00'),

-- Organic Chemistry Chat
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'Welcome to Organic Chemistry! I uploaded the reaction mechanism notes.', '2025-12-19 16:00:00+00'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', 'Thanks David, the chiral centers explanation was super clear.', '2026-03-09 09:30:00+00'),

-- Linear Algebra Chat
('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Hi everyone! Check out the proofs uploaded for eigenvalues.', '2026-01-16 13:00:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Super helpful notes, thanks Charlie!', '2026-01-17 15:40:00+00'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'Is anyone working on Problem Set 3 linear combinations?', '2026-02-06 18:10:00+00'),

-- Data Structures Chat
('dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'Welcome all! Today we start looking into AVL balance factors.', '2026-01-29 10:00:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Uploaded some BFS/DFS code samples to the materials folder.', '2026-03-05 14:15:00+00'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '77777777-7777-7777-7777-777777777777', 'Great code samples Bob! Helped me fix my graph recursion bug.', '2026-03-06 08:50:00+00'),

-- Quantum Mechanics Chat
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-6666-6666-6666-666666666666', 'First quantum mechanics seminar is scheduled for March 14th!', '2026-02-15 12:00:00+00'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '77777777-7777-7777-7777-777777777777', 'Looking forward to the wave-particle duality discussion!', '2026-03-02 16:30:00+00'),

-- Machine Learning Chat
('ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777-7777-7777-7777-777777777777', 'Welcome to the ML & Neural Nets Lab! PyTorch tutorial is now live.', '2026-03-11 11:20:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '55555555-5555-5555-5555-555555555555', 'Added the CNN slides! Don''t forget to review pooling layers.', '2026-04-12 17:00:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'The PyTorch workshop recording was amazing. Thanks Grace!', '2026-04-19 10:15:00+00'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'Looking forward to the August LLM fine-tuning session!', '2026-07-21 14:30:00+00');


-- 9. INSERT DIRECT MESSAGES
INSERT INTO direct_messages (sender_id, receiver_id, content, created_at) VALUES
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Hey Bob, did you finish the CS 101 practice set?', '2025-12-05 14:00:00+00'),
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Almost done Alice! Stuck on question 4 with binary search trees.', '2025-12-05 14:15:00+00'),
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'I can help you review it during office hours today.', '2025-12-05 14:20:00+00'),
('44444444-4444-4444-4444-444444444444', '88888888-8888-8888-8888-888888888888', 'Hi Hannah, welcome to the Org Chem group!', '2026-03-08 10:00:00+00'),
('88888888-8888-8888-8888-888888888888', '44444444-4444-4444-4444-444444444444', 'Thanks David! Do you know when the next lab review is?', '2026-03-08 10:15:00+00'),
('44444444-4444-4444-4444-444444444444', '88888888-8888-8888-8888-888888888888', 'It''s scheduled for March 28th at 10 AM.', '2026-03-08 10:25:00+00'),
('33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', 'Hey Frank, loved your presentation on wave equations.', '2026-02-20 16:00:00+00'),
('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'Appreciate it Charlie! Let''s collaborate on the linear algebra physics applications.', '2026-02-20 16:30:00+00'),
('55555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777', 'Hi Grace! Interested in co-hosting the PyTorch workshop?', '2026-03-15 11:00:00+00'),
('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'That would be awesome Elena! Let''s prepare the starter notebooks.', '2026-03-15 11:30:00+00'),
('55555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777', 'Sounds good, I uploaded the CNN deck already.', '2026-04-12 18:00:00+00'),
('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'Hey Elena, thanks for hosting the graph search session.', '2026-05-13 09:10:00+00'),
('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'You''re welcome Bob! Happy to help anytime.', '2026-05-13 09:45:00+00'),
('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'Grace, do you have any recommended reading for transformer attention mechanisms?', '2026-06-15 13:20:00+00'),
('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Yes! I just uploaded "Attention Is All You Need" notes to the ML group.', '2026-06-18 15:00:00+00'),
('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'Awesome, reading it now. Thanks!', '2026-06-18 15:10:00+00');
