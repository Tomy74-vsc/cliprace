export type AppRole = "brand" | "creator" | "admin";

export function assertRole(role: string | null | undefined, allowed: AppRole[]) {
	if (!role || !allowed.includes(role as AppRole)) {
		throw new Error("Forbidden");
	}
}


