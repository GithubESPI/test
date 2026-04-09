/**
 * @swagger
 * /api/health:
 * get:
 * summary: Vérifie la santé du serveur
 * description: Retourne le statut de l'API.
 * responses:
 * 200:
 * description: Serveur opérationnel
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * status:
 * type: string
 * example: ok
 */
export async function GET() {
  return Response.json({ status: 'ok' });
}