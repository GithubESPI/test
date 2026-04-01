// app/api/myip/route.ts
export async function GET() {
  const response = await fetch("https://api.ipify.org?format=json");
  const data = await response.json();
  return Response.json(data);
}