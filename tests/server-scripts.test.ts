import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const UPDATE = path.join(ROOT, "scripts", "update-server.sh");
const BACKUP = path.join(ROOT, "scripts", "backup-data.sh");
const VERIFY = path.join(ROOT, "scripts", "verify-data.mjs");

const has = (command: string) => spawnSync("sh", ["-c", `command -v ${command}`]).status === 0;
const toolsReady = has("bash") && has("flock") && has("git") && has("rsync") && has("tar");

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), "lh-server-scripts-"));
after(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

let counter = 0;
const fresh = (name: string) => {
	const dir = path.join(SCRATCH, `${name}-${counter++}`);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
};
const write = (file: string, content: string) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
};
const read = (file: string) => fs.readFileSync(file, "utf8");

const GIT_ENV = {
	GIT_CONFIG_GLOBAL: "/dev/null",
	GIT_CONFIG_NOSYSTEM: "1",
	GIT_AUTHOR_NAME: "t",
	GIT_AUTHOR_EMAIL: "t@example.invalid",
	GIT_COMMITTER_NAME: "t",
	GIT_COMMITTER_EMAIL: "t@example.invalid",
};
const git = (cwd: string, ...args: string[]) =>
	execFileSync("git", args, { cwd, env: { ...process.env, ...GIT_ENV }, encoding: "utf8" }).trim();

