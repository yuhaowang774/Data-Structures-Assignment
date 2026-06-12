#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "graph.h"
#include "dijkstra.h"

static void strip_newline(char *s) {
    int len = strlen(s);
    while (len > 0 && (s[len-1] == '\n' || s[len-1] == '\r')) {
        s[--len] = '\0';
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <graph_file> <mode:0|1|2>\n", argv[0]);
        fprintf(stderr, "  Reads start_station and end_station from stdin\n");
        return 1;
    }

    const char *graph_file = argv[1];
    int mode = atoi(argv[2]);

    char start_station[80];
    char end_station[80];
    if (!fgets(start_station, sizeof(start_station), stdin) ||
        !fgets(end_station, sizeof(end_station), stdin)) {
        printf("{\"error\":\"Failed to read station names from stdin\"}\n");
        return 1;
    }
    strip_newline(start_station);
    strip_newline(end_station);

    Graph *graph = graph_load_from_file(graph_file);
    if (!graph) {
        printf("{\"error\":\"Failed to load graph\"}\n");
        return 1;
    }

    PathResult result = dijkstra_find_path(graph, start_station, end_station, mode);

    printf("{\"path\":[");
    if (result.found) {
        char transfer_stations[4096] = "";
        int transfer_count = 0;
        int unique_station_count = 0;
        char last_station[80] = "";
        for (int i = 0; i < result.path_len; i++) {
            GraphNode *node = &graph->nodes[result.path[i]];
            printf("{\"station\":\"%s\",\"line\":\"%s\",\"lon\":%.6f,\"lat\":%.6f}",
                   node->station, node->line, node->lon, node->lat);
            if (i < result.path_len - 1) printf(",");

            if (strcmp(node->station, last_station) != 0) {
                unique_station_count++;
                strcpy(last_station, node->station);
            }

            if (i > 0 && i < result.path_len - 1) {
                GraphNode *prev_node = &graph->nodes[result.path[i - 1]];
                if (strcmp(node->station, prev_node->station) == 0 &&
                    strcmp(node->line, prev_node->line) != 0) {
                    if (transfer_count > 0) strcat(transfer_stations, "\",\"");
                    strcat(transfer_stations, node->station);
                    transfer_count++;
                }
            }
        }
        if (transfer_count > 0) {
            printf("],\"total_time\":%.2f,\"transfers\":%d,\"transfer_stations\":[\"%s\"],\"station_count\":%d}\n",
                   result.total_time, result.transfers, transfer_stations, unique_station_count);
        } else {
            printf("],\"total_time\":%.2f,\"transfers\":0,\"transfer_stations\":[],\"station_count\":%d}\n",
                   result.total_time, unique_station_count);
        }
    } else {
        printf("],\"error\":\"No path found\"}\n");
    }

    path_result_free(&result);
    graph_destroy(graph);
    return 0;
}
