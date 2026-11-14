"""return_field: seconds to walk back to the staging point from every cell (contracts.md 3.6).

One Dijkstra on the reversed graph: the cost of the edge into a cell is the cost
of walking out of that cell towards the staging point.
"""

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra

from ariadne_pipeline import walking




# ---------------------------------------------------------------- the walking graph

NEIGHBOUR_OFFSETS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def build_walking_graph(heightmap, penalty, cell_size_m):
    """Sparse matrix where entry [a, b] is the seconds to walk from cell a to neighbour b."""
    height, width = heightmap.shape
    cell_ids = np.arange(height * width).reshape(height, width)
    from_ids = []
    to_ids = []
    costs = []

    for row_offset, col_offset in NEIGHBOUR_OFFSETS:
        rows_from = slice(max(0, -row_offset), height - max(0, row_offset))
        cols_from = slice(max(0, -col_offset), width - max(0, col_offset))
        rows_to = slice(max(0, row_offset), height - max(0, -row_offset))
        cols_to = slice(max(0, col_offset), width - max(0, -col_offset))

        is_diagonal = row_offset != 0 and col_offset != 0
        if is_diagonal:
            distance = cell_size_m * np.sqrt(2.0)
        else:
            distance = cell_size_m

        elevation_change = heightmap[rows_to, cols_to] - heightmap[rows_from, cols_from]
        step_seconds = walking.walking_time_seconds_array(distance, elevation_change)
        step_penalty = np.maximum(penalty[rows_from, cols_from], penalty[rows_to, cols_to])
        edge_cost = step_seconds * step_penalty

        usable = np.isfinite(edge_cost)
        from_ids.append(cell_ids[rows_from, cols_from][usable])
        to_ids.append(cell_ids[rows_to, cols_to][usable])
        costs.append(edge_cost[usable])

    from_ids = np.concatenate(from_ids)
    to_ids = np.concatenate(to_ids)
    costs = np.concatenate(costs)
    size = height * width
    return coo_matrix((costs, (from_ids, to_ids)), shape=(size, size)).tocsr()




# ---------------------------------------------------------------- the field


def build_return_field(heightmap, penalty, cell_size_m, staging_row, staging_col):
    height, width = heightmap.shape
    graph = build_walking_graph(heightmap, penalty, cell_size_m)
    reversed_graph = graph.transpose().tocsr()
    staging_id = staging_row * width + staging_col
    seconds = dijkstra(reversed_graph, directed=True, indices=staging_id)
    field = seconds.reshape(height, width)
    field[staging_row, staging_col] = 0.0
    return field
