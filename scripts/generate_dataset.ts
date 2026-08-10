import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST || '/run/postgresql',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'study_groups',
  user: process.env.PGUSER || undefined,
  ...(process.env.PGPASSWORD ? { password: process.env.PGPASSWORD } : {}),
});

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Lisa', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah', 'Timothy', 'Stephanie',
  'Ronald', 'Rebecca', 'Jason', 'Sharon', 'Edward', 'Laura', 'Jeffrey', 'Cynthia', 'Ryan', 'Dorothy',
  'Jacob', 'Amy', 'Gary', 'Kathleen', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Emma',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Nicole', 'Scott', 'Anna', 'Brandon', 'Samantha',
  'Benjamin', 'Katherine', 'Samuel', 'Christine', 'Gregory', 'Debra', 'Alexander', 'Rachel', 'Frank', 'Carolyn',
  'Patrick', 'Janet', 'Raymond', 'Maria', 'Jack', 'Heather', 'Dennis', 'Diane', 'Jerry', 'Virginia'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes'
];

const SUBJECTS = [
  'CS 101: Intro to Computer Science', 'CS 106B: Programming Abstractions', 'CS 161: Design and Analysis of Algorithms',
  'CS 229: Machine Learning', 'CS 224N: Natural Language Processing', 'MATH 51: Linear Algebra & Multivariable Calculus',
  'MATH 104: Real Analysis', 'MATH 113: Abstract Algebra', 'CHEM 31A: Chemical Principles',
  'CHEM 131: Organic Chemistry I', 'CHEM 132: Organic Chemistry II', 'PHYSICS 41: Mechanics',
  'PHYSICS 120: Quantum Mechanics', 'BIO 81: Genetics & Molecular Biology', 'BIO 150: Human Behavioral Biology',
  'ECON 1: Principles of Economics', 'ECON 50: Microeconomic Analysis', 'ECON 102A: Introduction to Econometrics',
  'STATS 116: Theory of Probability', 'STATS 200: Introduction to Statistical Inference',
  'ENG 101: Academic Writing', 'PSYCH 1: Introduction to Psychology', 'NEURO 101: Fundamentals of Neuroscience'
];

const GROUP_TYPES = [
  'Study Group', 'Exam Prep & Review', 'Problem Set Squad', 'Discussion & Reading', 'Lab & Project Group',
  'Midterm Review', 'Finals Prep', 'Weekly Problem Solving', 'Office Hours Companion'
];

const BIOS = [
  'Computer Science major interested in algorithms and distributed systems.',
  'Pre-med student studying organic chemistry and biochemistry.',
  'Math & Data Science double major. Love tackling complex proofs!',
  'Physics undergrad passionate about quantum computing and astrophysics.',
  'Economics and Statistics student focusing on financial modeling.',
  'Neuroscience major preparing for MCAT and research assistantships.',
  'Software engineering enthusiast building full-stack web applications.',
  'Biology major interested in genomics and molecular biology.',
  'Electrical engineering student working on embedded systems and robotics.',
  'Psychology & Cognitive Science major exploring AI and human behavior.'
];

const SAMPLE_MESSAGES = [
  "Hey everyone! Does anyone know when problem set 3 is due?",
  "I think it's due this Friday at 11:59 PM.",
  "Thanks! Are office hours taking place in the library today?",
  "Yes, TA office hours are in Room 302 from 3 to 5 PM.",
  "Just uploaded the practice exam solutions to the materials tab!",
  "Awesome, thank you so much for sharing!",
  "Can someone explain question 4b on the homework?",
  "Sure! You need to apply proof by induction on the base case n=1 first.",
  "Ah that makes total sense, I was trying to solve it directly. Thanks!",
  "Are we meeting in person or over Zoom for tomorrow's review session?",
  "Let's meet in person at Green Library Room 204.",
  "Sounds great! I'll bring whiteboards and markers.",
  "Don't forget the midterm exam is next Tuesday at 10 AM.",
  "Is the exam open-book or closed-book?",
  "It's closed-book, but one double-sided cheat sheet is allowed.",
  "Perfect! Let's collaborate on creating a comprehensive cheat sheet.",
  "Has anyone started working on project milestone 2 yet?",
  "Yeah, I finished the initial setup. Happy to share my repo structure.",
  "Great job on yesterday's presentation everyone!",
  "Agreed, the professor said our analysis was really thorough.",
  "Does anyone have good visualization tools for graph algorithms?",
  "VisuAlgo and Graphviz are super helpful for DFS/BFS visualization.",
  "I'm confused about the difference between dynamic programming and memoization.",
  "Memoization is top-down caching, while DP is usually bottom-up tabular iteration.",
  "Clear explanation! Thanks a lot.",
  "Reminder: TA review session starts in 15 minutes.",
  "On my way! Saving seats near the front.",
  "Good luck on the midterm everyone!",
  "Thanks! We got this!"
];

