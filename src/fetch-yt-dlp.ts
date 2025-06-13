import { copyFile, unlink, mkdir, chmod, rename } from "fs/promises";
import { createWriteStream } from "fs";
import { tmpdir, platform as osPlatform, arch as osArch } from "os";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";

const GH_API = "https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest";

/* ------------------------------------------------------------------ */
/*  platform / arch helpers                                           */
/* ------------------------------------------------------------------ */

type Plat = "linux" | "windows" | "macos";
type Arch = "x86_64" | "arm64" | "armv7l";

function getPlatform(): { plat: Plat; ext: "" | ".exe" } {
	switch (osPlatform()) {
		case "win32":
			return { plat: "windows", ext: ".exe" };
		case "darwin":
			return { plat: "macos", ext: "" };
		default:
			return { plat: "linux", ext: "" };
	}
}

function getArch(): Arch {
	const a = osArch(); // <-- **call** the function
	switch (a) {
		case "arm64":
			return "arm64";
		case "arm":
		case "armv7l":
		case "armv6l":
			return "armv7l";
		default:
			return "x86_64";
	}
}

function assetMatches(name: string, plat: Plat, arch: Arch, ext: string) {
	// Nightly asset patterns:
	//   yt-dlp_linux, yt-dlp_linux_arm64, yt-dlp_macos_x86_64, yt-dlp.exe …
	if (plat === "windows") return name.endsWith(".exe");
	return name === `yt-dlp${ext}` || name === `yt-dlp_${plat}` || name === `yt-dlp_${plat}_${arch}`;
}

/* ------------------------------------------------------------------ */
/*  main downloader                                                   */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
	const { plat, ext } = getPlatform();
	const arch = getArch();

	// 1. fetch release JSON
	const res = await fetch(GH_API);
	if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
	const release: any = await res.json();

	// 2. pick matching asset
	const asset = release.assets.find((a: any) => assetMatches(a.name, plat, arch, ext));
	if (!asset) throw new Error(`No yt-dlp asset for ${plat}/${arch}`);

	// 3. ensure ./bin exists
	await mkdir("bin", { recursive: true });

	const dest = path.join("bin", `yt-dlp${ext}`);
	const tmp = path.join(tmpdir(), `yt-dlp${ext}`);

	// 4. stream download → tmp
	const dl = await fetch(asset.browser_download_url);
	if (!dl.ok || !dl.body) throw new Error(`Download failed: ${dl.status} ${dl.statusText}`);

	const readable = Readable.fromWeb(dl.body as any);
	await pipeline(readable, createWriteStream(tmp));

	// 5. make executable & move into place
	try {
		await chmod(tmp, 0o755);
		await rename(tmp, dest);
	} catch (err: any) {
		if (err?.code !== "EXDEV") throw err;
		await copyFile(tmp, dest);
		await unlink(tmp);
	}
	console.log(`✓ yt-dlp nightly ${release.tag_name} → ${dest}`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
