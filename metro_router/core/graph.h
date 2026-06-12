#ifndef GRAPH_H
#define GRAPH_H

typedef struct Edge {
    int to;
    char line_name[50];
    double weight;
    int is_transfer;
    struct Edge *next;
} Edge;

typedef struct GraphNode {
    char station[80];
    char line[50];
    double lon;
    double lat;
    Edge *adj_list;
} GraphNode;

typedef struct Graph {
    GraphNode *nodes;
    int node_count;
    int edge_count;
} Graph;

Graph* graph_create(int node_count);
void graph_destroy(Graph *graph);
void graph_add_edge(Graph *graph, int from, int to, double weight, const char *line_name, int is_transfer);
Graph* graph_load_from_file(const char *filename);

#endif
