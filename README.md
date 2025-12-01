[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/xQMXz_i6)
# HW5: Pokedex Backend

In this homework, you will be implementing a backend service in Express that provides a Pokedex API for managing Pokemon data and user Box entries. It will:
- Provides endpoints for fetching Pokemon data
- Manages user Box entries with authentication
- Handles CRUD operations for Box entries
- Validates requests and returns appropriate error responses

This homework is heavily related to HW4, but does not require homework 4 to function. Essentially, you will be building the backend that we had provided you within HW4. By the end of this assignment, you should be able to run your Express server and get the same results you would with our provided API server.

**API Documentation:** See [API.md](./API.md) for complete endpoint details, request/response formats, and type definitions.


## Core Requirements

Your backend implementation must provide the following:

- [ ] Implement Pokemon endpoints (list and get by name)
- [ ] Implement Box endpoints (list, create, get, update, delete, clear)
- [ ] Handle JWT authentication for Box endpoints
- [ ] Validate request parameters and request bodies
- [ ] Return appropriate error responses
- [ ] Persist Box entries per user (scoped by pennkey) using Redis
- [ ] Generate unique IDs for Box entries using CUID2 or equivalent
- [ ] Provide a proper `.env.example` file with instructions on using Redis cloud or Redis locally

## Installation

### Dependencies
This homework requires the following dependencies:
- typescript
- zod (for any validation tasks)
- express
- jsonwebtoken
- pokedex-promise-v2
- redis
- @paralleldrive/cuid2 (for generating unique IDs)

### Setup Requirements
Your backend must use `express`, with `jsonwebtoken` for authorization, and `redis` for data persistence. You may choose to either use a Redis cloud database or a local Redis database.

Follow the instructions provided during lecture to install and setup all three of these items. If you choose to use a Redis cloud database, please use a `.env` file and provide a `.env.example` file for instructors to use during grading.

## Endpoints, Types, & Models

### API Endpoint Structure

Your backend should implement the following endpoints as documented in [API.md](./API.md):

**Pokemon Endpoints** (no authentication required):
- `GET /pokemon/` - List Pokemon with pagination
- `GET /pokemon/:name` - Get Pokemon by name

**Box Endpoints** (authentication required):
- `GET /box/` - List all Box entry IDs for authenticated user
- `POST /box/` - Create a new Box entry
- `GET /box/:id` - Get a specific Box entry
- `PUT /box/:id` - Update a Box entry
- `DELETE /box/:id` - Delete a Box entry
- `DELETE /box/` - Clear all Box entries for authenticated user

### Data Models

Define data models that match the API response types. Reference the type definitions in [API.md](./API.md):

**Core Types:**
- `Pokemon` - Complete Pokemon data with stats, sprites, types, and moves
- `PokemonType` - Type information with name and color
- `PokemonMove` - Move information with name, power, and type
- `BoxEntry` - Complete Box entry with all fields
- `InsertBoxEntry` - Box entry data for creation (without `id`)
- `UpdateBoxEntry` - Partial Box entry data for updates

**Box Entry Schema:**
- `id: string` - Unique identifier (CUID2-generated)
- `createdAt: string` - ISO 8601 date string
- `level: number` - Level between 1 and 100
- `location: string` - Catch location
- `notes?: string` - Optional notes
- `pokemonId: number` - Pokemon ID

## Guidelines

### Pokemon Data Synthesis

**Important:** Some Pokemon endpoints require calling multiple endpoints from the `pokedex-promise-v2` library and synthesizing the results into a single response. The Pokemon API client does not provide a single endpoint that returns all the data needed for your API responses. You should refer to the API Docs to see which data is required for each endpoint.

**For `GET /pokemon/:name`:**

This endpoint requires synthesizing data from multiple `pokedex-promise-v2` API calls:

1. **`getPokemonByName(name)`** - Returns basic Pokemon data including:
   - ID, sprites, types, stats
   - Move references (names only, not full move data)

2. **`getPokemonSpeciesByName(name)`** - Returns species data including:
   - Flavor text entries (for description)
   - Localized names (for proper English name)

3. **`getMoveByName(moveName)`** - For each move in the Pokemon's move list:
   - Fetch full move details including power and type
   - Extract localized English name from move data

**For `GET /pokemon/` (List):**

This endpoint also requires multiple API calls:

1. **`getPokemonsList({ limit, offset })`** - Returns a paginated list of Pokemon references (names only)

2. For each Pokemon in the list, call `GET /pokemon/:name` (or the equivalent service method) to get full Pokemon data

