#include "graph.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

Graph* graph_create(int node_count) {
    Graph *graph = (Graph*)malloc(sizeof(Graph));
    graph->nodes = (GraphNode*)calloc(node_count, sizeof(GraphNode));
    graph->node_count = node_count;
    graph->edge_count = 0;
    for (int i = 0; i < node_count; i++) {
        graph->nodes[i].adj_list = NULL;
    }
    return graph;
}

void graph_destroy(Graph *graph) {
    if (!graph) return;
    for (int i = 0; i < graph->node_count; i++) {
        Edge *e = graph->nodes[i].adj_list;
        while (e) {
            Edge *next = e->next;
            free(e);
            e = next;
        }
    }
    free(graph->nodes);
    free(graph);
}

void graph_add_edge(Graph *graph, int from, int to, double weight, const char *line_name, int is_transfer) {
    Edge *e = (Edge*)malloc(sizeof(Edge));
    e->to = to;
    e->weight = weight;
    e->is_transfer = is_transfer;
    strncpy(e->line_name, line_name, 49);
    e->line_name[49] = '\0';
    e->next = graph->nodes[from].adj_list;
    graph->nodes[from].adj_list = e;
    graph->edge_count++;
}

Graph* graph_load_from_file(const char *filename) {
    FILE *f = fopen(filename, "r");
    if (!f) {
        fprintf(stderr, "Cannot open file: %s\n", filename);
        return NULL;
    }

    int node_count, edge_count;
    if (fscanf(f, "%d %d", &node_count, &edge_count) != 2) {
        fclose(f);
        return NULL;
    }

    Graph *graph = graph_create(node_count);

    for (int i = 0; i < node_count; i++) {
        int id;
        double lon, lat;
        if (fscanf(f, "%d %79s %49s %lf %lf", &id, graph->nodes[i].station, graph->nodes[i].line, &lon, &lat) != 5) {
            fprintf(stderr, "Error reading node %d\n", i);
            graph_destroy(graph);
            fclose(f);
            return NULL;
        }
        graph->nodes[i].lon = lon;
        graph->nodes[i].lat = lat;
    }

    for (int i = 0; i < edge_count; i++) {
        int from, to, is_transfer;
        double weight;
        char line_name[50];
        if (fscanf(f, "%d %d %lf %49s %d", &from, &to, &weight, line_name, &is_transfer) != 5) {
            fprintf(stderr, "Error reading edge %d\n", i);
            graph_destroy(graph);
            fclose(f);
            return NULL;
        }
        graph_add_edge(graph, from, to, weight, line_name, is_transfer);
    }

    fclose(f);
    return graph;
}
