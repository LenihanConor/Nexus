import { execFile } from "node:child_process";

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

let gitLock: Promise<void> = Promise.resolve();

function withGitLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = gitLock;
  let resolve: () => void;
  gitLock = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

export function execGit(
  cwd: string,
  args: string[],
  timeoutMs = 30_000,
): Promise<GitResult> {
  return withGitLock(() =>
    new Promise<GitResult>((resolve) => {
      execFile(
        "git",
        args,
        { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout?.toString() ?? "",
            stderr: stderr?.toString() ?? "",
            exitCode: error ? (error as NodeJS.ErrnoException & { code?: number }).code === undefined
              ? ("killed" in error && error.killed ? 124 : 1)
              : 1
              : 0,
          });
        },
      );
    }),
  );
}

export async function detectMainBranch(projectPath: string): Promise<string> {
  const symRef = await execGit(projectPath, [
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
    "--short",
  ]);

  if (symRef.exitCode === 0 && symRef.stdout.trim()) {
    const ref = symRef.stdout.trim();
    return ref.replace(/^origin\//, "");
  }

  const mainCheck = await execGit(projectPath, ["rev-parse", "--verify", "main"]);
  if (mainCheck.exitCode === 0) return "main";

  const masterCheck = await execGit(projectPath, ["rev-parse", "--verify", "master"]);
  if (masterCheck.exitCode === 0) return "master";

  return "main";
}
