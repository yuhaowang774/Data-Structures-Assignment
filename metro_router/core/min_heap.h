#ifndef MIN_HEAP_H
#define MIN_HEAP_H

typedef struct HeapNode {
    int node_id;
    double cost;
    double total_time;
    int transfers;
} HeapNode;

typedef struct MinHeap {
    HeapNode *data;
    int size;
    int capacity;
} MinHeap;

MinHeap* heap_create(int capacity);
void heap_destroy(MinHeap *heap);
void heap_insert(MinHeap *heap, HeapNode node);
HeapNode heap_extract_min(MinHeap *heap);
int heap_is_empty(MinHeap *heap);

#endif
