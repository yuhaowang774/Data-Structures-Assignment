#ifndef DIJKSTRA_H
#define DIJKSTRA_H

#include "graph.h"

typedef struct PathResult {
    int *path;
    int path_len;
    double total_time;
    int transfers;
    int found;
} PathResult;

PathResult dijkstra_find_path(Graph *graph, const char *start_station, const char *end_station, int mode);
void path_result_free(PathResult *result);

#endif
