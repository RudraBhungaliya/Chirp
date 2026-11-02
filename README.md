# Chirp 🐥

A real-time messaging web application featuring structured message syncing, media sharing, and presence tracking. Built with a full-stack architecture powered by **React 19**, **Tailwind CSS v4**, **Node.js/Express**, **Socket.io**, and **MongoDB**.

---

## 🏗️ System Architecture

Chirp is built on a decoupled, state-synchronized client-server model:

```mermaid
graph TD
    Client[React Client] <-->|Socket.io WebSockets| SocketServer[Socket.io Gateway]
    Client -->|HTTP REST| HTTPServer[Express HTTP Server]
    HTTPServer -->|Mongoose ORM| MongoDB[(MongoDB Persistence)]
    SocketServer -->|Mongoose ORM| MongoDB
```

---

## 🧩 Application Components

### Frontend Components (React Client)

- **Application Shell**:
  Manages the core page layout, authentication states, global Socket.io hooks, state routing, and active overlay modal states.

- **Conversation Directory**:
  Represents the left sidebar panel. It handles:
  - Displaying all active user contacts and recent chats.
  - Active search querying to filter user directories.
  - User presence status computations (online indicators and relative idle time indicators).
  - Draggable split-pane window resizing for user convenience.
  - Triggers for user profiles editing and session sign-outs.

- **Messaging Workspace**:
  Represents the main chat interface on the right. It manages:
  - Displaying individual conversation headers and message streams.
  - Distinguishing incoming messages from outgoing messages.
  - Displaying optimistic placeholders for outgoing messages.
  - Message input interfaces and multimedia file selection.

- **Profile Customizer**:
  An overlay screen enabling users to set up their username, display name, status bio, and upload custom avatars (converting images into lightweight Base64 data strings).

- **Google Authenticator Button**:
  Wraps Google Identity Services to handle OAuth2 authentication and transmit validation tokens to the backend.

---

### Backend Components (Express/Node Server)

- **Stateless HTTP Handlers (REST Controllers)**:
  - **Auth Controller**: Validates Google OAuth2 authentication credentials, registers new accounts, and signs local JWT tokens.
  - **User Controller**: Handles retrieval of profile details, onboarding setup, custom profile modifications, and directory database searches.
  - **Chat Controller**: Configures individual chat channels between participants, including self-conversations.
  - **Message Controller**: Coordinates text message creation, historical logs recovery, soft-deletion overrides, and media attachment streams.

- **Stateful Event Handlers (Socket.io Gateway)**:
  - Intercepts connection events and verifies JWT authentication handshake credentials.
  - Updates and broadcasts user presence flags (online/offline) in real-time.
  - Directs websocket channels by letting clients subscribe to or leave specific chat room streams.
  - Listens to incoming websocket triggers, persists payloads, and broadcasts messages to active room subscribers.

---

## 🔌 Protocols & Event Routing (Which Protocol Does What)

Chirp uses a dual-protocol networking pipeline (HTTP and WebSockets) to balance data integrity with low latency.

```
       [ React Client ]
        /            \
       /              \
  (HTTP / REST)   (WebSockets)
     /                  \
   Stateful Actions,    Low-Latency Updates,
   Data Operations      Presence, Messaging
     /                  \
[ Express Server ]   [ Socket.io Gateway ]
```

### 1. HTTP / REST Protocol
Used for **stateless transactions**, configurations, credentials verification, and large media streams:

| Action Category | HTTP Method & Path | Description |
| :--- | :--- | :--- |
| **Authentication** | `POST /api/auth/google` | Transmits Google OAuth tokens to the server for JWT creation. |
| **User Directory** | `GET /api/users/me` <br> `GET /api/users` <br> `GET /api/users/search` | Fetches active user session, user list, and fuzzy search queries. |
| **Profile Configuration**| `POST /api/users/complete-profile` <br> `PUT /api/users/profile` | Handles profile initialization and updates. |
| **Chat Management** | `GET /api/chats` <br> `POST /api/chats` | Retrieves existing chats or initiates new conversation channels. |
| **Message Retrieval** | `GET /api/message/:chatId` | Retrieves chronological historical message logs for a chat room. |
| **Message Submission** | `POST /api/message/:chatId` | Submits standard text message payloads. |
| **Message Deletion** | `DELETE /api/message/:chatId/:messageId` | Triggers soft-deletion updates. |
| **Media Attachments** | `POST /api/message/:chatId/file` <br> `GET /api/message/file/:id` | Uploads files to database storage streams and serves them to client views. |

### 2. WebSockets (Socket.io) Protocol
Used for **stateful, bi-directional, real-time events** where latency is critical:

