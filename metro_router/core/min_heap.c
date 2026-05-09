#include "min_heap.h"
#include <stdlib.h>
#include <stdio.h>

static void sift_up(MinHeap *heap, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (heap->data[idx].cost < heap->data[parent].cost) {
            HeapNode temp = heap->data[idx];
            heap->data[idx] = heap->data[parent];
            heap->data[parent] = temp;
            idx = parent;
        } else {
            break;
        }
    }
}

static void sift_down(MinHeap *heap, int idx) {
    while (1) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int smallest = idx;
        if (left < heap->size &&
            heap->data[left].cost < heap->data[smallest].cost) {
            smallest = left;
        }
        if (right < heap->size &&
            heap->data[right].cost < heap->data[smallest].cost) {
            smallest = right;
        }
        if (smallest != idx) {
            HeapNode temp = heap->data[idx];
            heap->data[idx] = heap->data[smallest];
            heap->data[smallest] = temp;
            idx = smallest;
        } else {
            break;
        }
    }
}

MinHeap* heap_create(int capacity) {
    MinHeap *heap = (MinHeap*)malloc(sizeof(MinHeap));
    heap->data = (HeapNode*)malloc(sizeof(HeapNode) * capacity);
    heap->size = 0;
    heap->capacity = capacity;
    return heap;
}

void heap_destroy(MinHeap *heap) {
    if (heap) {
        free(heap->data);
        free(heap);
    }
}

void heap_insert(MinHeap *heap, HeapNode node) {
    if (heap->size >= heap->capacity) {
        heap->capacity *= 2;
        heap->data = (HeapNode*)realloc(heap->data, sizeof(HeapNode) * heap->capacity);
    }
    heap->data[heap->size] = node;
    sift_up(heap, heap->size);
    heap->size++;
}

HeapNode heap_extract_min(MinHeap *heap) {
    HeapNode min_node = heap->data[0];
    heap->size--;
    if (heap->size > 0) {
        heap->data[0] = heap->data[heap->size];
        sift_down(heap, 0);
    }
    return min_node;
}

int heap_is_empty(MinHeap *heap) {
    return heap->size == 0;
}
