// Headless Chrome browser check for the Stage 3 gate (owner: Letta, Stage 3).
// Drives the running dev server through the Chrome DevTools Protocol with no extra npm dependency:
//   1. loads the app at 375 px, 768 px and 1280 px, checks no horizontal scroll, saves screenshots;
//   2. zooms the Planning Table in, drags it right, left, up and down, and checks the map moved;
//   3. taps Reset view and checks the framing returns;
//   4. collects console errors.
//
// Usage: start the app first (`npm run dev`), then run `npm run browser-check` from app/.
// Output: docs/images/stage3/{phone,tablet,desktop}.png and a JSON summary on stdout.
// CHROME_PATH can override the Chrome executable, APP_URL the page URL.

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";



const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUTPUT_DIR = path.join(REPO_ROOT, "docs", "images", "stage3");
const APP_URL = process.env.APP_URL ?? "http://localhost:5173/";
const CHROME_PATH = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9333;

const VIEWPORTS = [
    { name: "phone", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
];

// Marker labels rendered by Drei <Html>; a Knot label is a reliable screen-space reference point.
const KNOT_LABELS = ["Sulfur stones", "Channel west edge", "Boxwork first view", "Boxwork ridge", "Boxwork hollow"];



class CdpClient {
    constructor(webSocketUrl) {
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        this.socket = new WebSocket(webSocketUrl);

        this.socket.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.id !== undefined) {
                const entry = this.pending.get(message.id);
                if (entry !== undefined) {
                    this.pending.delete(message.id);
                    if (message.error !== undefined) {
                        entry.reject(new Error(`${message.error.message} (${message.error.code})`));
                    } else {
                        entry.resolve(message.result);
                    }
                }
                return;
            }
            const listener = this.listeners.get(message.method);
            if (listener !== undefined) {
                listener(message.params);
            }
        });

        this.ready = new Promise((resolve, reject) => {
            this.socket.addEventListener("open", () => resolve());
            this.socket.addEventListener("error", () => reject(new Error("CDP WebSocket failed")));
        });
    }

    on(method, listener) {
        this.listeners.set(method, listener);
    }

    async send(method, params = {}) {
        await this.ready;
        const id = this.nextId;
        this.nextId += 1;
        const response = new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });
        this.socket.send(JSON.stringify({ id, method, params }));
        return response;
    }

    close() {
        this.socket.close();
    }
}



async function fetchJson(url) {
    const response = await fetch(url);
    return response.json();
}



async function waitForDebugPort(port, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            return await fetchJson(`http://127.0.0.1:${port}/json/version`);
        } catch (error) {
            await delay(200);
        }
    }
    throw new Error(`Chrome did not open the debug port ${port}`);
}



