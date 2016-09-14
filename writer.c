#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    if (argc != 2) {
        printf("Usage: %s <string>\n", argv[0]);
        exit(0);
    }
    FILE * fifo = fopen("ips.fifo", "w");
    fprintf(fifo, "%s", argv[1]);
    fclose(fifo);
    printf("done\n");
    return 0;
}