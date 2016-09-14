#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char ** argv) {
    char line[256];
    FILE * ps;
    if((ps = popen("ps -C phantomjs,node -o pid=", "r")) == NULL){
        printf("popen's error!\n");
        exit(-1);
    }
    while(fgets(line, sizeof(line), ps)){
        char cmd[256];
        sprintf(cmd, "kill %d\n", atoi(line));
        system(cmd);
    }
    if(pclose(ps) == -1){
        printf("pclose's error!\n");
        exit(-1);
    }    
    exit(0);
}