function launchChrome() {
    const userDataDir = path.join(tmpdir(), `ariadne-chrome-${Date.now()}`);
    const child = spawn(
        CHROME_PATH,
        [
            "--headless=new",
            `--remote-debugging-port=${DEBUG_PORT}`,
            `--user-data-dir=${userDataDir}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--window-size=1280,800",
            "about:blank",
        ],
        { stdio: "ignore" },
    );
    return child;
}



function createClientFactory(cdp) {
    async function evaluate(expression) {
        const result = await cdp.send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (result.exceptionDetails !== undefined) {
            throw new Error(result.exceptionDetails.text);
        }
        return result.result.value;
    }

    async function waitFor(expression, description, timeoutMs = 30000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const value = await evaluate(expression);
            if (value === true) {
                return;
            }
            await delay(150);
        }
        throw new Error(`Timed out waiting for ${description}`);
    }

    return { evaluate, waitFor };
}



async function waitForLoadedScene(evaluate, waitFor) {
    await waitFor(
        `window.__ariadneStore !== undefined && window.__ariadneStore.getState().processedData !== null`,
        "the processed data to load",
    );
    // An unattached r3f canvas stays at its default 300 x 150 drawing buffer, so any larger size
    // means the canvas has measured its container. The threshold is below the narrowest viewport (375 px).
    await waitFor(
        `(() => {
            const canvas = document.querySelector("canvas");
            return canvas !== null && canvas.width > 320 && canvas.height > 200;
        })()`,
        "the 3D canvas to size itself",
    );
    // Drei <Html> marker labels only exist after the frame that projects them, and the first
    // screenshot can catch the canvas before the camera zoom is applied (headless Chrome is slow).
    await waitFor(
        `document.querySelectorAll("button[title]").length >= 5`,
        "the Knot marker labels",
    );
    await waitForStableMarker(evaluate);
}



async function waitForStableMarker(evaluate, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let previous = null;
    while (Date.now() < deadline) {
        const rect = await evaluate(markerRectExpression());
        if (rect !== null && previous !== null && rect.x === previous.x && rect.y === previous.y) {
            return;
        }
        previous = rect;
        await delay(300);
    }
    throw new Error("The map markers did not settle");
}



function markerRectExpression() {
    const titles = JSON.stringify(KNOT_LABELS);
    return `(() => {
        const labels = ${titles};
        const buttons = Array.from(document.querySelectorAll("button[title]")).filter((button) => labels.includes(button.title));
        if (buttons.length === 0) {
            return null;
        }
        const button = buttons[buttons.length - 1];
        const rect = button.getBoundingClientRect();
        return { title: button.title, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()`;
}



function layoutExpression() {
    return `(() => {
        const aside = document.querySelector('aside[aria-label="Controls"]');
        const main = document.querySelector("main");
        const heading = document.querySelector(".ariadne-display");
        const bodyStyle = getComputedStyle(document.body);
        return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            aside: aside === null ? null : aside.getBoundingClientRect().toJSON(),
            main: main === null ? null : main.getBoundingClientRect().toJSON(),
            displayFont: heading === null ? null : getComputedStyle(heading).fontFamily,
            bodyFont: bodyStyle.fontFamily,
            background: bodyStyle.backgroundColor,
        };
    })()`;
}



async function drag(cdp, fromX, fromY, toX, toY) {
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: fromX,
        y: fromY,
        button: "left",
        buttons: 1,
        clickCount: 1,
    });
    const steps = 8;
    for (let step = 1; step <= steps; step++) {
        const x = fromX + ((toX - fromX) * step) / steps;
        const y = fromY + ((toY - fromY) * step) / steps;
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
        await delay(20);
    }
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: toX,
        y: toY,
        button: "left",
        buttons: 0,
        clickCount: 1,
    });
    await delay(250);
}



async function main() {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const chrome = launchChrome();
    let cdp = null;
    const results = { viewports: [], panning: null, consoleErrors: [] };

    try {
        await waitForDebugPort(DEBUG_PORT);
        const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const pageTarget = targets.find((target) => target.type === "page");
        if (pageTarget === undefined) {
            throw new Error("Chrome opened without a page target");
        }

        cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
        await cdp.ready;
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
        await cdp.send("Log.enable");

        cdp.on("Runtime.consoleAPICalled", (params) => {
            if (params.type === "error") {
                results.consoleErrors.push(params.args.map((argument) => argument.value ?? argument.description ?? "").join(" "));
            }
        });
        cdp.on("Runtime.exceptionThrown", (params) => {
            results.consoleErrors.push(params.exceptionDetails.text);
        });
        cdp.on("Log.entryAdded", (params) => {
            if (params.entry.level === "error") {
                results.consoleErrors.push(params.entry.text);
            }
        });

        const { evaluate, waitFor } = createClientFactory(cdp);

        for (const viewport of VIEWPORTS) {
            await cdp.send("Emulation.setDeviceMetricsOverride", {
                width: viewport.width,
                height: viewport.height,
                deviceScaleFactor: 1,
                mobile: false,
            });
            await cdp.send("Page.navigate", { url: APP_URL });
            await waitForLoadedScene(evaluate, waitFor);
            const layout = await evaluate(layoutExpression());
            const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
            await writeFile(path.join(OUTPUT_DIR, `${viewport.name}.png`), Buffer.from(screenshot.data, "base64"));
            results.viewports.push({ ...viewport, layout });
        }

        // Panning check on the desktop viewport.
        await cdp.send("Emulation.setDeviceMetricsOverride", {
            width: 1280,
            height: 800,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await cdp.send("Page.navigate", { url: APP_URL });
        await waitForLoadedScene(evaluate, waitFor);

        const initialRect = await evaluate(markerRectExpression());
        if (initialRect === null) {
            throw new Error("No Knot marker label found for the panning check");
        }

        // Zoom in three steps at the map centre, so a 100 px drag is clearly visible.
        for (let step = 0; step < 3; step++) {
            await cdp.send("Input.dispatchMouseEvent", {
                type: "mouseWheel",
                x: 760,
                y: 420,
                deltaX: 0,
                deltaY: -500,
            });
            await delay(250);
        }
        const zoomedRect = await evaluate(markerRectExpression());

        await drag(cdp, 700, 400, 820, 480);
        const afterRightDown = await evaluate(markerRectExpression());
        await drag(cdp, 820, 480, 580, 220);
        const afterLeftUp = await evaluate(markerRectExpression());

        await evaluate(`(() => {
            const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent.trim().toLowerCase() === "reset view");
            if (button === undefined) {
                return false;
            }
            button.click();
            return true;
        })()`);
        await delay(600);
        const afterReset = await evaluate(markerRectExpression());

        const rightDownDx = afterRightDown.x - zoomedRect.x;
        const rightDownDy = afterRightDown.y - zoomedRect.y;
        const leftUpDx = afterLeftUp.x - afterRightDown.x;
        const leftUpDy = afterLeftUp.y - afterRightDown.y;
        const resetDx = Math.abs(afterReset.x - initialRect.x);
        const resetDy = Math.abs(afterReset.y - initialRect.y);

        results.panning = {
            marker: initialRect.title,
            initialRect,
            zoomedRect,
            afterRightDown,
            afterLeftUp,
            afterReset,
            passed:
                Math.abs(rightDownDx) > 20 &&
                Math.abs(rightDownDy) > 20 &&
                Math.abs(leftUpDx) > 20 &&
                Math.abs(leftUpDy) > 20 &&
                resetDx < 30 &&
                resetDy < 30,
            deltas: { rightDownDx, rightDownDy, leftUpDx, leftUpDy, resetDx, resetDy },
        };

        const panScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
        await writeFile(path.join(OUTPUT_DIR, "desktop_after_panning_check.png"), Buffer.from(panScreenshot.data, "base64"));
    } finally {
        if (cdp !== null) {
            cdp.close();
        }
        chrome.kill();
    }

    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);

    const noHorizontalScroll = results.viewports.every(
        (entry) => entry.layout.scrollWidth <= entry.layout.innerWidth,
    );
    const panningPassed = results.panning !== null && results.panning.passed;
    if (noHorizontalScroll === false || panningPassed === false || results.consoleErrors.length > 0) {
        process.exitCode = 1;
    }
}



main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
});
