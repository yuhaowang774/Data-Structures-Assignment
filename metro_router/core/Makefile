CC = gcc
CFLAGS = -Wall -O2 -std=c99
TARGET = metro_router.exe

SRCS = main.c min_heap.c graph.c dijkstra.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f *.o $(TARGET)

.PHONY: all clean