function generateMessagingCode(existing: Set<string>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  while (true) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!existing.has(code)) {
      existing.add(code);
      return code;
    }
  }
}

async function main() {
  console.log('========================================');
  console.log(' Starting Dataset Generation & Insertion');
  console.log(' Target: 10,000 Users, 5,000 Groups, 500,000 Messages');
  console.log('========================================\n');

  const startTime = Date.now();

  // 1. Fetch existing messaging_codes from DB to avoid collision
  console.log('[1/4] Checking existing messaging codes...');
  const dbCodes = await pool.query('SELECT messaging_code FROM users WHERE messaging_code IS NOT NULL');
  const existingCodes = new Set<string>(dbCodes.rows.map(r => r.messaging_code));

  // Pre-generate standard password hash once for performance
  console.log('Pre-computing bcrypt hash...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ----------------------------------------------------
  // 2. Generate 10,000 Users
  // ----------------------------------------------------
  console.log('[2/4] Generating & Inserting 10,000 users...');
  const userIds: string[] = [];
  const userBatchSize = 1000;
  let userCount = 0;

  for (let i = 0; i < 10000; i++) {
    userIds.push(crypto.randomUUID());
  }

  for (let b = 0; b < userIds.length; b += userBatchSize) {
    const chunk = userIds.slice(b, b + userBatchSize);
    const valueTuples: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (let i = 0; i < chunk.length; i++) {
      const idx = b + i + 1;
      const uId = chunk[i];
      const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const fullName = `${fn} ${ln}`;
      const email = `student_${idx}_${fn.toLowerCase()}.${ln.toLowerCase()}@stanford.edu`;
      const code = generateMessagingCode(existingCodes);
      const bio = BIOS[Math.floor(Math.random() * BIOS.length)];
      const avatarUrl = `https://images.unsplash.com/photo-${1500000000000 + (idx % 1000)}?w=150&auto=format&fit=crop`;
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 3600 * 1000)).toISOString();

      valueTuples.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      params.push(uId, email, passwordHash, fullName, avatarUrl, bio, code, createdAt, createdAt);
    }

    const queryText = `
      INSERT INTO users (id, email, password_hash, full_name, avatar_url, bio, messaging_code, created_at, updated_at)
      VALUES ${valueTuples.join(', ')}
      ON CONFLICT (email) DO NOTHING;
    `;
    await pool.query(queryText, params);
    userCount += chunk.length;
    process.stdout.write(`\r   -> Inserted ${userCount} / 10,000 users`);
  }
  console.log('\n   ✓ Users inserted successfully.');

  // ----------------------------------------------------
  // 3. Generate 5,000 Groups + Host Memberships
  // ----------------------------------------------------
  console.log('[3/4] Generating & Inserting 5,000 study groups & memberships...');
  const groupIds: string[] = [];
  const groupCreators: string[] = [];
  const groupBatchSize = 1000;
  let groupCount = 0;

  for (let i = 0; i < 5000; i++) {
    groupIds.push(crypto.randomUUID());
    // Pick random user as creator
    groupCreators.push(userIds[Math.floor(Math.random() * userIds.length)]);
  }

  // Insert Groups & Memberships in batches
  const groupMembersMap = new Map<string, string[]>(); // group_id -> sender_user_ids

  for (let b = 0; b < groupIds.length; b += groupBatchSize) {
    const chunkIds = groupIds.slice(b, b + groupBatchSize);
    const chunkCreators = groupCreators.slice(b, b + groupBatchSize);

    const groupValueTuples: string[] = [];
    const groupParams: any[] = [];
    let gPIdx = 1;

    const memberValueTuples: string[] = [];
    const memberParams: any[] = [];
    let mPIdx = 1;

    for (let i = 0; i < chunkIds.length; i++) {
      const idx = b + i + 1;
      const gId = chunkIds[i];
      const creatorId = chunkCreators[i];
      const subj = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
      const type = GROUP_TYPES[Math.floor(Math.random() * GROUP_TYPES.length)];
      const title = `${subj} - ${type} #${idx}`;
      const desc = `Official student study group for ${subj}. Collaborating on lecture material, assignments, and exam review.`;
      const isPublic = Math.random() > 0.15;
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 3600 * 1000)).toISOString();

      groupValueTuples.push(`($${gPIdx++}, $${gPIdx++}, $${gPIdx++}, $${gPIdx++}, $${gPIdx++}, $${gPIdx++}, $${gPIdx++})`);
      groupParams.push(gId, title, desc, isPublic, creatorId, createdAt, createdAt);

      // Add Host membership
      memberValueTuples.push(`($${mPIdx++}, $${mPIdx++}, 'host', $${mPIdx++})`);
      memberParams.push(gId, creatorId, createdAt);

      // Pick 5 to 15 additional member users for this group
      const memberCountForGroup = 5 + Math.floor(Math.random() * 11);
      const groupMembers: string[] = [creatorId];

      for (let m = 0; m < memberCountForGroup; m++) {
        const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
        if (!groupMembers.includes(randomUser)) {
          groupMembers.push(randomUser);
          memberValueTuples.push(`($${mPIdx++}, $${mPIdx++}, 'member', $${mPIdx++})`);
          memberParams.push(gId, randomUser, createdAt);
        }
      }

      groupMembersMap.set(gId, groupMembers);
    }

    // Insert study groups batch
    const groupQuery = `
      INSERT INTO study_groups (id, title, description, is_public, created_by, created_at, updated_at)
      VALUES ${groupValueTuples.join(', ')};
    `;
    await pool.query(groupQuery, groupParams);

    // Insert group memberships batch
    const memberQuery = `
      INSERT INTO group_memberships (group_id, user_id, role, joined_at)
      VALUES ${memberValueTuples.join(', ')}
      ON CONFLICT (group_id, user_id) DO NOTHING;
    `;
    await pool.query(memberQuery, memberParams);

    groupCount += chunkIds.length;
    process.stdout.write(`\r   -> Inserted ${groupCount} / 5,000 groups`);
  }
  console.log('\n   ✓ Groups & Memberships inserted successfully.');

  // ----------------------------------------------------
  // 4. Generate 500,000 Sample Messages
  // ----------------------------------------------------
  console.log('[4/4] Generating & Inserting 500,000 sample group messages...');
  const totalMessages = 500000;
  const msgBatchSize = 5000;
  let insertedMessages = 0;

  for (let b = 0; b < totalMessages; b += msgBatchSize) {
    const valueTuples: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    const countInBatch = Math.min(msgBatchSize, totalMessages - b);

    for (let i = 0; i < countInBatch; i++) {
      const msgId = crypto.randomUUID();
      const randomGroupId = groupIds[Math.floor(Math.random() * groupIds.length)];
      const members = groupMembersMap.get(randomGroupId) || userIds;
      const senderId = members[Math.floor(Math.random() * members.length)];
      const content = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 3600 * 1000)).toISOString();

      valueTuples.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      params.push(msgId, randomGroupId, senderId, content, createdAt);
    }

    const msgQuery = `
      INSERT INTO group_messages (id, group_id, sender_id, content, created_at)
      VALUES ${valueTuples.join(', ')};
    `;
    await pool.query(msgQuery, params);

    insertedMessages += countInBatch;
    process.stdout.write(`\r   -> Inserted ${insertedMessages.toLocaleString()} / 500,000 messages`);
  }

  console.log('\n   ✓ Messages inserted successfully.');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n========================================');
  console.log(` SUCCESS! Dataset successfully generated and inserted into database in ${durationSec}s.`);
  console.log('========================================\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error during dataset generation:', err);
  process.exit(1);
});
