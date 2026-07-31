import 'dotenv/config';
import { parseEnv, type Env } from '@inventory-ms/config';

export const env: Env = parseEnv();
