CC ?= gcc
CFLAGS ?= -Wall -O2 -std=c99
LDFLAGS ?= -static -static-libgcc
TARGET = metro_router.exe

SRCS = main.c min_heap.c graph.c dijkstra.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f *.o $(TARGET)

.PHONY: all clean
