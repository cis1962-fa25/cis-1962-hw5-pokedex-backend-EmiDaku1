## Activity B: You did NOT use AI

### Part 1

> Explain some improvement you want to make within your code. Perhaps you have a code block that could be more concise, or a part of your code could be improved with a library or be performed with a more efficient algorithm.

> My main issue is that I placed everything into the server.ts file because I didn't want to have to swap between multiple files within VSCode (so basically I was just lazy). In reality, if I were producing this code for a production environment, I would probably want multiple files for the assignment.

### Part 2

> Ask AI how to improve your code, by picking a part of your program you are interested in improving and asking something along the lines of "how can I improve this code?" This does not have to be verbatim; you could ask more specific questions for improvement, like "what JavaScript libraries could improve the efficiency of my code?" Screenshot or link the response.

> Prompt: I am creating a backend using EXPRESS endpoints and a redis local database. What can I do to improve my code? (I proceed to paste my server.ts file)

  Response: 1. Project Structure (Biggest Win)

Right now everything lives in server.ts. This will become painful as features grow.

Suggested structure:

src/
├── app.ts              # express app + middleware
├── server.ts           # startup only
├── routes/
│   ├── pokemon.ts
│   ├── box.ts
│   └── auth.ts
├── middleware/
│   └── authenticate.ts
├── services/
│   ├── pokemonService.ts
│   └── boxService.ts
├── schemas/
│   └── boxSchemas.ts
├── types/
│   └── pokemon.ts
├── utils/
│   ├── redis.ts
│   └── errors.ts


Why

Easier testing

Clear separation of concerns

Faster onboarding for teammates (or future-you)

2. Redis Usage: Avoid KEYS 🚨

You’re using:

redisClient.keys(`${req.pennkey}:pokedex:*`)


⚠️ This blocks Redis in production when key count grows.

Better: SCAN
let cursor = 0;
const keys: string[] = [];

do {
  const result = await redisClient.scan(cursor, {
    MATCH: `${req.pennkey}:pokedex:*`,
    COUNT: 100
  });
  cursor = Number(result.cursor);
  keys.push(...result.keys);
} while (cursor !== 0);


Why

Non-blocking

Production-safe

Scales to large datasets

3. Cache Pokémon Data (Huge Performance Boost)

getPokemonDetails():

Calls multiple PokeAPI endpoints

Fetches moves individually

Repeats work for every request

Add Redis caching:
const cacheKey = `pokemon:${name}`;

const cached = await redisClient.get(cacheKey);
if (cached) return JSON.parse(cached);

// fetch + process
await redisClient.setEx(cacheKey, 3600, JSON.stringify(pokemon));


Impact

⚡ Massive speed-up

💸 Less API usage

🔁 Consistent responses

If you want, I can:

Refactor this into a production-grade folder structure

Add tests (Jest + Supertest)

Add OpenAPI / Swagger

Optimize Pokémon fetching further

Just tell me 👍

### Part 3

> Evaluate the response the AI generates. You may need to do some research to do this evaluation, to see if the syntax generates correctly or if any libraries the AI suggests are appropriate for the current task. Report on whether the AI's solution fits within your project, or if it would need modifications to work properly.

> The project structure that the LLM provides is a lot cleaner and would work well, it would just require a lot of refactoring and importing between files. As for the redis keys, this make a lot of sense and still works directly with my code when I inject it, as it would make it faster when there are many different users that would connect to this server. Finally, the third change it provides again works when injected into my code and makes a lot of sense to speed up my getPokemonDetails() function, but again is just a speed improvement like the previous change. All in all, these solutions to improving the project were provided in a way that can be used immediately and did the job that the LLM said it would.
