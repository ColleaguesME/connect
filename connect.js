/*global $*/

const net = require('net');
const fs = require('fs');
const wing = require('./wing');
const buildingsDictionary = 
{
    'Headquarters' : 'headquarter', 
    'ClayPit' : 'clay_pit',
    'TimberCamp' : 'timber_camp',
    'IronMine' : 'iron_mine',
    'Farm' : 'farm',
    'Warehouse' : 'warehouse',
    'RallyPoint' : 'rally_point',
    'Barracks' : 'barracks'
};
const unitsDictionary = 
{
    'Spearman' : '0',
    'Swordsman' : '1'
};
var quests = [];
var layout = []; //СД, которые будут выполнятся позже (через timeout)
var futureOrder = []; //Заказы, которые будут выполнятся в будущем
var currentBuildingsOrder = []; //Заказы зданий, которые выполняются сейчас
var currentUnitsOrder = []; //Заказы юнитов, которые выполняются сейчас

var orderControllers = [];

var socket;

function refresh() {
        wing.getInformation()
        .then(village => {
            village.orders = orderControllers.map((orderController)=>{
                return orderController.order;
            });
            quests = village.questRewards;
            var dataSend = JSON.stringify(village);
            console.log('Send: ' + dataSend.length);
            console.log(dataSend);
            socket.write(dataSend);
        });
    }

function connect(string) {
    var address = string.split('*');
    socket = new net.Socket();

    var message = '', recievedObject;
    
    function isJSON(str) {
        try {
            recievedObject = JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
    
    socket.on('data', function(msg) {
        console.log('Received: ' + msg.length + msg);
        message += msg;
    
        if (isJSON(message)) {
            
            console.log('Received all: ' + message.length);
            console.log(message);
            
            message = "";
            
            switch(recievedObject.type) {
                case "add": 
                    //cancel all after index (including)
                    for (var i = orderControllers.length - 1; i >= recievedObject.index; i--) {
                        if (!orderControllers[i].started) {
                            clearTimeout(orderControllers[i].timeout);
                            orderControllers[i].resolve();
                        } else {
                            orderControllers[i].promise.then(() => {
                                var gamePosition = 1;
                                for (var j = 0; j < recievedObject.index; j++) {
                                    if (orderControllers[j].kind == orderControllers[i].kind) {
                                        gamePosition++;
                                    }
                                }
                                wing.cancelUpgrade(gamePosition);
                                orderControllers.pop();
                            });
                        }
                    }
                    
                    //add changed orders
                    for (var i = 0; i < recievedObject.changedOrders.length; i++) {
                        var waitTime = Math.max(recievedObject.changedOrders[i].begin - Date.now(), 0);
                        var orderController = {started: false};
                        orderController.promise = new Promise((resolve) => {
                            orderController.resolve = resolve;
                            orderController.order = recievedObject.changedOrders[i];
                            
                            if (isBuilding(recievedObject.changedOrders[i].name)) {
                                orderController.kind = "building";
                                orderController.timeout = setTimeout(() => {
                                    orderController.started = true;
                                    wing.upgrade(buildingsDictionary[orderController.order.name]);
                                    resolve();
                                }, waitTime);
                            } else if (isUnit(recievedObject.changedOrders[i].name)) {
                                orderController.kind = "unit";
                                orderController.timeout = setTimeout(() => {
                                    orderController.started = true;
                                    wing.recruit(unitsDictionary[orderController.order.name], orderController.order.quantity);
                                    resolve();
                                }, waitTime);
                            }
                        });
                        orderControllers.push(orderController);
                    }
                    break;
                    
                case "cancel": 
                    //cancel index
                    if (!orderControllers[recievedObject.index].started) {
                        clearTimeout(orderControllers[recievedObject.index].timeout);
                        orderControllers[recievedObject.index].resolve();
                    } else {
                        orderControllers[recievedObject.index].promise.then(() => {
                            var gamePosition = 1;
                            for (var j = 0; j < recievedObject.index; j++) {
                                if (orderControllers[j].kind == orderControllers[recievedObject.index].kind) {
                                    gamePosition++;
                                }
                            }
                            wing.cancelUpgrade(gamePosition);
                        });
                    }
                    orderControllers.splice(recievedObject.index, 1);
                    
                    //for others only clearInterval because game will change running orders automatically
                    for (var i = orderControllers.length - 1; i >= recievedObject.index; i--) {
                        if (!orderControllers[i].started) {
                            clearTimeout(orderControllers[i].timeout);
                            orderControllers[i].resolve();
                            var orderController = {started: false};
                            orderController.promise = new Promise((resolve) => {
                                orderController.resolve = resolve;
                                orderController.order = recievedObject.changedOrders[i - recievedObject.index];
                                
                                if (isBuilding(recievedObject.changedOrders[i - recievedObject.index].name)) {
                                    orderController.kind = "building";
                                    orderController.timeout = setTimeout(() => {
                                        orderController.started = true;
                                        wing.upgrade(buildingsDictionary[orderController.order.name]);
                                        resolve();
                                    }, waitTime);
                                } else if (isUnit(recievedObject.changedOrders[i - recievedObject.index].name)) {
                                    orderController.kind = "unit";
                                    orderController.timeout = setTimeout(() => {
                                        orderController.started = true;
                                        wing.recruit(unitsDictionary[orderController.order.name], orderController.order.quantity);
                                        resolve();
                                    }, waitTime);
                                }
                            });
                            orderControllers[i] = orderController;
                        } else {
                            orderControllers[i].order = recievedObject.changedOrders[i - recievedObject.index].order;
                        }
                    }
                    break;
                case "refresh":
                    refresh();
                default:
                    
            }
        }
    });
    
    socket.on('close', function() {
    	console.log('Connection closed');
    });
    socket.on('end', function() {
    	console.log('Connection end');
    });
    socket.on('error', function(error) {
        console.log('Error: ' + error);
    });
    
    socket.connect(parseInt(address[0],10), address[1], refresh);
}
function isBuilding(name) {
    return buildingsDictionary[name] !== undefined;
}
function isUnit(name) {
    return unitsDictionary[name] !== undefined;    
}
function isEqual(obj1, obj2) {
    for (var key in obj1) {
        if (obj1[key] !== obj2[key]) {
            return false;
        } 
    }
    return true;
}

wing.init();

setTimeout(() => {
    fs.createWriteStream("ips.fifo");
}, 0);
var readable = fs.createReadStream("ips.fifo");
console.log("opened");
readable.on("data", (chunk) => {
    connect(chunk.toString());
});

