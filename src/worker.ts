/**
 * Standalone worker process entry point.
 *
 * Run with:
 *   npm run worker        - Production mode
 *   npm run worker:dev    - Development mode with hot reload
 */

import { main } from './workers/index.js';

main();
