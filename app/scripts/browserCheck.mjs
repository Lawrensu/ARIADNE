// Headless Chrome browser check for the Stage 3 gate (owner: Letta, Stage 3).
// Drives the running dev server through the Chrome DevTools Protocol with no extra npm dependency:
//   1. loads the app at 375 px, 768 px and 1280 px, checks no horizontal scroll, saves screenshots;
//   2. zooms the Planning Table in, drags it right, left, up and down, and checks the map moved;
//   3. taps Reset view and checks the framing returns;
//   4. collects console errors.
//
//   5. (redesign, D-031) taps the zoom buttons and "Center on me" and checks the map reacts;
//   6. runs the demo scenario twice at 300x, recording each milestone's simulated time, and checks
//      the follow camera (follows, a drag pauses it, it resumes about 5 s later) during the first run.
//
// Usage: start the app first (`npm run dev`), then run `npm run browser-check` from app/.
// Output: docs/images/stage3/redesign_{phone,tablet,desktop}.png and a JSON summary on stdout.
// CHROME_PATH can override the Chrome executable, APP_URL the page URL, SCREENSHOT_PREFIX the file
// name prefix ("redesign_" by default; the Stage 3 shell screenshots before D-031 had none).

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
const SCREENSHOT_PREFIX = process.env.SCREENSHOT_PREFIX ?? "redesign_";
const ROVER_LABEL = "Rover (staging point)";

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



// Screen rectangle of the marker label with this exact title (null when it is not on screen).
function labelRectExpression(title) {
    return `(() => {
        const button = Array.from(document.querySelectorAll("button[title]")).find((candidate) => candidate.title === ${JSON.stringify(title)});
        if (button === undefined) {
            return null;
        }
        const rect = button.getBoundingClientRect();
        return { title: button.title, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()`;
}


// Distance in screen pixels between two Knot labels: grows when the map zooms in.
function knotSpacingExpression() {
    return `(() => {
        const first = Array.from(document.querySelectorAll("button[title]")).find((button) => button.title === "Boxwork first view");
        const second = Array.from(document.querySelectorAll("button[title]")).find((button) => button.title === "Boxwork ridge");
        if (first === undefined || second === undefined) {
            return null;
        }
        const a = first.getBoundingClientRect();
        const b = second.getBoundingClientRect();
        return Math.hypot(a.x - b.x, a.y - b.y);
    })()`;
}


function clickButtonExpression(accessibleName) {
    return `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.getAttribute("aria-label") === ${JSON.stringify(accessibleName)});
        if (button === undefined) {
            return false;
        }
        button.click();
        return true;
    })()`;
}


const DEMO_MATCH_TOLERANCE_SIM_SECONDS = 15;


function timesMatch(first, second, toleranceSeconds) {
    if (typeof first !== "number" || typeof second !== "number") {
        return false;
    }
    return Math.abs(first - second) <= toleranceSeconds;
}


// Same milestones and the same tasks, each within the tolerance.
function demoRunsMatch(first, second, toleranceSeconds) {
    for (const key of ["walk_started", "storm_alert", "reroute", "sheltered"]) {
        if (!timesMatch(first[key], second[key], toleranceSeconds)) {
            return false;
        }
    }
    const firstTasks = Object.keys(first.tasks).sort();
    const secondTasks = Object.keys(second.tasks).sort();
    if (JSON.stringify(firstTasks) !== JSON.stringify(secondTasks)) {
        return false;
    }
    for (const taskId of firstTasks) {
        if (!timesMatch(first.tasks[taskId], second.tasks[taskId], toleranceSeconds)) {
            return false;
        }
    }
    return true;
}


// Starts the demo from the gear menu and records, through a store subscription, the exact simulated
// time of each milestone (walk start, each task done, storm alert, reroute, sheltered) in
// window.__demoEvents. The speed is raised to 300x once the scenario has set its own speed.
function startDemoRecorderExpression() {
    return `(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const store = window.__ariadneStore;
        const events = { tasks: {} };
        window.__demoEvents = events;
        const record = (state) => {
            const sim = Math.round(state.simElapsedSeconds);
            if (events.walk_started === undefined && state.walkStartedAtSimSeconds !== null) {
                events.walk_started = sim;
            }
            for (const taskId of state.completedTaskIds) {
                if (events.tasks[taskId] === undefined) {
                    events.tasks[taskId] = sim;
                }
            }
            if (events.storm_alert === undefined && state.alerts.some((alert) => alert.alert_type === "solar_particle_event_alert")) {
                events.storm_alert = sim;
            }
            // The detour's own start time: the routed path arrives from the worker a little later (in
            // real time), but the walk is timed from this start.
            if (events.reroute === undefined && state.walkDetour !== null) {
                events.reroute = Math.round(state.walkDetour.started_at_sim_seconds);
            }
            if (events.sheltered === undefined && state.walkPhase === "sheltering") {
                events.sheltered = sim;
            }
        };
        const buttons = () => Array.from(document.querySelectorAll("button"));
        buttons().find((button) => button.getAttribute("aria-label") === "System menu").click();
        await sleep(300);
        buttons().find((button) => button.textContent.trim() === "Run demo scenario").click();
        for (let attempt = 0; attempt < 100 && !store.getState().isSimPlaying; attempt++) {
            await sleep(50);
        }
        store.subscribe(record);
        store.getState().setSimSpeedMultiplier(300);
        return true;
    })()`;
}


