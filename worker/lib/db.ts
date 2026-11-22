/** Small D1 helpers shared by the services. */

export async function rows<T>(statement: D1PreparedStatement): Promise<T[]> {
  return (await statement.all<T>()).results;
}

/** A JSON array for `json_each(?)`, the way a list of ids is bound to one parameter. */
export const idList = (ids: readonly number[]): string => JSON.stringify(ids);

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