type Run = { status: number; out: string };
const run = (script: string, args: string[], env: Record<string, string>): Run => {
	const result = spawnSync("bash", [script, ...args], {
		env: { ...process.env, ...GIT_ENV, ...env },
		encoding: "utf8",
	});
	return { status: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
};

describe("verify-data.mjs", () => {
	it("lists the JSON files and lines that do not parse, and nothing else", () => {
		const dir = fresh("verify");
		write(path.join(dir, "ok.json"), '{"a":1}');
		write(path.join(dir, "bad.json"), '{"a":');
		write(path.join(dir, "log.jsonl"), '{"a":1}\nnot json\n\n{"b":2}\nalso not\n');
		write(path.join(dir, "notes.txt"), "{ not checked");
		const out = execFileSync("node", [VERIFY, dir], { encoding: "utf8" }).trim().split("\n");
		assert.deepEqual(
			out.sort(),
			["# 3 JSON files read, 2 with problems", "bad.json\tjson\t1", "log.jsonl\tjsonl\t2"].sort(),
		);
	});
});

describe("backup-data.sh", { skip: !toolsReady }, () => {
	const setup = () => {
		const home = fresh("backup-home");
		write(path.join(home, "data/profiles/slovak/progress.json"), '{"xp":10}');
		write(path.join(home, "data/profiles/slovak/lessons/2026-11-01.jsonl"), '{"a":1}\n{"a":2}\n');
		write(path.join(home, "data/audio/clip.mp3"), "audio-bytes");
		write(path.join(home, "keys/auth.json"), '{"KEY":"x"}');
		write(path.join(home, "sheets/slovak/mine.txt"), "# Mine\nahoj | | hello\n");
		return { home, env: { LANNA_HOME: home, LANNA_REPO: fresh("backup-repo"), LANNA_BACKUP_RETRY_SECONDS: "0" } };
	};
	const snapshots = (home: string) =>
		fs
			.readdirSync(path.join(home, "backups"))
			.filter((name) => /^\d{8}T\d{6}Z$/.test(name))
			.sort();
	const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1100));

	it("writes a snapshot of data, keys and sheets with a report, and points latest at it", () => {
		const { home, env } = setup();
		const result = run(BACKUP, ["backup"], env);
		assert.equal(result.status, 0, result.out);
		const [name] = snapshots(home);
		assert.ok(name);
		const snapshot = path.join(home, "backups", name);
		assert.equal(read(path.join(snapshot, "data/profiles/slovak/progress.json")), '{"xp":10}');
		assert.equal(read(path.join(snapshot, "keys/auth.json")), '{"KEY":"x"}');
		assert.equal(read(path.join(snapshot, "sheets/slovak/mine.txt")), "# Mine\nahoj | | hello\n");
		assert.match(read(path.join(snapshot, "VERIFY.tsv")), /# \d+ JSON files read, 0 with problems/);
		assert.equal(fs.readlinkSync(path.join(home, "backups/latest")), name);
		assert.equal(fs.statSync(path.join(home, "backups")).mode & 0o077, 0);
	});

	it("shares unchanged files with the night before and stores changed ones apart", async () => {
		const { home, env } = setup();
		assert.equal(run(BACKUP, ["backup"], env).status, 0);
		await nextSecond();
		write(path.join(home, "data/profiles/slovak/progress.json"), '{"xp":20}');
		assert.equal(run(BACKUP, ["backup"], env).status, 0);
		const [first, second] = snapshots(home).map((name) => path.join(home, "backups", name));
		const clip = "data/audio/clip.mp3";
		assert.equal(fs.statSync(path.join(first!, clip)).ino, fs.statSync(path.join(second!, clip)).ino);
		const progress = "data/profiles/slovak/progress.json";
		assert.notEqual(fs.statSync(path.join(first!, progress)).ino, fs.statSync(path.join(second!, progress)).ino);
		assert.equal(read(path.join(first!, progress)), '{"xp":10}');
		assert.equal(read(path.join(second!, progress)), '{"xp":20}');
	});

	it("keeps only the newest snapshots", async () => {
		const { home, env } = setup();
		for (let i = 0; i < 3; i++) {
			assert.equal(run(BACKUP, ["backup", "--keep", "2"], env).status, 0);
			await nextSecond();
		}
		assert.equal(snapshots(home).length, 2);
	});

	it("exits 3 for a file that stopped parsing, keeps the snapshot, and is quiet about damage it has seen before", async () => {
		const { home, env } = setup();
		assert.equal(run(BACKUP, ["backup"], env).status, 0);
		write(path.join(home, "data/profiles/slovak/progress.json"), '{"xp":');
		await nextSecond();
		const damaged = run(BACKUP, ["backup"], env);
		assert.equal(damaged.status, 3, damaged.out);
		assert.match(damaged.out, /progress\.json/);
		const latest = path.join(home, "backups", fs.readlinkSync(path.join(home, "backups/latest")));
		assert.match(read(path.join(latest, "DAMAGED")), /progress\.json/);
		await nextSecond();
		const again = run(BACKUP, ["backup"], env);
		assert.equal(again.status, 0, again.out);
	});

	it("restores a snapshot into an empty folder only, and never into the live data", () => {
		const { home, env } = setup();
		assert.equal(run(BACKUP, ["backup"], env).status, 0);
		const target = path.join(fresh("restore"), "drill");
		const restored = run(BACKUP, ["restore", "latest", "--into", target], env);
		assert.equal(restored.status, 0, restored.out);
		assert.equal(read(path.join(target, "data/profiles/slovak/progress.json")), '{"xp":10}');
		assert.equal(read(path.join(target, "keys/auth.json")), '{"KEY":"x"}');
		assert.match(restored.out, /0 with problems/);
		assert.equal(run(BACKUP, ["restore", "latest", "--into", target], env).status, 1);
		assert.equal(run(BACKUP, ["restore", "latest", "--into", path.join(home, "data")], env).status, 1);
	});

	it("copies the snapshots to another folder with --push-to", () => {
		const { home, env } = setup();
		const mirror = fresh("mirror");
		const result = run(BACKUP, ["backup", "--push-to", mirror], env);
		assert.equal(result.status, 0, result.out);
		const [name] = snapshots(home);
		assert.equal(read(path.join(mirror, name!, "keys/auth.json")), '{"KEY":"x"}');
	});

	it("exits 4 when the push fails but still keeps the local snapshot", () => {
		const { home, env } = setup();
		const result = run(BACKUP, ["backup", "--push-to", "nobody@127.0.0.1:/nonexistent-lh-test"], {
			...env,
			RSYNC_RSH: "false",
		});
		assert.equal(result.status, 4, result.out);
		assert.equal(snapshots(home).length, 1);
	});
});

