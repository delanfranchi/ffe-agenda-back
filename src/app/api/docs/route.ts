import { getSwaggerSpec } from "@/lib/swagger";

export async function GET() {
  try {
    const spec = await getSwaggerSpec();
    return Response.json(spec);
  } catch (error) {
    console.error("Error generating Swagger spec:", error);
    return Response.json(
      { error: "Failed to generate API documentation" },
      { status: 500 }
    );
  }
}
