import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import Pokedex from 'pokedex-promise-v2';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

const app = express();
app.use(express.json());

const pokedex = new Pokedex();

const redisClient = createClient({
  url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

const JWT_SECRET = process.env.JWT_TOKEN_SECRET || 'placeholder-key';

// ============= Type Definitions =============

interface PokemonType {
  name: string;
  color: string;
}

interface PokemonMove {
  name: string;
  power?: number;
  type: PokemonType;
}

interface Pokemon {
  id: number;
  name: string;
  description: string;
  types: PokemonType[];
  moves: PokemonMove[];
  sprites: {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
    back_shiny: string | null;
  };
  stats: {
    hp: number;
    speed: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
  };
}

interface BoxEntry {
  id: string;
  createdAt: string;
  level: number;
  location: string;
  notes?: string;
  pokemonId: number;
}

// ============= Zod Schemas =============

const InsertBoxEntrySchema = z.object({
  createdAt: z.string().datetime(),
  level: z.number().int().min(1).max(100),
  location: z.string().min(1),
  notes: z.string().optional(),
  pokemonId: z.number().int().positive()
});

const UpdateBoxEntrySchema = z.object({
  createdAt: z.string().datetime().optional(),
  level: z.number().int().min(1).max(100).optional(),
  location: z.string().min(1).optional(),
  notes: z.string().optional(),
  pokemonId: z.number().int().positive().optional()
}).partial();

const BoxEntrySchema = InsertBoxEntrySchema.extend({
  id: z.string()
});

// ============= Type Color Mapping =============

const typeColors: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC'
};

// ============= Authentication Middleware =============

interface AuthRequest extends Request {
  pennkey?: string;
}

const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Missing authorization header'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid authorization header format'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { pennkey: string };
    req.pennkey = decoded.pennkey;
    next();
  } catch (error) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token'
    });
  }
};

// ============= Helper Functions =============

async function getPokemonDetails(name: string): Promise<Pokemon> {
  // fetch basic Pokemon data
  const pokemonData = await pokedex.getPokemonByName(name);
  
  // fetch species data for description
  const speciesData = await pokedex.getPokemonSpeciesByName(name);
  
  // get English description
  const englishFlavorText = speciesData.flavor_text_entries.find(
    (entry: any) => entry.language.name === 'en'
  );
  const description = englishFlavorText 
    ? englishFlavorText.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ')
    : 'No description available';

  // get English name
  const englishName = speciesData.names.find(
    (n: any) => n.language.name === 'en'
  );
  const displayName = englishName ? englishName.name : pokemonData.name;

  // process types
  const types: PokemonType[] = pokemonData.types.map((t: any) => ({
    name: t.type.name.toUpperCase(),
    color: typeColors[t.type.name] || '#68A090'
  }));

  // process moves (fetch first 10 moves in parallel)
  const movePromises = pokemonData.moves.slice(0, 10).map(async (m: any) => {
    try {
      const moveData = await pokedex.getMoveByName(m.move.name);
      const englishMoveName = moveData.names.find(
        (n: any) => n.language.name === 'en'
      );
      
      const move: PokemonMove = {
        name: englishMoveName ? englishMoveName.name : moveData.name,
        type: {
          name: moveData.type.name.toUpperCase(),
          color: typeColors[moveData.type.name] || '#68A090'
        }
      };
      
      if (moveData.power && moveData.power > 0) {
        move.power = moveData.power;
      }
      
      return move;
    } catch (error) {
      return null;
    }
  });

  const moves = (await Promise.all(movePromises)).filter((m): m is PokemonMove => m !== null);

  // process stats
  const stats = {
    hp: pokemonData.stats.find((s: any) => s.stat.name === 'hp')?.base_stat || 0,
    speed: pokemonData.stats.find((s: any) => s.stat.name === 'speed')?.base_stat || 0,
    attack: pokemonData.stats.find((s: any) => s.stat.name === 'attack')?.base_stat || 0,
    defense: pokemonData.stats.find((s: any) => s.stat.name === 'defense')?.base_stat || 0,
    specialAttack: pokemonData.stats.find((s: any) => s.stat.name === 'special-attack')?.base_stat || 0,
    specialDefense: pokemonData.stats.find((s: any) => s.stat.name === 'special-defense')?.base_stat || 0
  };

  return {
    id: pokemonData.id,
    name: displayName,
    description,
    types,
    moves,
    sprites: {
      front_default: pokemonData.sprites.front_default || null,
      back_default: pokemonData.sprites.back_default || null,
      front_shiny: pokemonData.sprites.front_shiny || null,
      back_shiny: pokemonData.sprites.back_shiny || null
    },
    stats
  };
}