describe("update-server.sh", { skip: !toolsReady }, () => {
	const STUB = `#!/usr/bin/env bash
echo "$*" >>"$STUB_DIR/calls.log"
last="\${@: -1}"
case "$1" in
	image)
		case "$2" in
			inspect)
				if [ "$3" = "--format" ]; then grep -F "$last " "$STUB_DIR/labels" | head -n 1 | cut -d' ' -f2; exit 0; fi
				grep -qxF "$last" "$STUB_DIR/images"; exit $? ;;
			ls) sed -n 's/^[^:]*://p' "$STUB_DIR/images" ;;
			rm) grep -vxF "$3" "$STUB_DIR/images" >"$STUB_DIR/images.next" || true; mv "$STUB_DIR/images.next" "$STUB_DIR/images" ;;
		esac ;;
	build)
		[ -n "\${STUB_BUILD_FAIL:-}" ] && exit 1
		tag=""; revision=""
		while [ $# -gt 0 ]; do
			case "$1" in -t) tag="$2"; shift ;; --label) revision="\${2#org.opencontainers.image.revision=}"; shift ;; esac
			shift
		done
		{ echo "$tag"; cat "$STUB_DIR/images"; } >"$STUB_DIR/images.next"; mv "$STUB_DIR/images.next" "$STUB_DIR/images"
		echo "$tag $revision" >>"$STUB_DIR/labels" ;;
	run) exit "\${STUB_RUN_EXIT:-0}" ;;
	compose)
		case "$*" in
			*"up -d"*) echo "$LANNA_IMAGE" >"$STUB_DIR/running" ;;
			*"ps -q"*) [ -f "$STUB_DIR/running" ] && echo container1 ;;
			*"ps --format"*) echo "lanna Up" ;;
		esac ;;
	inspect)
		if [ "$(cat "$STUB_DIR/running" 2>/dev/null)" = "\${STUB_UNHEALTHY_IMAGE:-none}" ]; then echo unhealthy; else echo healthy; fi ;;
esac
exit 0
`;

	let bin: string;
	before(() => {
		bin = fresh("bin");
		write(path.join(bin, "docker"), STUB);
		fs.chmodSync(path.join(bin, "docker"), 0o755);
	});

	const setup = () => {
		const origin = path.join(fresh("origin"), "origin.git");
		fs.mkdirSync(origin);
		git(origin, "init", "-q", "--bare", "--initial-branch=main");
		const seed = fresh("seed");
		git(seed, "init", "-q", "--initial-branch=main");
		write(path.join(seed, "compose.yaml"), "services: {}\n");
		write(path.join(seed, ".dockerignore"), "node_modules\n");
		write(path.join(seed, "curriculum/slovak/cheatsheets/animal-hospital.txt"), "# Animal hospital\nv1\n");
		git(seed, "add", "-A");
		git(seed, "commit", "-q", "-m", "first");
		git(seed, "remote", "add", "origin", origin);
		git(seed, "push", "-q", "origin", "main");
		const checkout = path.join(fresh("checkout"), "repo");
		execFileSync("git", ["clone", "-q", origin, checkout], { env: { ...process.env, ...GIT_ENV } });
		const home = fresh("home");
		const stub = fresh("stub");
		write(path.join(stub, "images"), "");
		write(path.join(stub, "labels"), "");
		const env = {
			PATH: `${bin}:${process.env.PATH}`,
			STUB_DIR: stub,
			LANNA_HOME: home,
			LANNA_REPO: checkout,
			LANNA_HEALTH_POLL_SECONDS: "0",
		};
		const commit = (file: string, content: string, message = "change") => {
			write(path.join(seed, file), content);
			git(seed, "add", "-A");
			git(seed, "commit", "-q", "-m", message);
			git(seed, "push", "-q", "origin", "main");
			return git(seed, "rev-parse", "HEAD");
		};
		const calls = () =>
			fs.existsSync(path.join(stub, "calls.log")) ? read(path.join(stub, "calls.log")).split("\n").filter(Boolean) : [];
		const running = () => (fs.existsSync(path.join(stub, "running")) ? read(path.join(stub, "running")).trim() : "");
		const images = () => read(path.join(stub, "images")).split("\n").filter(Boolean);
		return { origin, seed, checkout, home, stub, env, commit, calls, running, images };
	};
	const builds = (calls: string[]) => calls.filter((line) => line.startsWith("build "));
	const short = (sha: string) => sha.slice(0, 12);

	it("builds the commit, boot-checks the image, switches to it and records it", () => {
		const s = setup();
		const sha = git(s.checkout, "rev-parse", "origin/main");
		const result = run(UPDATE, [], s.env);
		assert.equal(result.status, 0, result.out);
		const tag = `lanna:${short(sha)}`;
		assert.equal(builds(s.calls()).length, 1);
		assert.ok(
			s
				.calls()
				.some(
					(line) =>
						line.startsWith("run ") &&
						line.includes(tag) &&
						line.includes("--network none") &&
						line.includes("boot-check.mjs"),
				),
		);
		assert.equal(s.running(), tag);
		assert.equal(read(path.join(s.home, "state/deployed")).trim(), sha);
		assert.match(read(path.join(s.checkout, ".env")), new RegExp(`^LANNA_IMAGE=${tag}$`, "m"));
		assert.match(read(path.join(s.home, "logs/update.log")), /now running/);
	});

	it("does nothing when the commit is already deployed", () => {
		const s = setup();
		assert.equal(run(UPDATE, [], s.env).status, 0);
		const before = s.calls().length;
		const again = run(UPDATE, [], s.env);
		assert.equal(again.status, 0, again.out);
		assert.equal(builds(s.calls()).length, 1);
		assert.equal(s.calls().filter((line) => line.includes("up -d")).length, 1);
		assert.ok(s.calls().length >= before);
	});

	it("changes nothing with --dry-run", () => {
		const s = setup();
		const result = run(UPDATE, ["--dry-run"], s.env);
		assert.equal(result.status, 0, result.out);
		assert.match(result.out, /dry run: would build/);
		assert.equal(builds(s.calls()).length, 0);
		assert.equal(s.running(), "");
		assert.equal(fs.existsSync(path.join(s.home, "state/deployed")), false);
	});

	it("keeps the running version when the build fails, and does not retry the same commit", () => {
		const s = setup();
		const failed = run(UPDATE, [], { ...s.env, STUB_BUILD_FAIL: "1" });
		assert.equal(failed.status, 4, failed.out);
		assert.equal(s.running(), "");
		const attempts = builds(s.calls()).length;
		const again = run(UPDATE, [], s.env);
		assert.equal(again.status, 0, again.out);
		assert.match(again.out, /failed before/);
		assert.equal(builds(s.calls()).length, attempts);
		const forced = run(UPDATE, ["--force"], s.env);
		assert.equal(forced.status, 0, forced.out);
		assert.equal(builds(s.calls()).length, attempts + 1);
		assert.ok(s.running().startsWith("lanna:"));
	});

	it("does not switch when the boot check fails", () => {
		const s = setup();
		assert.equal(run(UPDATE, [], s.env).status, 0);
		const first = s.running();
		s.commit("curriculum/slovak/note.txt", "x");
		const failed = run(UPDATE, [], { ...s.env, STUB_RUN_EXIT: "1" });
		assert.equal(failed.status, 5, failed.out);
		assert.equal(s.running(), first);
		assert.equal(s.calls().filter((line) => line.includes("up -d")).length, 1);
	});

	it("goes back to the previous image when the new container never becomes healthy", () => {
		const s = setup();
		assert.equal(run(UPDATE, [], s.env).status, 0);
		const first = s.running();
		const second = s.commit("curriculum/slovak/note.txt", "x");
		const result = run(UPDATE, [], { ...s.env, STUB_UNHEALTHY_IMAGE: `lanna:${short(second)}` });
		assert.equal(result.status, 6, result.out);
		assert.equal(s.running(), first);
		assert.equal(read(path.join(s.home, "state/deployed")).trim(), git(s.seed, "rev-parse", "HEAD~1"));
	});

	it("rolls back to the previous image and does not deploy the rolled-back commit again", () => {
		const s = setup();
		const first = git(s.checkout, "rev-parse", "origin/main");
		assert.equal(run(UPDATE, [], s.env).status, 0);
		const second = s.commit("curriculum/slovak/note.txt", "x");
		assert.equal(run(UPDATE, [], s.env).status, 0);
		assert.equal(s.running(), `lanna:${short(second)}`);
		const rolled = run(UPDATE, ["rollback"], s.env);
		assert.equal(rolled.status, 0, rolled.out);
		assert.equal(s.running(), `lanna:${short(first)}`);
		assert.equal(read(path.join(s.home, "state/deployed")).trim(), first);
		const buildsBefore = builds(s.calls()).length;
		const after = run(UPDATE, [], s.env);
		assert.equal(after.status, 0, after.out);
		assert.match(after.out, /failed before/);
		assert.equal(builds(s.calls()).length, buildsBefore);
		assert.equal(s.running(), `lanna:${short(first)}`);
	});

	it("keeps the newest images and removes older ones, but never the running or the previous one", () => {
		const s = setup();
		assert.equal(run(UPDATE, [], s.env).status, 0);
		for (let i = 0; i < 4; i++) {
			s.commit(`curriculum/slovak/note-${i}.txt`, String(i));
			assert.equal(run(UPDATE, [], s.env).status, 0);
		}
		assert.equal(s.images().length, 3);
		assert.ok(s.images().includes(s.running()));
	});

	it("refuses a checkout with local changes", () => {
		const s = setup();
		write(path.join(s.checkout, "compose.yaml"), "changed\n");
		const result = run(UPDATE, [], s.env);
		assert.equal(result.status, 3, result.out);
		assert.equal(builds(s.calls()).length, 0);
	});

	it("leaves a second run alone while one is active", async () => {
		const s = setup();
		fs.mkdirSync(path.join(s.home, "state"), { recursive: true });
		const holder = spawn("flock", [path.join(s.home, "state/update.lock"), "sleep", "5"]);
		await new Promise((resolve) => setTimeout(resolve, 300));
		try {
			const result = run(UPDATE, [], s.env);
			assert.equal(result.status, 75, result.out);
			assert.equal(builds(s.calls()).length, 0);
		} finally {
			holder.kill();
		}
	});

	describe("cheatsheets", () => {
		const today = () => new Date().toISOString().slice(0, 10);

		it("pushes sheets edited on the server to a new branch, once, and never touches main", () => {
			const s = setup();
			write(path.join(s.home, "sheets/slovak/animal-hospital.txt"), "# Animal hospital\nv1 edited\n");
			write(path.join(s.home, "sheets/slovak/mine.txt"), "# Mine\nahoj | | hello\n");
			const mainBefore = git(s.origin, "rev-parse", "main");
			const result = run(UPDATE, [], s.env);
			assert.equal(result.status, 0, result.out);
			const branch = `sheets/${today()}`;
			assert.equal(
				git(s.origin, "show", `${branch}:curriculum/slovak/cheatsheets/animal-hospital.txt`),
				"# Animal hospital\nv1 edited",
			);
			assert.equal(git(s.origin, "show", `${branch}:curriculum/slovak/cheatsheets/mine.txt`), "# Mine\nahoj | | hello");
			assert.equal(git(s.origin, "rev-parse", "main"), mainBefore);
			assert.equal(git(s.origin, "rev-list", "--count", `main..${branch}`), "1");

			run(UPDATE, ["--force"], s.env);
			assert.equal(git(s.origin, "branch", "--list", "sheets/*").split("\n").length, 1);
		});

		it("pushes nothing when the sheets equal the repo's", () => {
			const s = setup();
			write(path.join(s.home, "sheets/slovak/animal-hospital.txt"), "# Animal hospital\nv1\n");
			assert.equal(run(UPDATE, [], s.env).status, 0);
			assert.equal(git(s.origin, "branch", "--list", "sheets/*"), "");
		});

		it("only says what it would push with --dry-run", () => {
			const s = setup();
			write(path.join(s.home, "sheets/slovak/mine.txt"), "# Mine\n");
			const result = run(UPDATE, ["--dry-run"], s.env);
			assert.equal(result.status, 0, result.out);
			assert.match(result.out, /would push 1 edited cheatsheet/);
			assert.equal(git(s.origin, "branch", "--list", "sheets/*"), "");
		});

		it("copies new and unedited repo sheets to the server, and keeps the ones edited there", () => {
			const s = setup();
			assert.equal(run(UPDATE, [], s.env).status, 0);
			assert.equal(read(path.join(s.home, "sheets/slovak/animal-hospital.txt")), "# Animal hospital\nv1\n");
			s.commit("curriculum/slovak/cheatsheets/animal-hospital.txt", "# Animal hospital\nv2\n");
			s.commit("curriculum/slovak/cheatsheets/shop.txt", "# Shop\n");
			assert.equal(run(UPDATE, [], s.env).status, 0);
			assert.equal(read(path.join(s.home, "sheets/slovak/animal-hospital.txt")), "# Animal hospital\nv2\n");
			assert.equal(read(path.join(s.home, "sheets/slovak/shop.txt")), "# Shop\n");

			write(path.join(s.home, "sheets/slovak/shop.txt"), "# Shop\nedited on the server\n");
			s.commit("curriculum/slovak/cheatsheets/shop.txt", "# Shop\nedited in the repo\n");
			assert.equal(run(UPDATE, [], s.env).status, 0);
			assert.equal(read(path.join(s.home, "sheets/slovak/shop.txt")), "# Shop\nedited on the server\n");
		});
	});
});
