import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/db', { recursive: true });
cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
cpSync('src/openapi.yaml', 'dist/openapi.yaml');
cpSync('src/domain/fixtures', 'dist/domain/fixtures', { recursive: true });

console.log('copied: migrations, openapi.yaml, fixtures → dist/');
