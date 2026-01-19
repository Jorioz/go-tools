import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import https from "https";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream } from "fs";
import { Extract } from "unzipper";
import { splitRawShapes } from "../jobs/splitRawShapes.js";

/*
Scrapes data from gotransit.com to get latest up-to-date GTFS File data.
caches data to CACHE file, compares prev. to see if new download is necessary.
*/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isWindows = process.env.HOST_OS === "windows";
const UTILS_DIR = path.join(__dirname, "../utils");
const VENV_DIR = path.join(UTILS_DIR, ".venv");
const PY_EXE = isWindows
    ? path.join(VENV_DIR, "Scripts", "python.exe")
    : path.join(VENV_DIR, "bin", "python");
const PY_CMD = isWindows ? "python" : "python3";
const REQUIREMENTS_PATH = path.join(UTILS_DIR, "requirements.txt");
const SCRAPER_PATH = path.join(UTILS_DIR, "scraper.py");
const CACHE_DIR = path.join(__dirname, "../cache");
const CACHE_FILE = path.join(CACHE_DIR, "gtfs_data_cache.CACHE");
const GTFS_DIR = path.join(__dirname, "../../data/gtfs");
const TEMP_ZIP = path.join(CACHE_DIR, "gtfs_temp.zip");

interface GtfsData {
    url: string;
    last_updated: string | null;
}

export async function runGtfsDataConfig() {
    const result = runScraper();
    if (!result.success || !result.data) {
        console.error("Scraper failed or returned no data.");
        return;
    }

    let shouldUpdate = true;
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
            if (
                cached &&
                cached.data &&
                Array.isArray(cached.data) &&
                Array.isArray(result.data) &&
                JSON.stringify(cached.data) === JSON.stringify(result.data)
            ) {
                console.log("GTFS Data is up-to-date");
                shouldUpdate = false;
            }
        } catch (e) {
            console.warn("Could not read or parse cache, will update.");
        }
    }

    if (shouldUpdate) {
        console.log("GTFS data is outdated. Downloading new data...");
        const gtfsData = result.data as unknown as GtfsData[];

        if (gtfsData.length === 0) {
            console.error("No GTFS data URLs found");
            return;
        }

        const downloadUrl = gtfsData[0]!.url;

        try {
            await downloadGtfsData(downloadUrl);
            saveToCache(result);
            console.log("GTFS data updated successfully.");
        } catch (error) {
            console.error("Failed to download and extract GTFS data:", error);
        }
    }
    // To extract only train data into new file
    splitRawShapes();
}

async function downloadGtfsData(url: string): Promise<void> {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(GTFS_DIR)) {
        fs.mkdirSync(GTFS_DIR, { recursive: true });
    }

    console.log("Downloading GTFS zip file...");
    await downloadFile(url, TEMP_ZIP);
    console.log("Download complete.");

    console.log("Extracting GTFS data...");
    await extractZip(TEMP_ZIP, GTFS_DIR);
    console.log("Extraction complete.");

    console.log("Converting .txt files to .csv...");
    convertTxtToCsv(GTFS_DIR);
    console.log("Conversion complete.");

    fs.unlinkSync(TEMP_ZIP);
}

function downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(destination);
        https
            .get(url, (response) => {
                if (
                    response.statusCode === 302 ||
                    response.statusCode === 301
                ) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        file.close();
                        downloadFile(redirectUrl, destination)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }

                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    resolve();
                });
            })
            .on("error", (err) => {
                fs.unlinkSync(destination);
                reject(err);
            });
    });
}

async function extractZip(zipPath: string, destination: string): Promise<void> {
    await pipeline(createReadStream(zipPath), Extract({ path: destination }));
}

function convertTxtToCsv(directory: string): void {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        if (file.endsWith(".txt")) {
            const oldPath = path.join(directory, file);
            const newPath = path.join(directory, file.replace(".txt", ".csv"));
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed: ${file} -> ${file.replace(".txt", ".csv")}`);
        }
    }
}

function setupVenv(): boolean {
    // Check if venv python executable exists
    if (!fs.existsSync(PY_EXE)) {
        console.log("Creating venv...");
        console.log("Using python command:", PY_CMD);
        console.log("Venv directory:", VENV_DIR);

        const createVenv = spawnSync(PY_CMD, ["-m", "venv", VENV_DIR], {
            cwd: UTILS_DIR,
            stdio: "inherit",
        });

        console.log("Venv creation exit code:", createVenv.status);
        console.log("Venv creation error:", createVenv.error);

        if (createVenv.status !== 0 || createVenv.error) {
            console.error("Failed to create venv");
            return false;
        }

        // Verify the python executable was created
        if (!fs.existsSync(PY_EXE)) {
            console.error(
                "Venv created but python executable not found at:",
                PY_EXE,
            );
            return false;
        }
    }
    console.log("venv exists. Continuing...");

    // Check if requirements are already installed by looking for a marker
    const markerFile = path.join(VENV_DIR, ".requirements_installed");
    if (fs.existsSync(REQUIREMENTS_PATH) && !fs.existsSync(markerFile)) {
        console.log("Installing requirements.txt...");
        const installReqs = spawnSync(
            PY_EXE,
            ["-m", "pip", "install", "-r", REQUIREMENTS_PATH],
            {
                cwd: UTILS_DIR,
                stdio: "inherit",
            },
        );

        if (installReqs.status !== 0) {
            console.error("Failed to install requirements");
            return false;
        }

        // Create marker file to skip reinstalling next time
        fs.writeFileSync(markerFile, new Date().toISOString());
    }
    console.log("Requirements installed. Continuing....");
    return true;
}

function runScraper(): {
    success: boolean;
    data?: GtfsData[];
    error?: string;
} {
    if (!setupVenv()) {
        return { success: false, error: "Failed to setup Python environment" };
    }
    console.log("Python env setup success. Continuing...");

    console.log("Running scraper...");

    const result = spawnSync(PY_EXE, [SCRAPER_PATH], {
        cwd: UTILS_DIR,
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        return {
            success: false,
            error:
                result.stderr ||
                result.error?.message ||
                "failed to run scraper with unknown error",
        };
    }

    try {
        const data = JSON.parse(result.stdout) as GtfsData[];
        console.log("Complete!");
        return {
            success: true,
            data,
        };
    } catch (e) {
        return {
            success: false,
            error: `Failed to parse scraper output: ${e instanceof Error ? e.message : String(e)}`,
        };
    }
}

function saveToCache(data: unknown) {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
}
