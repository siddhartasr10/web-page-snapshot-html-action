"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const puppeteer = __importStar(require("puppeteer-core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function waitForPageStable(page, timeout = 30000) {
    const startTime = Date.now();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => { });
    const checkStable = async () => {
        const isStable = await page.evaluate(() => {
            const navEntry = performance.getEntriesByType('navigation')[0];
            return (document.readyState === 'complete' &&
                navEntry?.loadEventEnd > 0);
        });
        return isStable;
    };
    while (Date.now() - startTime < timeout) {
        const isStable = await checkStable();
        if (isStable) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const stillStable = await checkStable();
            if (stillStable) {
                return;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    core.warning('Page stability check timed out, proceeding with screenshot');
}
async function run() {
    try {
        const websites = fs.readFileSync(path.join(__dirname, "websites.txt")).toString()
            .trimEnd()
            .split("\n");
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
        core.info(`Launching browser with executable path: ${executablePath}`);
        const browser = await puppeteer.launch({
            executablePath: executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();
        let css = "", finishedSrcPaths = [];
        page.on('response', async (response) => {
            if (response.request().resourceType() !== 'stylesheet')
                return;
            css += await response.text();
        });
        const Rootdir = path.join(process.cwd(), 'sites');
        if (!fs.existsSync(Rootdir))
            fs.mkdirSync(Rootdir, { recursive: true });
        for (let i = 0; i < websites.length; i++) {
            css = "";
            await page.goto(websites[i], { waitUntil: 'domcontentloaded' });
            core.info(`Waiting for page: ${websites[i]} to stabilize...`);
            await waitForPageStable(page);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const pageTitle = await page.title();
            // const snapshotDir = path.join(process.cwd(), 'snapshots');
            const hostname = new URL(websites[i]).hostname;
            const sourceDir = path.join(Rootdir, hostname);
            if (!fs.existsSync(sourceDir))
                fs.mkdirSync(sourceDir, { recursive: true });
            // const filename = `snapshot-${timestamp}.png`;
            const htmlFilename = `${pageTitle}-${timestamp}.html`;
            const htmlPath = path.join(sourceDir, htmlFilename); // this was snapshotPath 
            let html = await page.content();
            const cssFilename = 'style.css';
            const cssPath = path.join(sourceDir, cssFilename);
            // We link all the css we get to the filename we gave the css.
            let htmlDOM = new DOMParser().parseFromString(html, "text/html");
            htmlDOM.head.append(`<link rel="stylesheet" href="${cssFilename}">`);
            html = htmlDOM.documentElement.outerHTML;
            // await page.screenshot({ path: snapshotPath, fullPage: true });
            fs.writeFileSync(htmlPath, html);
            fs.writeFileSync(cssPath, css);
            // const viewport = page.viewport();
            // const imageSize = `${viewport?.width || 1920}x${viewport?.height || 1080}`;
            finishedSrcPaths.push(sourceDir);
            core.info("Pushed source: " + pageTitle);
        }
        await browser.close();
        const time = new Date().toISOString();
        core.setOutput('source-paths', finishedSrcPaths);
        core.setOutput('time', time);
        core.setOutput('status', 'success');
        // core.setOutput('image-size', imageSize);
        // core.info(`Image size: ${imageSize}`);
        core.info(`Snapshot saved to: ${finishedSrcPaths}`);
        core.info(`Status: success`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.info("Where am I?" + `dirname: ${__dirname} and cwd: ${process.cwd()}`);
        core.setFailed(`Error: ${errorMessage}`);
        core.setOutput('status', 'failed');
        core.setOutput('time', new Date().toISOString());
        core.setOutput('snapshot-path', '');
        core.setOutput('image-size', '');
    }
}
run();
//# sourceMappingURL=main.js.map