// ============= Routes =============

// token generation endpoint
app.post('/token', (req: Request, res: Response) => {
  const { pennkey } = req.body;

  if (!pennkey) {
    return res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'pennkey is required'
    });
  }

  const token = jwt.sign({ pennkey }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// get Pokemon list
app.get('/pokemon/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);

    if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Invalid limit or offset parameters'
      });
    }

    const listResponse = await pokedex.getPokemonsList({ limit, offset });
    
    // fetch details for each Pokemon in parallel
    const pokemonPromises = listResponse.results.map((p: any) => 
      getPokemonDetails(p.name)
    );
    
    const pokemonList = await Promise.all(pokemonPromises);
    res.json(pokemonList);
  } catch (error) {
    console.error('Error fetching Pokemon list:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch Pokemon list'
    });
  }
});

// get Pokemon by name
app.get('/pokemon/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Pokemon name is required'
      });
    }

    const pokemon = await getPokemonDetails(name.toLowerCase());
    res.json(pokemon);
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Pokemon not found'
      });
    }
    console.error('Error fetching Pokemon:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch Pokemon'
    });
  }
});

// list Box entries
app.get('/box/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pattern = `${req.pennkey}:pokedex:*`;
    const keys = await redisClient.keys(pattern);
    
    const ids = keys.map(key => key.split(':')[2]);
    res.json(ids);
  } catch (error) {
    console.error('Error listing Box entries:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to list Box entries'
    });
  }
});

// create Box entry
app.post('/box/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = InsertBoxEntrySchema.parse(req.body);
    
    const id = createId();
    const boxEntry: BoxEntry = {
      id,
      ...validatedData
    };

    const key = `${req.pennkey}:pokedex:${id}`;
    await redisClient.set(key, JSON.stringify(boxEntry));

    res.status(201).json(boxEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Invalid request body',
        errors: error.errors
      });
    }
    console.error('Error creating Box entry:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create Box entry'
    });
  }
});

// get Box entry by ID
app.get('/box/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const key = `${req.pennkey}:pokedex:${id}`;
    
    const data = await redisClient.get(key);
    
    if (!data) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Box entry not found'
      });
    }

    const boxEntry = JSON.parse(data);
    res.json(boxEntry);
  } catch (error) {
    console.error('Error fetching Box entry:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch Box entry'
    });
  }
});

// update Box entry
app.put('/box/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const key = `${req.pennkey}:pokedex:${id}`;
    
    const existingData = await redisClient.get(key);
    
    if (!existingData) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Box entry not found'
      });
    }

    const existingEntry = JSON.parse(existingData);
    const updateData = UpdateBoxEntrySchema.parse(req.body);
    
    const updatedEntry = {
      ...existingEntry,
      ...updateData
    };

    // validate the merged entry
    BoxEntrySchema.parse(updatedEntry);

    await redisClient.set(key, JSON.stringify(updatedEntry));
    res.json(updatedEntry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Invalid request body',
        errors: error.errors
      });
    }
    console.error('Error updating Box entry:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update Box entry'
    });
  }
});

// delete Box entry
app.delete('/box/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const key = `${req.pennkey}:pokedex:${id}`;
    
    const exists = await redisClient.exists(key);
    
    if (!exists) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Box entry not found'
      });
    }

    await redisClient.del(key);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting Box entry:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to delete Box entry'
    });
  }
});

// clear all Box entries
app.delete('/box/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pattern = `${req.pennkey}:pokedex:*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error clearing Box entries:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to clear Box entries'
    });
  }
});

// ============= Server Initialization =============

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();