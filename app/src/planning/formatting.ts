// Display formatting for the Planning Table (owner: Malissa, Stage 2).
// Never fake precision: walking times are estimates, shown in whole minutes with "est.".



export function formatWalkingTimeEstimate(seconds: number): string {
    if (!Number.isFinite(seconds)) {
        return "unreachable";
    }
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 1) {
        return "est. < 1 min";
    }
    if (totalMinutes < 60) {
        return `est. ${totalMinutes} min`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes - hours * 60;
    return `est. ${hours} h ${String(minutes).padStart(2, "0")} min`;
}


// Distances to the nearest 10 m below 1 km, then to 0.1 km: the grid is 2 m and paths follow cell centres.
export function formatDistance(metres: number): string {
    if (!Number.isFinite(metres)) {
        return "n/a";
    }
    if (metres < 1000) {
        return `${Math.round(metres / 10) * 10} m`;
    }
    return `${(metres / 1000).toFixed(1)} km`;
}
