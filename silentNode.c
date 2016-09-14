#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char **argv) {
    if (argc != 2) {
        printf("Usage: %s <node script>\n", argv[0]);
    }
    if (fork() == 0) {
        char command[65536];
        sprintf(command, "node %s", argv[1]);
        system(command);
    }
    exit(0);
}