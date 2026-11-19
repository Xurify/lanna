export function mediaBackupPath(file: string): string {
	return file.replace(/^profiles\/([a-z][a-z-]{1,31})\/videos\//, "profiles/$1/media/");
}