**Performance Considerations:**
- Use `Promise.all()` to fetch multiple Pokemon or moves in parallel
- Consider caching Pokemon data to avoid redundant API calls
- Handle errors gracefully if any individual API call fails

### Authentication Middleware

Implement a POST /token route that:
- Extracts a 'user' from the body of the POST request
- Handles missing 'user' or body
- Generates and signs a token using your own `JWT_TOKEN_SECRET` environment variable (use [this link](https://generate-secret.vercel.app/32) to help generate a secret key)

Implement authentication middleware that:

**Token Extraction:**
- Extracts JWT token from `Authorization` header
- Expects format: `Authorization: Bearer <token>`
- Handles missing or malformed headers

**Token Validation:**
- Verifies JWT token signature
- Validates token expiration
- Extracts user information (pennkey) from token payload

**Error Handling:**
- Returns `401 UNAUTHORIZED` if token is missing
- Returns `401 UNAUTHORIZED` if token is invalid or expired
- Returns `401 UNAUTHORIZED` if token format is incorrect

**Context Passing:**
- Adds authenticated user information (pennkey) to request context
- Makes user information available to Box endpoint handlers

### Box Entry Operations

**Create Box Entry:**
1. Validate request body against `InsertBoxEntry` schema
2. Generate unique ID (CUID2)
3. Create complete `BoxEntry` with generated ID
4. Store entry with key: `{pennkey}:pokedex:{id}`
5. Return created entry with `201 CREATED`

**Get Box Entry:**
1. Extract entry ID from path parameter
2. Retrieve entry from storage using `{pennkey}:pokedex:{id}`
3. Verify entry exists
4. Verify entry belongs to authenticated user
5. Return entry with `200 OK` or `404 NOT_FOUND`

**List Box Entries:**
1. Query all keys matching pattern: `{pennkey}:pokedex:*`
2. Extract entry IDs from keys
3. Return array of unique entry IDs with `200 OK`

**Update Box Entry:**
1. Validate request body against `UpdateBoxEntry` schema
2. Retrieve existing entry
3. Verify entry exists and belongs to user
4. Merge update fields with existing entry
5. Validate merged entry against `BoxEntry` schema
6. Store updated entry
7. Return updated entry with `200 OK`

**Delete Box Entry:**
1. Extract entry ID from path parameter
2. Verify entry exists and belongs to user
3. Delete entry from storage
4. Return `204 NO CONTENT`

**Clear All Box Entries:**
1. Query all keys matching pattern: `{pennkey}:pokedex:*`
2. Delete all matching entries
3. Return `204 NO CONTENT`

### Data Persistence

**Storage Strategy:**
- Store Box entries in a persistent storage system (Redis, database, etc.)
- Use user-scoped keys: `{pennkey}:pokedex:{entryId}`
- Ensure data isolation between users

**ID Generation:**
- Generate unique IDs for Box entries using CUID2 or similar
- Ensure IDs are collision-resistant
- Return generated ID in created response

**Data Retrieval:**
- `GET /box/` should return only entry IDs (not full entries)
- `GET /box/:id` should return complete entry data
- Filter entries by user's pennkey to ensure data isolation

## Validation, Errors, and Testing

### Request Validation

**Query Parameter Validation:**
- `GET /pokemon/` requires `limit` and `offset` as numbers
- Validate `limit > 0` and `offset >= 0`
- Return `400 BAD_REQUEST` for invalid parameters

**Path Parameter Validation:**
- `GET /pokemon/:name` requires valid name string
- `GET /box/:id`, `PUT /box/:id`, `DELETE /box/:id` require valid ID string
- Return `400 BAD_REQUEST` for invalid path parameters

**Request Body Validation:**
- `POST /box/` requires valid `InsertBoxEntry`:
  - `createdAt`: valid ISO 8601 string
  - `level`: number between 1 and 100
  - `location`: non-empty string
  - `notes`: optional string
  - `pokemonId`: valid number
- `PUT /box/:id` requires valid `UpdateBoxEntry` (all fields optional)
- Return `400 BAD_REQUEST` for invalid request bodies

**Business Logic Validation:**
- Validate that Box entry exists before update/delete
- Validate that Box entry belongs to authenticated user
- Return `404 NOT_FOUND` if entry doesn't exist
- Return `403 FORBIDDEN` if user tries to access another user's entry

### Error Handling

**Error Response Format:**
Return errors in the format specified in [API.md](./API.md):

```typescript
{
  code: string;        // Error code (e.g., "UNAUTHORIZED")
  message: string;     // Human-readable error message
}
```

**HTTP Status Codes:**
- `200 OK` - Successful GET, PUT requests
- `201 CREATED` - Successful POST requests
- `204 NO CONTENT` - Successful DELETE requests
- `400 BAD_REQUEST` - Invalid request parameters or body
- `401 UNAUTHORIZED` - Missing or invalid authentication token
- `403 FORBIDDEN` - Insufficient permissions
- `404 NOT_FOUND` - Resource not found
- `409 CONFLICT` - Resource conflict
- `500 INTERNAL_SERVER_ERROR` - Server error

**Error Scenarios:**
- Missing required fields → `400 BAD_REQUEST`
- Invalid field types → `400 BAD_REQUEST`
- Invalid field values (e.g., level < 1 or > 100) → `400 BAD_REQUEST`
- Missing authentication token → `401 UNAUTHORIZED`
- Invalid/expired token → `401 UNAUTHORIZED`
- Box entry not found → `404 NOT_FOUND`
- Database/storage errors → `500 INTERNAL_SERVER_ERROR`

### Test Considerations

**Authentication:**
- Missing Authorization header
- Invalid token format
- Expired token
- Invalid token signature
- Valid token with correct user context

**Pokemon Endpoints:**
- List with valid pagination parameters
- List with invalid parameters (negative, non-numeric)
- Get by valid name
- Get by invalid name (not found)

**Box Endpoints:**
- Create with all required fields
- Create with optional fields
- Create with invalid data (missing fields, invalid types, out of range)
- Get existing entry
- Get non-existent entry
- Get entry belonging to different user
- Update with partial fields
- Update non-existent entry
- Delete existing entry
- Delete non-existent entry
- List entries for authenticated user
- Clear all entries

**Edge Cases:**
- Very long strings in location/notes
- Boundary values (level 1, level 100)
- Special characters in input fields
- Concurrent requests for same resource
- Empty Box (no entries)

**Error Handling:**
- Network failures
- Storage/database errors
- Invalid JSON in request body
- Missing required headers



## Additional Considerations

### Security Considerations

**Authentication:**
- Never log or expose JWT tokens
- Validate token signature and expiration
- Extract and validate user information from token
- Handle token errors securely (don't leak token details)

**Data Isolation:**
- Always scope Box entries by user's pennkey
- Verify ownership before any Box operation
- Prevent users from accessing other users' entries
- Use user-scoped storage keys

**Input Validation:**
- Validate all inputs before processing
- Sanitize string inputs to prevent injection attacks
- Enforce type constraints strictly
- Validate ranges (e.g., level 1-100)
- Validate date formats (ISO 8601)

**Error Messages:**
- Don't expose internal implementation details
- Provide clear error messages for validation failures
- Don't leak information about other users' data
- Log errors server-side without exposing to client

### Performance Considerations

**Data Fetching:**
- Use efficient queries for listing Box entries
- Consider pagination for large result sets (if needed)
- Cache Pokemon data if fetching from external API
- Use parallel processing for multiple Box entry fetches when needed

**Storage:**
- Use efficient storage patterns (indexed lookups)
- Optimize key patterns for fast queries
- Consider connection pooling for database/storage connections

**Response Times:**
- Return responses promptly
- Handle timeouts appropriately
- Consider async processing for long operations

### Additional Resources

- **API Documentation:** See [API.md](./API.md) for complete API reference
- **Type Definitions:** All request/response types are documented in the [API.md](./API.md)
- **Example Requests:** Curl examples are provided in the [API.md](./API.md) for testing endpoints

### Common Pitfalls

**Pokemon Data Synthesis:**
- Attempting to get all Pokemon data from a single `pokedex-promise-v2` call
- Not fetching move details separately (moves in Pokemon data are only references)
- Not fetching species data for descriptions and proper names
- Fetching moves sequentially instead of in parallel (causes slow responses)
- Not handling errors when individual API calls fail
- Forgetting to transform data to match your API's response schema

**Authentication:**
- Forgetting to extract token from Bearer prefix
- Not validating token expiration
- Not verifying user ownership of resources

**Data Isolation:**
- Forgetting to scope queries by pennkey
- Allowing users to access other users' entries
- Using incorrect key patterns in storage

**Validation:**
- Not validating all required fields
- Not checking field types
- Not enforcing business rules (e.g., level range)

**Error Handling:**
- Returning generic errors instead of specific ones
- Not returning proper HTTP status codes
- Exposing internal error details to clients
