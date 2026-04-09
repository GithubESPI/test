import { NextResponse } from 'next/server';
import swaggerJsdoc from 'swagger-jsdoc';

// app/api/docs/swagger.json/route.ts
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Bulletin ESPI',
      version: '1.0.0',
    },
  },
  // On scanne tous les fichiers .ts dans le dossier app/api
  apis: ['./app/api/**/*.ts'], 
};

const spec = swaggerJsdoc(options);

export async function GET() {
  return NextResponse.json(spec);
}