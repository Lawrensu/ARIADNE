// Knot photos and card checks (owner: Letta, Stage 3). The photo mapping is checked against the real
// data/processed/knots.json and against the files copied into app/public/knots/, so a missing or
// renamed image fails here instead of in the demo. The card content is rendered once per real Knot.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import type { Knot } from "../data/contracts";
import { KnotCard, KnotCardContent } from "./KnotCard";
import { localPhotoPath, photoFilesForKnots } from "./knotPhotos";



const thisDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDirectory, "..", "..", "..");
const knotsJsonPath = resolve(repoRoot, "data", "processed", "knots.json");
const knotsPublicDirectory = resolve(repoRoot, "app", "public", "knots");

const realKnots = JSON.parse(readFileSync(knotsJsonPath, "utf8")) as Knot[];



describe("localPhotoPath", () => {
    it("gives the stable public path for a Knot photo", () => {
        expect(localPhotoPath("knot_sulfur_stones", 1)).toBe("/knots/knot_sulfur_stones_1.jpg");
        expect(localPhotoPath("knot_boxwork_ridge", 3)).toBe("/knots/knot_boxwork_ridge_3.jpg");
    });


    it("covers every photo in the real knots.json, in array order", () => {
        const files = photoFilesForKnots(realKnots);
        const photoCount = realKnots.reduce((total, knot) => total + knot.photos.length, 0);

        expect(photoCount).toBe(14);
        expect(files).toHaveLength(photoCount);

        let fileIndex = 0;
        for (const knot of realKnots) {
            for (let photoIndex = 1; photoIndex <= knot.photos.length; photoIndex++) {
                expect(files[fileIndex]).toBe(`${knot.knot_id}_${photoIndex}.jpg`);
                expect(localPhotoPath(knot.knot_id, photoIndex)).toBe(`/knots/${files[fileIndex]}`);
                fileIndex += 1;
            }
        }
    });


    it("has no duplicate paths", () => {
        const files = photoFilesForKnots(realKnots);
        expect(new Set(files).size).toBe(files.length);
    });


    it("matches the JPEG files on disk and their credits", () => {
        const files = photoFilesForKnots(realKnots);
        for (const file of files) {
            expect(existsSync(resolve(knotsPublicDirectory, file)), `missing photo ${file}`).toBe(true);
        }
        expect(existsSync(resolve(knotsPublicDirectory, "CREDITS.md"))).toBe(true);
    });
});



describe("KnotCard", () => {
    it("renders nothing without a selected Knot", () => {
        expect(renderToStaticMarkup(createElement(KnotCard))).toBe("");
    });


    it("renders every real Knot with local photos, tasks and no remote image URL", () => {
        for (const knot of realKnots) {
            const markup = renderToStaticMarkup(createElement(KnotCardContent, { knot }));

            expect(markup).toContain(knot.name);
            expect(markup).toContain(knot.science_rationale);
            expect(markup).toContain(localPhotoPath(knot.knot_id, 1));
            expect(markup).toContain(`Sol ${knot.photos[0].sol}`);

            const imageCount = markup.split("<img").length - 1;
            expect(imageCount).toBe(knot.photos.length);

            for (const task of knot.science_tasks) {
                expect(markup).toContain(task.label);
            }
            for (const measurement of knot.measurements) {
                expect(markup).toContain(measurement.label);
            }

            // Photos are local files only; a remote URL in the card would break the offline demo.
            expect(markup).not.toContain("http");
        }
    });
});
