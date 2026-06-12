#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "min_heap.h"
#include "graph.h"
#include "dijkstra.h"

void test_min_heap() {
    printf("=== Test MinHeap ===\n");

    MinHeap *heap = heap_create(10);

    assert(heap_is_empty(heap));
    printf("  PASS: empty heap\n");

    heap_insert(heap, (HeapNode){0, 5.0, 5.0, 0});
    heap_insert(heap, (HeapNode){1, 3.0, 3.0, 0});
    heap_insert(heap, (HeapNode){2, 7.0, 7.0, 0});
    heap_insert(heap, (HeapNode){3, 1.0, 1.0, 0});

    HeapNode n = heap_extract_min(heap);
    assert(n.node_id == 3 && n.cost == 1.0);
    n = heap_extract_min(heap);
    assert(n.node_id == 1 && n.cost == 3.0);
    n = heap_extract_min(heap);
    assert(n.node_id == 0 && n.cost == 5.0);
    n = heap_extract_min(heap);
    assert(n.node_id == 2 && n.cost == 7.0);
    assert(heap_is_empty(heap));
    printf("  PASS: insert and extract_min by cost\n");

    heap_insert(heap, (HeapNode){0, 2.0, 10.0, 2});
    heap_insert(heap, (HeapNode){1, 0.000015, 15.0, 0});
    n = heap_extract_min(heap);
    assert(n.node_id == 1 && n.transfers == 0);
    printf("  PASS: mode=1 cost ordering (fewer transfers first)\n");

    heap_destroy(heap);
}

void test_dijkstra_mode1_bug() {
    printf("=== Test Dijkstra mode=1 bug fix ===\n");

    Graph *graph = graph_create(7);

    strcpy(graph->nodes[0].station, "S");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "X");
    strcpy(graph->nodes[1].line, "L1");
    strcpy(graph->nodes[2].station, "Y");
    strcpy(graph->nodes[2].line, "L1");
    strcpy(graph->nodes[3].station, "Z");
    strcpy(graph->nodes[3].line, "L1");
    strcpy(graph->nodes[4].station, "E");
    strcpy(graph->nodes[4].line, "L1");
    strcpy(graph->nodes[5].station, "X");
    strcpy(graph->nodes[5].line, "L2");
    strcpy(graph->nodes[6].station, "Z");
    strcpy(graph->nodes[6].line, "L2");

    graph_add_edge(graph, 0, 1, 5.0, "L1", 0);
    graph_add_edge(graph, 1, 2, 5.0, "L1", 0);
    graph_add_edge(graph, 2, 3, 5.0, "L1", 0);
    graph_add_edge(graph, 3, 4, 5.0, "L1", 0);
    graph_add_edge(graph, 1, 5, 2.0, "TR", 1);
    graph_add_edge(graph, 5, 6, 0.5, "L2", 0);
    graph_add_edge(graph, 6, 3, 2.0, "TR", 1);

    PathResult r = dijkstra_find_path(graph, "S", "E", 1);
    assert(r.found);
    assert(r.transfers == 0);
    assert(r.total_time == 20.0);
    printf("  PASS: mode=1 returns 0 transfers (not 2)\n");

    PathResult r0 = dijkstra_find_path(graph, "S", "E", 0);
    assert(r0.found);
    assert(r0.total_time < 20.0);
    printf("  PASS: mode=0 returns faster path with transfers\n");

    path_result_free(&r);
    path_result_free(&r0);
    graph_destroy(graph);
}

void test_dijkstra_no_transfer() {
    printf("=== Test Dijkstra no-transfer path ===\n");

    Graph *graph = graph_create(3);
    strcpy(graph->nodes[0].station, "A");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "B");
    strcpy(graph->nodes[1].line, "L1");
    strcpy(graph->nodes[2].station, "C");
    strcpy(graph->nodes[2].line, "L1");

    graph_add_edge(graph, 0, 1, 2.0, "L1", 0);
    graph_add_edge(graph, 1, 2, 3.0, "L1", 0);

    PathResult r = dijkstra_find_path(graph, "A", "C", 0);
    assert(r.found);
    assert(r.transfers == 0);
    assert(r.total_time == 5.0);
    assert(r.path_len == 3);
    printf("  PASS: no-transfer path correct (time=5.0, transfers=0)\n");

    path_result_free(&r);
    graph_destroy(graph);
}

void test_dijkstra_same_station() {
    printf("=== Test Dijkstra same start and end ===\n");

    Graph *graph = graph_create(2);
    strcpy(graph->nodes[0].station, "A");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "B");
    strcpy(graph->nodes[1].line, "L1");

    graph_add_edge(graph, 0, 1, 2.0, "L1", 0);

    PathResult r = dijkstra_find_path(graph, "A", "A", 0);
    assert(r.found);
    assert(r.transfers == 0);
    assert(r.total_time == 0.0);
    assert(r.path_len == 1);
    printf("  PASS: same station returns 0 time, 0 transfers\n");

    path_result_free(&r);
    graph_destroy(graph);
}

void test_dijkstra_mode2() {
    printf("=== Test Dijkstra mode=2 combined mode ===\n");

    Graph *graph = graph_create(5);
    strcpy(graph->nodes[0].station, "S");
    strcpy(graph->nodes[0].line, "L1");
    strcpy(graph->nodes[1].station, "A");
    strcpy(graph->nodes[1].line, "L1");
    strcpy(graph->nodes[2].station, "E");
    strcpy(graph->nodes[2].line, "L1");
    strcpy(graph->nodes[3].station, "S");
    strcpy(graph->nodes[3].line, "L2");
    strcpy(graph->nodes[4].station, "E");
    strcpy(graph->nodes[4].line, "L2");

    graph_add_edge(graph, 0, 1, 4.0, "L1", 0);
    graph_add_edge(graph, 1, 2, 4.0, "L1", 0);
    graph_add_edge(graph, 0, 3, 2.0, "TR", 1);
    graph_add_edge(graph, 3, 4, 3.0, "L2", 0);

    PathResult r = dijkstra_find_path(graph, "S", "E", 2);
    assert(r.found);
    assert(r.total_time == 5.0);
    assert(r.transfers == 1);
    printf("  PASS: mode=2 prefers shorter total time\n");

    path_result_free(&r);
    graph_destroy(graph);
}

int main() {
    test_min_heap();
    test_dijkstra_mode1_bug();
    test_dijkstra_no_transfer();
    test_dijkstra_same_station();
    test_dijkstra_mode2();
    printf("\nAll tests passed!\n");
    return 0;
}
