import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** The minimum scrypt cost in OWASP's Password Storage Cheat Sheet: N = 2^17, r = 8, p = 1. */
export const SCRYPT_DEFAULT = { N: 131_072, r: 8, p: 1, keyLength: 32, saltBytes: 16 } as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

export type ScryptParams = { N: number; r: number; p: number; keyLength: number; saltBytes: number };

export type PasswordRecord = {
	version: 1;
	algo: "scrypt";
	N: number;
	r: number;
	p: number;
	keyLength: number;
	salt: string;
	hash: string;
	changedAt: string;
};

/** Node's scrypt refuses to use more than 32 MiB unless told; N = 2^17 with r = 8 needs 128 MiB. */
function maxMemory(N: number, r: number): number {
	return 128 * N * r * 2;
}

function derive(
	password: string,
	salt: Buffer,
	params: Pick<ScryptParams, "N" | "r" | "p" | "keyLength">,
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password.normalize("NFKC"),
			salt,
			params.keyLength,
			{ N: params.N, r: params.r, p: params.p, maxmem: maxMemory(params.N, params.r) },
			(err, key) => (err ? reject(err) : resolve(key)),
		);
	});
}

export function passwordProblem(password: unknown): string | null {
	if (typeof password !== "string") return "Enter a password.";
	if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
	if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
	return null;
}

export async function hashPassword(
	password: string,
	params: ScryptParams = SCRYPT_DEFAULT,
	at: Date = new Date(),
): Promise<PasswordRecord> {
	const salt = randomBytes(params.saltBytes);
	const key = await derive(password, salt, params);
	return {
		version: 1,
		algo: "scrypt",
		N: params.N,
		r: params.r,
		p: params.p,
		keyLength: params.keyLength,
		salt: salt.toString("hex"),
		hash: key.toString("hex"),
		changedAt: at.toISOString(),
	};
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
	if (password.length > PASSWORD_MAX_LENGTH) return false;
	const key = await derive(password, Buffer.from(record.salt, "hex"), record);
	const wanted = Buffer.from(record.hash, "hex");
	return key.length === wanted.length && timingSafeEqual(key, wanted);
}

export function isPasswordRecord(value: unknown): value is PasswordRecord {
	const r = value as Partial<PasswordRecord> | null;
	if (!r || r.version !== 1 || r.algo !== "scrypt") return false;
	const power = (n: unknown) =>
		typeof n === "number" && Number.isInteger(n) && n >= 2 ** 10 && n <= 2 ** 20 && (n & (n - 1)) === 0;
	const small = (n: unknown, max: number) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max;
	return (
		power(r.N) &&
		small(r.r, 16) &&
		small(r.p, 4) &&
		small(r.keyLength, 64) &&
		typeof r.salt === "string" &&
		/^[0-9a-f]{16,}$/.test(r.salt) &&
		typeof r.hash === "string" &&
		/^[0-9a-f]+$/.test(r.hash) &&
		typeof r.changedAt === "string"
	);
}