async function saveScreenshot(cdp, fileName) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(path.join(OUTPUT_DIR, `${SCREENSHOT_PREFIX}${fileName}`), Buffer.from(shot.data, "base64"));
}


// While the demo walks: the PLAN check step, the LAYERS popover with the Here card, and the 3D view
// with the astronaut figure (zoomed in around the followed astronaut). Slows the clock meanwhile.
async function captureWalkScreenshots(cdp, evaluate, waitFor) {
    await waitFor(`window.__ariadneStore.getState().walkPhase === "walking"`, "the walk to start", 60000);
    await evaluate(`window.__ariadneStore.getState().setSimSpeedMultiplier(10)`);

    await evaluate(`window.__ariadneStore.getState().setActiveMode("plan")`);
    await delay(900);
    await saveScreenshot(cdp, "desktop_plan.png");
    await evaluate(`window.__ariadneStore.getState().setActiveMode("map")`);

    await evaluate(`window.__ariadneStore.getState().setLayersPopoverOpen(true)`);
    await delay(900);
    await saveScreenshot(cdp, "desktop_layers.png");
    await evaluate(`window.__ariadneStore.getState().setLayersPopoverOpen(false)`);

    await evaluate(`window.__ariadneStore.getState().setViewMode("labyrinth_view")`);
    await delay(1200);
    await evaluate(`(() => { const state = window.__ariadneStore.getState(); state.requestZoomStep(1); state.requestZoomStep(1); state.requestZoomStep(1); state.requestZoomStep(1); return true; })()`);
    await delay(1500);
    await saveScreenshot(cdp, "desktop_3d_astronaut.png");
    await evaluate(`window.__ariadneStore.getState().setViewMode("planning_table")`);
    await evaluate(`window.__ariadneStore.getState().setSimSpeedMultiplier(300)`);
}


// During a walk: the camera follows; a drag pauses it; it resumes about 5 s after the drag ends.
async function followCheck(cdp, evaluate, waitFor) {
    await waitFor(`window.__ariadneStore.getState().walkPhase === "walking" && window.__ariadneStore.getState().isFollowingAstronaut`, "the walk to start and the camera to follow", 60000);
    // Slow the clock during the check so the walk is still going when following resumes.
    await evaluate(`window.__ariadneStore.getState().setSimSpeedMultiplier(10)`);
    const followingBeforeDrag = await evaluate(`window.__ariadneStore.getState().isFollowingAstronaut`);
    await drag(cdp, 760, 330, 620, 250);
    const pausedAfterDrag = await evaluate(`window.__ariadneStore.getState().followPausedByUser`);
    await delay(2500);
    const stillPausedAt2500Ms = await evaluate(`window.__ariadneStore.getState().followPausedByUser`);
    await delay(4000);
    const resumedAt6500Ms = await evaluate(`window.__ariadneStore.getState().isFollowingAstronaut`);
    await evaluate(`window.__ariadneStore.getState().setSimSpeedMultiplier(300)`);
    return {
        followingBeforeDrag,
        pausedAfterDrag,
        stillPausedAt2500Ms,
        resumedAt6500Ms,
        passed: followingBeforeDrag === true && pausedAfterDrag === true && stillPausedAt2500Ms === true && resumedAt6500Ms === true,
    };
}