| Event Name | Direction | Protocol Role |
| :--- | :--- | :--- |
| `connection` | Client $\rightarrow$ Server | Initiates session, verifies JWT authentication handshake, and sets status to online. |
| `join_chat` | Client $\rightarrow$ Server | Subscribes the client's socket session to a specific chat room channel. |
| `leave_chat` | Client $\rightarrow$ Server | Unsubscribes the client's socket session from a chat room channel. |
| `send_message` | Client $\rightarrow$ Server | Sends real-time messages directly over the socket stream for database persistence. |
| `new_message` | Server $\rightarrow$ Client | Broadcasts newly received text or media messages to all active channel subscribers. |
| `presence_update` | Server $\rightarrow$ Client | Broadcasts real-time availability states (online status and last-active times) to all users. |
| `disconnect` | Client $\rightarrow$ Server | Terminates session, marks user offline, and updates last-seen timestamps. |

---

## 🔑 Environment Variables Specification

### Server Environment Variables (`server/.env`)
| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `5001` | Port the Express/Socket.IO backend listens on. Defaults to `5001` to prevent macOS AirPlay conflicts. |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`). |
| `MONGO_URI` | **Yes** | `mongodb://127.0.0.1:27017/chirp` | MongoDB connection URI (e.g. MongoDB Atlas cluster string or local Docker container). |
| `JWT_SECRET` | **Yes** (Prod) | `chirp_dev_jwt_secret_key...` | High-entropy secret key for signing JSON Web Tokens. |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration period (`7d`, `24h`, `30d`). |
| `GOOGLE_CLIENT_ID` | No | `""` | Google OAuth 2.0 Web Client ID from Google Cloud Console. Leave blank for instant local Dev accounts. |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,...` | Comma-delimited list of trusted client origins for CORS and Socket.IO. |
| `MAX_FILE_SIZE_MB` | No | `50` | Maximum allowed attachment file size in megabytes. |

### Client Environment Variables (`client/.env`)
| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | No | `http://localhost:5001` | Full backend REST API URL. Proxied by Vite in dev mode. |
| `VITE_SOCKET_URL` | No | `http://localhost:5001` | WebSocket gateway URL for Socket.IO real-time events. |
| `VITE_GOOGLE_CLIENT_ID` | No | `""` | Google OAuth Web Client ID (matches server). If omitted, quick dev accounts are activated. |

---

## 🛠️ Operational & Low-Latency Design

- **Persistent Connection Pooling**: Mongoose manages a persistent pool (`minPoolSize: 5`, `maxPoolSize: 20`) to eliminate cold TCP handshakes on queries.
- **Sub-10ms Cursor Pagination**: Messages are fetched using reverse-chronological compound indexes (`{ chatId: 1, createdAt: -1 }`), eliminating memory spikes on large threads.
- **HTTP 206 Partial Content (Range Streaming)**: Media files stored in GridFS are served with `Accept-Ranges: bytes` and `Cache-Control: public, max-age=31536000, immutable`, enabling instantaneous playback and scrub-seeking on desktop and mobile browsers.
- **Multi-Device Presence Tracking**: Sockets maintain a user-to-socket set map (`userSockets.get(userId).size`), ensuring that users with multiple browser tabs or devices are never prematurely marked offline.
- **Real-Time Typing & Read Receipts**: High-efficiency Socket.IO events (`user_typing`, `typing_stop`, `messages_read`) provide instantaneous UI feedback without database write overhead on every keystroke.
- **Lightweight Artisanal UI**: Crisp, light-mode palette (slate & pure white, subtle borders, high-clarity typography) without dark-mode AI cliches or bulky dependencies.

---

## ⚙️ Setup & Installation

### Quick Start (Single Command)
Install dependencies and run both frontend and backend concurrently from the root directory:
```bash
# 1. Install workspace dependencies
pnpm install

# 2. Run both server (port 5001) & client (port 5173) in dev mode
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

> [!NOTE]
> The backend runs on port `5001` by default to prevent port conflicts with macOS ControlCenter / AirPlay on port `5000`.

### Database Configuration (MongoDB)
Set your `MONGO_URI` in `server/.env`:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/Chirp
```
Or start a local MongoDB instance with Docker:
```bash
docker compose up -d
```

### 1. Server Configuration
Navigate to the server directory:
```bash
cd server
pnpm install
```
Create a `.env` file in the `server/` directory (or use default created from `.env.example`):
```env
PORT=5001
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/Chirp
JWT_SECRET=your_jwt_secret_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```
Start the backend server:
```bash
pnpm dev
```

### 2. Client Configuration
Navigate to the client directory:
```bash
cd ../client
pnpm install
```
Create a `.env` file in the `client/` directory:
```env
VITE_API_URL=http://localhost:5001
VITE_SOCKET_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```
Start the frontend application:
```bash
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
