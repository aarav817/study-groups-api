# Study Groups API
The backend REST API and worker for the Study Groups platform. It handles authentication, database management, event scheduling, and background job processing.
Corresponding Frontend: [study-groups-fe](https://github.com/aarav817/study-groups-fe)
## Tech Stack
- **Runtime & Server:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL
- **Caching & Queue:** Redis
- **Deployment:** Railway
## Key Architecture & Features
- **Modular REST API Architecture:** Segregated routes for authentication, groups, memberships, events, materials, messaging, and reporting.
- **Security & Auth:** Password hashing via bcrypt, session token verification.
- **Asynchronous Processing:** Email and notification worker implemented through Redis to handle non-essential tasks. 
