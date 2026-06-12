#include "dijkstra.h"
#include "min_heap.h"
#include <stdlib.h>
#include <string.h>
#include <float.h>

PathResult dijkstra_find_path(Graph *graph, const char *start_station, const char *end_station, int mode) {
    PathResult result = {0};
    result.found = 0;
    int n = graph->node_count;

    double *dist = (double *) malloc(sizeof(double) * n);
    int *prev = (int *) malloc(sizeof(int) * n);
    int *visited = (int *) calloc(n, sizeof(int));
    double *time_arr = (double *) malloc(sizeof(double) * n);
    int *transfer_arr = (int *) malloc(sizeof(int) * n);

    for (int i = 0; i < n; i++) {
        dist[i] = DBL_MAX;
        prev[i] = -1;
        time_arr[i] = 0;
        transfer_arr[i] = 0;
    }

    MinHeap *heap = heap_create(n);

    for (int i = 0; i < n; i++) {
        if (strcmp(graph->nodes[i].station, start_station) == 0) {
            dist[i] = 0;
            time_arr[i] = 0;
            transfer_arr[i] = 0;
            HeapNode hn = {i, 0.0, 0.0, 0};
            heap_insert(heap, hn);
        }
    }

    int end_node = -1;

    while (!heap_is_empty(heap)) {
        HeapNode cur = heap_extract_min(heap);

        if (visited[cur.node_id]) continue;
        visited[cur.node_id] = 1;

        if (strcmp(graph->nodes[cur.node_id].station, end_station) == 0) {
            end_node = cur.node_id;
            break;
        }

        Edge *e = graph->nodes[cur.node_id].adj_list;
        while (e) {
            int next = e->to;
            if (visited[next]) {
                e = e->next;
                continue;
            }

            double new_time = time_arr[cur.node_id] + e->weight;
            int new_transfers = transfer_arr[cur.node_id] + e->is_transfer;

            double new_cost;
            if (mode == 0) {
                new_cost = new_time;
            } else if (mode == 1) {
                new_cost = (double)new_transfers + new_time * 1e-6;
            } else {
                new_cost = new_time * 1000.0 + (double)new_transfers;
            }

            if (new_cost < dist[next]) {
                dist[next] = new_cost;
                prev[next] = cur.node_id;
                time_arr[next] = new_time;
                transfer_arr[next] = new_transfers;
                HeapNode hn = {next, new_cost, new_time, new_transfers};
                heap_insert(heap, hn);
            }

            e = e->next;
        }
    }

    if (end_node >= 0) {
        result.found = 1;
        result.total_time = time_arr[end_node];
        result.transfers = transfer_arr[end_node];

        int len = 0;
        int tmp = end_node;
        while (tmp != -1) { len++; tmp = prev[tmp]; }

        result.path = (int*)malloc(sizeof(int) * len);
        result.path_len = len;
        tmp = end_node;
        for (int i = len - 1; i >= 0; i--) {
            result.path[i] = tmp;
            tmp = prev[tmp];
        }
    }

    free(dist);
    free(prev);
    free(visited);
    free(time_arr);
    free(transfer_arr);
    heap_destroy(heap);

    return result;
}

void path_result_free(PathResult *result) {
    if (result->path) {
        free(result->path);
        result->path = NULL;
    }
}