function layoutExpression() {
    return `(() => {
        const tabBar = document.querySelector('nav[aria-label="Modes"]');
        const statusBar = document.querySelector('footer[aria-label="Status"]');
        const main = document.querySelector("main");
        const heading = document.querySelector(".ariadne-display");
        const bodyStyle = getComputedStyle(document.body);
        return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            tabBar: tabBar === null ? null : tabBar.getBoundingClientRect().toJSON(),
            statusBar: statusBar === null ? null : statusBar.getBoundingClientRect().toJSON(),
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
            await writeFile(path.join(OUTPUT_DIR, `${SCREENSHOT_PREFIX}${viewport.name}.png`), Buffer.from(screenshot.data, "base64"));
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

        await evaluate(clickButtonExpression("Reset view"));
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
        await writeFile(path.join(OUTPUT_DIR, `${SCREENSHOT_PREFIX}desktop_after_panning_check.png`), Buffer.from(panScreenshot.data, "base64"));

        // Control legend (D-031): zoom buttons change the spacing between two Knot labels, and
        // "Center on me" brings the rover (the astronaut before a walk) to the middle of the map.
        const spacingBefore = await evaluate(knotSpacingExpression());
        await evaluate(clickButtonExpression("Zoom in"));
        await delay(600);
        const spacingAfterZoomIn = await evaluate(knotSpacingExpression());
        await evaluate(clickButtonExpression("Zoom out"));
        await delay(600);
        const spacingAfterZoomOut = await evaluate(knotSpacingExpression());

        await drag(cdp, 700, 400, 900, 250);
        await evaluate(clickButtonExpression("Center on me"));
        await delay(800);
        const roverRect = await evaluate(labelRectExpression(ROVER_LABEL));
        const mapRect = await evaluate(`document.querySelector("main").getBoundingClientRect().toJSON()`);
        let roverOffsetFromCentre = null;
        if (roverRect !== null) {
            // The label sits just right of the marker glyph; its left edge is close to the marker.
            roverOffsetFromCentre = {
                dx: roverRect.x - (mapRect.x + mapRect.width / 2),
                dy: roverRect.y + roverRect.height / 2 - (mapRect.y + mapRect.height / 2),
            };
        }

        let controlsPassed = false;
        if (spacingBefore !== null && spacingAfterZoomIn !== null && spacingAfterZoomOut !== null && roverOffsetFromCentre !== null) {
            const zoomInGrew = spacingAfterZoomIn > spacingBefore * 1.3;
            const zoomOutShrank = spacingAfterZoomOut < spacingAfterZoomIn / 1.3;
            const roverCentred = Math.abs(roverOffsetFromCentre.dx) < 60 && Math.abs(roverOffsetFromCentre.dy) < 60;
            controlsPassed = zoomInGrew && zoomOutShrank && roverCentred;
        }
        results.controls = { spacingBefore, spacingAfterZoomIn, spacingAfterZoomOut, roverOffsetFromCentre, passed: controlsPassed };

        // Demo scenario twice (headless Chrome keeps animation frames running, unlike a hidden pane),
        // with the follow camera checked during the first run.
        results.demoRuns = [];
        for (let run = 1; run <= 2; run++) {
            await cdp.send("Page.navigate", { url: APP_URL });
            await waitForLoadedScene(evaluate, waitFor);
            await evaluate(startDemoRecorderExpression());
            if (run === 1) {
                results.follow = await followCheck(cdp, evaluate, waitFor);
            } else {
                await captureWalkScreenshots(cdp, evaluate, waitFor);
            }
            await waitFor(`window.__demoEvents.sheltered !== undefined`, "the demo to reach the shelter", 180000);
            results.demoRuns.push(await evaluate(`window.__demoEvents`));
        }
    } finally {
        if (cdp !== null) {
            cdp.close();
        }
        chrome.kill();
    }

    const noHorizontalScroll = results.viewports.every(
        (entry) => entry.layout.scrollWidth <= entry.layout.innerWidth,
    );
    const panningPassed = results.panning !== null && results.panning.passed;
    const controlsPassed = results.controls !== undefined && results.controls.passed;
    const followPassed = results.follow !== undefined && results.follow.passed;
    // Both demo runs must reach the same milestones at the same simulated time. Each milestone is seen
    // on the first frame after it happens; at 300x one frame is about 5 simulated seconds, hence the tolerance.
    let demoRepeatable = false;
    if (results.demoRuns !== undefined && results.demoRuns.length === 2) {
        demoRepeatable = demoRunsMatch(results.demoRuns[0], results.demoRuns[1], DEMO_MATCH_TOLERANCE_SIM_SECONDS);
    }
    results.demoRepeatable = demoRepeatable;
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    if (
        noHorizontalScroll === false ||
        panningPassed === false ||
        controlsPassed === false ||
        followPassed === false ||
        demoRepeatable === false ||
        results.consoleErrors.length > 0
    ) {
        process.exitCode = 1;
    }
}



main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
});
